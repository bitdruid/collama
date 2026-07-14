import { spawn } from "node:child_process";
import { logMsg } from "../../logging";
import { Tool, ToolAnswer, formatToolTargetValue, getWorkspaceRoot, toolError, toolSuccess } from "../tools";
import { getAutoAcceptShell, requestToolConfirm, setAutoAcceptShell } from "./utils/confirm";
import { createSession, getSession, killSession } from "./utils/shell-session";
import { captureOutput } from "./utils/spill";

// Dangerous constructs within a segment:
//   $( … )   command substitution (but NOT $(( … )) arithmetic)
//   <( … )   process substitution — runs the inner command
//   ` … `    backtick command substitution
//   > / >>   file redirection
//   \n       newline can smuggle a second command
const WRITE_CONSTRUCTS = /\$\((?!\()|<\(|`|>|\n/;

// fd duplication / close — reroutes existing streams, never touches disk:
//   2>&1, 1>&2, >&2, 2>&-, etc.
const FD_DUP = /\d*>&(?:\d+|-)/g;

type ShellType = "bash" | "powershell";

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

function hasWriteConstructs(command: string): boolean {
    return command.split(/&&|\|\||[;|]/).some((segment) => WRITE_CONSTRUCTS.test(segment.replace(FD_DUP, "")));
}

// Allowlists for skipping the confirm prompt on provably read-only commands. This is
// convenience, not a security boundary — the prompt remains the boundary for everything else.

// git subcommands that read in every arg form. Shared by both shells, since git is an
// external program that behaves the same. Mutating subcommands are absent, so they prompt.
// prettier-ignore
const GIT_READ_ONLY_SUBCOMMANDS = new Set([
    "status", "log", "show", "diff", "blame", "shortlog", "describe", "ls-files", "rev-parse",
]);

// bash / coreutils that only read.
// prettier-ignore
const BASH_READ_ONLY = new Set([
    "ls", "cat", "head", "tail", "wc", "stat", "tree",
    "grep", "rg", "fd", "find",
    "jq", "cut", "tr", "diff",
    "echo", "printf", "which", "type", "pwd", "date",
]);

// bash commands that read by default but execute/delete via specific flags. (Every other
// listed command writes only to stdout, so they need no guard.)
const BASH_WRITE_FLAGS: Record<string, RegExp> = {
    find: /\s-(?:exec(?:dir)?|ok(?:dir)?|delete|fprint\w*|fls)\b/,
    fd: /\s-[a-zA-Z]*[xX]\b|\s--exec/,
};

// PowerShell cmdlets/aliases that only read. PowerShell is case-insensitive, so these are
// lowercase and the command head is lowercased before lookup. No write-by-flag cases here
// (file writes go through Out-File/Set-Content/redirection, none of which are listed).
// prettier-ignore
const POWERSHELL_READ_ONLY = new Set([
    "get-childitem", "ls", "dir", "gci",
    "get-content", "cat", "type", "gc",
    "get-item", "gi", "get-itemproperty",
    "select-string", "sls",
    "measure-object", "measure",
    "compare-object", "compare",
    "sort-object", "sort",
    "select-object", "select",
    "where-object", "where",
    "get-location", "pwd", "gl",
    "resolve-path", "test-path",
    "get-process", "ps", "gps",
    "get-command", "gcm",
    "write-output", "echo",
    "convertfrom-json", "convertto-json", "get-date",
]);

// Split on every command separator. Includes `&` (background/call operator) so a
// read-only head can't add a second command, e.g. `cat x & rm -rf y`. Fd-duplications
// (2>&1, >&2) stripped before splitting so the inner `&` isn't mistaken.
const SEGMENT_SEPARATORS = /&&|\|\||[;|&]/;

function segmentIsReadOnly(seg: string, shellType: ShellType): boolean {
    const trimmed = seg.trim();
    if (!trimmed) {
        return true;
    }
    const tokens = trimmed.split(/\s+/);
    const head = tokens[0].toLowerCase();

    // git shared case-insensitive; subcommands stay case-sensitive.
    if (head === "git") {
        return GIT_READ_ONLY_SUBCOMMANDS.has(tokens[1]);
    }
    if (shellType === "powershell") {
        return POWERSHELL_READ_ONLY.has(head);
    }
    if (!BASH_READ_ONLY.has(head)) {
        return false;
    }
    return !BASH_WRITE_FLAGS[head]?.test(trimmed);
}

/**
 * True when every segment of the command is a known read-only invocation for the given
 * shell, so it can run without a confirm prompt. Fails closed: anything unrecognized is false.
 */
function isReadOnly(command: string, shellType: ShellType): boolean {
    return command
        .replace(FD_DUP, "")
        .split(SEGMENT_SEPARATORS)
        .every((seg) => segmentIsReadOnly(seg, shellType));
}

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
    // flags may arrive as stringified booleans - dangerous fails closed, background falls back to one-shot
    const dangerous = !(args.is_dangerous === false || args.is_dangerous === "false");
    const background = args.is_background === true || args.is_background === "true";
    const command = (args.command ?? "").trim();
    const sessionId = (args.sessionId ?? "").trim();

    if (command && sessionId) {
        return toolError("Give either a command to execute or a sessionId with action check/stop, not both.");
    }
    if (command) {
        return runCommand(command, (args.explanation ?? "").trim(), dangerous, background);
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
    modelDangerous: boolean,
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

    // The model's dangerous flag is advisory only: it can mark a command dangerous, and the
    // backend additionally flags any write-capable shell construct the model may have missed.
    const dangerous = modelDangerous || hasWriteConstructs(command);
    // Every command prompts - auto-accept only foreground, not-flagged and read-only
    const autoAccept = !background && getAutoAcceptShell() && !dangerous && isReadOnly(command, shellType);
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
                        "Set 'true' unless you are certain the command is read-only. " +
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
