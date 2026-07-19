import { spawn } from "node:child_process";
import { logMsg } from "../../logging";
import { Tool, ToolAnswer, formatToolTargetValue, getWorkspaceRoot, toolError, toolSuccess } from "../tools";
import { CommandCheck, ShellType } from "./utils/command-check";
import { getAutoAcceptShell, requestToolConfirm, setAutoAcceptShell } from "./utils/confirm";
import { createSession, getSession, killSession } from "./utils/shell-session";
import { captureOutput } from "./utils/spill";

/**
 * Determines the default shell type based on the current operating system.
 * @returns "powershell" on Windows, "bash" on all other platforms.
 */
function getDefaultShellType(): ShellType {
    return process.platform === "win32" ? "powershell" : "bash";
}

/**
 * Input type for the shell execution tool. `command`/`is_background`/`is_dangerous` execute
 * a command; `sessionId`/`action` operate on a background session. Booleans may arrive
 * stringified from small models and are normalized in {@link shell_exec}.
 */
type ShellInput = {
    command?: string;
    explanation?: string;
    is_background?: boolean | string;
    is_dangerous?: boolean | string;
    action?: "check" | "stop";
    sessionId?: string;
};

type ShellOutput = {
    output?: string;
    filePath?: string;
    lineCount?: number;
    sessionId?: string;
    command?: string;
    status?: string;
    exitCode?: number | null;
};

/**
 * Executes a bash command in a child process.
 * @param command - The bash command to execute.
 * @param cwd - The working directory for the command.
 * @returns A promise resolving to the command output and exit code.
 * @throws Error if the command times out after 30 seconds or spawn fails.
 */
async function runBash(command: string, cwd: string): Promise<{ output: string; exitCode: number }> {
    return new Promise((resolve, reject) => {
        const child = spawn("/bin/bash", ["-c", command], {
            cwd,
            shell: false,
            env: { ...process.env, FORCE_COLOR: "0", CI: "true" },
        });
        let output = "";
        let exitCode = 0;

        const timeout = setTimeout(() => {
            child.kill();
            reject(new Error("Command timed out after 30s"));
        }, 30000);

        child.stdout.on("data", (chunk: Buffer) => {
            output += chunk.toString();
        });
        child.stderr.on("data", (chunk: Buffer) => {
            output += chunk.toString();
        });
        child.on("close", (code) => {
            clearTimeout(timeout);
            exitCode = code ?? 0;
            resolve({ output: output.trimEnd(), exitCode });
        });
        child.on("error", (err) => {
            clearTimeout(timeout);
            reject(err);
        });
    });
}

/**
 * Executes a PowerShell command in a child process.
 * @param command - The PowerShell command to execute.
 * @param cwd - The working directory for the command.
 * @returns A promise resolving to the command output and exit code.
 * @throws Error if the command times out after 30 seconds or spawn fails.
 */
async function runPowerShell(command: string, cwd: string): Promise<{ output: string; exitCode: number }> {
    const powershellBin = process.platform === "win32" ? "powershell.exe" : "pwsh";

    return new Promise((resolve, reject) => {
        const child = spawn(powershellBin, ["-Command", command], {
            cwd,
            shell: false,
            env: { ...process.env, CI: "true" },
        });
        let output = "";
        let exitCode = 0;

        const timeout = setTimeout(() => {
            child.kill();
            reject(new Error("Command timed out after 30s"));
        }, 30000);

        child.stdout.on("data", (chunk: Buffer) => {
            output += chunk.toString();
        });
        child.stderr.on("data", (chunk: Buffer) => {
            output += chunk.toString();
        });
        child.on("close", (code) => {
            clearTimeout(timeout);
            exitCode = code ?? 0;
            resolve({ output: output.trimEnd(), exitCode });
        });
        child.on("error", (err) => {
            clearTimeout(timeout);
            reject(err);
        });
    });
}

/**
 * Shell tool entrypoint. Dispatches by argument shape: a `command` executes (one-shot or
 * background via `is_background`); a `sessionId` plus `action` manages a background session
 * (see shell-session.ts).
 */
export async function shell_exec(args: ShellInput): Promise<ToolAnswer<ShellOutput>> {
    // flags may arrive as stringified booleans - only an explicit is_dangerous true counts
    // (marks the prompt and blocks auto-accept), background falls back to one-shot
    const flagged = args.is_dangerous === true || args.is_dangerous === "true";
    const background = args.is_background === true || args.is_background === "true";
    const command = (args.command ?? "").trim();
    const sessionId = (args.sessionId ?? "").trim();

    if (command && sessionId) {
        return toolError("Give either a command to execute or a sessionId with action check/stop, not both.");
    }
    if (command) {
        return runCommand(command, (args.explanation ?? "").trim(), flagged, background);
    }
    if (sessionId) {
        if (args.action === "check") {
            return checkSession(sessionId);
        }
        if (args.action === "stop") {
            return stopSession(sessionId);
        }
        return toolError(`sessionId requires action "check" or "stop".`);
    }
    return toolError("Provide a command to execute, or a sessionId with action check/stop.");
}

/**
 * Executes a command with user confirmation and workspace safety checks. One-shot spawns,
 * waits for the process to close, and returns its output. Background detaches the process
 * and returns its session id; it always prompts (no auto-accept: a detached long-running
 * process keeps running unsupervised) but surfaces the same dangerous flag.
 */
async function runCommand(
    command: string,
    explanation: string,
    modelFlagged: boolean,
    background: boolean,
): Promise<ToolAnswer<ShellOutput>> {
    const shellType = getDefaultShellType();
    logMsg(
        `Agent - use Shell-tool shellType=${shellType} background=${background} command="${command}" explanation="${explanation}"`,
    );

    // matches `cd` at start or after &&, ;, | separators
    if (/(?:^|[;&|])\s*cd\b/.test(command)) {
        return toolError("cd is not allowed. The shell always runs with the workspace root as cwd.");
    }

    const root = getWorkspaceRoot();
    if (!root) {
        return toolError("No workspace root found");
    }

    // The prompt is marked dangerous when the model explicitly flags the command or the
    // check detects a write-capable shell construct; an omitted flag stays unmarked.
    const check = new CommandCheck(command, shellType);
    const dangerous = modelFlagged || check.writeCapable;
    // Every command prompts - auto-accept only foreground and provably read-only. An omitted
    // flag never gates (small models omit it on benign commands), but an explicit true does:
    // the model actively warning always asks.
    const autoAccept = !background && getAutoAcceptShell() && !modelFlagged && check.readOnly;
    if (!autoAccept) {
        const label = background ? "Shell:Background" : "Shell";
        const { value, reason } = await requestToolConfirm(label, command, explanation, dangerous);
        if (!value) {
            return { success: false, message: reason };
        }
        if (value === "acceptAll" && !background) {
            setAutoAcceptShell(true);
        }
    }

    if (background) {
        const session = createSession(command, root, shellType);
        if ("error" in session) {
            return toolError(session.error);
        }
        return toolSuccess(
            { sessionId: session.id, status: session.status, command },
            `Started background shell ${session.id}. Poll it with action "check" (sessionId "${session.id}"); ` +
                `terminate it with action "stop".`,
        );
    }

    try {
        const result = shellType === "bash" ? await runBash(command, root) : await runPowerShell(command, root);
        const captured = captureOutput(result.output);

        if (result.exitCode !== 0) {
            if (captured.filePath) {
                return {
                    success: false,
                    output: { filePath: captured.filePath, lineCount: captured.lineCount },
                    message: captured.message,
                };
            }
            return toolError(captured.output ?? "");
        }

        return toolSuccess(
            { output: captured.output, filePath: captured.filePath, lineCount: captured.lineCount },
            captured.message,
        );
    } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        return toolError(msg);
    }
}

/**
 * Returns output produced since the last check for a background session, plus its current
 * status/exit code. Output is incremental; large output spills to a temp file like one-shot.
 */
async function checkSession(id: string): Promise<ToolAnswer<ShellOutput>> {
    const session = getSession(id);
    if (!session) {
        return toolError(`No shell session "${id}". It may have been stopped, expired, or never existed.`);
    }

    const captured = captureOutput(session.readNew());
    const statusMsg =
        session.status === "running"
            ? `Session ${id} still running.`
            : `Session ${id} exited with code ${session.exitCode}.`;
    // command is echoed back so the UI banner body can show the running command;
    // the agent still reads output/status for reasoning.
    return toolSuccess(
        {
            output: captured.output,
            filePath: captured.filePath,
            lineCount: captured.lineCount,
            status: session.status,
            exitCode: session.exitCode,
            sessionId: id,
            command: session.command,
        },
        captured.message ? `${statusMsg} ${captured.message}` : statusMsg,
    );
}

/** Terminates and forgets a background session. */
async function stopSession(id: string): Promise<ToolAnswer<ShellOutput>> {
    // Grab the command before killSession forgets the session, so the banner body stays filled.
    const command = getSession(id)?.command;
    if (!killSession(id)) {
        return toolError(`No shell session "${id}".`);
    }
    return toolSuccess({ sessionId: id, status: "exited", command }, `Stopped shell session ${id}.`);
}
const shellType = getDefaultShellType();
const shellName = shellType === "bash" ? "bash" : "PowerShell";

export const shell_def = {
    type: "function" as const,
    function: {
        name: "shell",
        description:
            `Run ${shellName} commands and uses workspace root as cwd; cd is never allowed.\n` +
            "Small output is returned inline; large output is written to a temp file and returns a filePath. " +
            "A background-shell will wake you up with <system-notification></system-notification>.\n" +
            "Constraints:\n" +
            "- Use as a last resort — prefer other tools.\n" +
            "- Restrictive, simple command logic.\n" +
            "Usage:\n" +
            "- Give a command to execute it one-shot (waits and returns output).\n" +
            "- Set is_background true for a watcher/monitor/loop/process; returns a sessionId.\n" +
            "- Give a sessionId with action 'check' to read new output and exit status, 'stop' to terminate.\n",
        parameters: {
            type: "object",
            properties: {
                command: {
                    type: "string",
                    description: `The full ${shellName} command to execute.`,
                },
                explanation: {
                    type: "string",
                    description: "One sentence describing what this action does in the repo.",
                },
                is_background: {
                    type: "boolean",
                    description:
                        "true: run the command detached in the background and return a sessionId. " +
                        "false (default): one-shot, waits for the command to finish.",
                },
                is_dangerous: {
                    type: "boolean",
                    description:
                        "Set 'true' when the command changes state (writes, deletes, installs, pushes). " +
                        "The user must see whether the command (incl. a background job) is write-capable.",
                },
                sessionId: {
                    type: "string",
                    description: "A background session id returned earlier. Requires action.",
                },
                action: {
                    type: "string",
                    enum: ["check", "stop"],
                    description:
                        "Only with sessionId. 'check': read new output and status of the background session. " +
                        "'stop': terminate it.",
                },
            },
            required: ["explanation"],
        },
    },
};

// role registry

export const shellTools: Record<string, Tool> = {
    shell: {
        historyPolicy: "keepAll",
        definition: shell_def,
        toolTarget: (args) =>
            formatToolTargetValue("command", args.command) || formatToolTargetValue("sessionId", args.sessionId),
        execute: shell_exec,
    },
};
