import { spawn } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { EXTENSION_HARD_TOKEN_CAP } from "../../common/utils";
import { logMsg } from "../../logging";
import { Tool, ToolAnswer, formatToolTargetValue, getWorkspaceRoot, toolError, toolSuccess } from "../tools";
import { getAutoAcceptShell, requestToolConfirm, setAutoAcceptShell } from "./confirm";
import { createSession, getSession, killSession } from "./shell-session";

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

const SHELL_MAX_OUTPUT_CHARS = EXTENSION_HARD_TOKEN_CAP * 4;
const TEMP_DIR_NAME = "collama-tmp";

type ShellType = "bash" | "powershell";

/**
 * Determines the default shell type based on the current operating system.
 * @returns "powershell" on Windows, "bash" on all other platforms.
 */
function getDefaultShellType(): ShellType {
    return process.platform === "win32" ? "powershell" : "bash";
}

type ShellAction = "run" | "start" | "check" | "stop";

/**
 * Input type for the shell execution tool. `command`/`explanation`/`dangerous` apply to
 * `run` and `start`; `sessionId` to `check` and `stop`. Per-action presence is validated
 * inside the handlers (the central schema only knows `action` is optional).
 */
type ShellInput = {
    action?: ShellAction;
    command?: string;
    explanation?: string;
    dangerous?: boolean;
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
 * Represents the captured output from a shell command.
 * Either contains the output inline or a reference to a temp file.
 */
type CapturedOutput = {
    output?: string;
    filePath?: string;
    lineCount?: number;
    message?: string;
};

/**
 * Counts the number of lines in a text string.
 * @param text - The text to count lines in.
 * @returns The number of lines, or 0 if text is empty.
 */
function countLines(text: string): number {
    return text.length === 0 ? 0 : text.split("\n").length;
}

/**
 * Small output is returned inline. Output past the ~10k-token cap is written
 * losslessly to a temp file and referenced by path, so the agent can read it in
 * ranges with the read tool instead of having it hard-truncated.
 * @param output - The shell command output to capture.
 * @returns A CapturedOutput object containing either inline output or file reference.
 */
function captureOutput(output: string): CapturedOutput {
    if (output.length <= SHELL_MAX_OUTPUT_CHARS) {
        return { output };
    }

    const dir = path.join(os.tmpdir(), TEMP_DIR_NAME);
    fs.mkdirSync(dir, { recursive: true });
    const filePath = path.join(dir, `${Date.now()}-shell.txt`);
    fs.writeFileSync(filePath, output, "utf-8");

    const lineCount = countLines(output);
    return {
        filePath,
        lineCount,
        message: `Output exceeded ~10k tokens. Wrote ${lineCount} lines to ${filePath} — use the read tool with startLine/endLine to inspect it.`,
    };
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
 * Shell tool entrypoint. Dispatches by action: `run` (default) is the one-shot command;
 * `start`/`check`/`stop` manage background sessions (see shell-session.ts).
 */
export async function shell_exec(args: ShellInput): Promise<ToolAnswer<ShellOutput>> {
    function normalizeDangerous(v: unknown): boolean {
        // flag may be a real boolean or a stringified one - convert
        if (v === false || v === "false") {
            return false;
        }
        if (v === true || v === "true") {
            return true;
        }
        return true; // anything else (e.g. "yes", 1, null, garbage) fails closed
    }

    const normalized = { ...args, dangerous: normalizeDangerous(args.dangerous) };
    switch (normalized.action ?? "run") {
        case "run":
            return runOneShot(normalized);
        case "start":
            return startSession(normalized);
        case "check":
            return checkSession(args);
        case "stop":
            return stopSession(args);
        default:
            return toolError(`Unknown shell action: ${String(args.action)}. Use run | start | check | stop.`);
    }
}

/**
 * One-shot command with user confirmation and workspace safety checks. Spawns, waits for the
 * process to close, and returns its output.
 */
async function runOneShot(args: ShellInput): Promise<ToolAnswer<ShellOutput>> {
    const shellType = getDefaultShellType();
    const command = (args.command ?? "").trim();
    const explanation = (args.explanation ?? "").trim();
    if (!command) {
        return toolError("run requires a command.");
    }
    logMsg(`Agent - use Shell-tool shellType=${shellType} command="${command}" explanation="${explanation}"`);

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
    const dangerous = (args.dangerous ?? false) || hasWriteConstructs(command);
    // Every command prompts - auto-accept only not-flagged and not-read-only
    const autoAccept = getAutoAcceptShell() && !dangerous && isReadOnly(command, shellType);
    if (!autoAccept) {
        const { value, reason } = await requestToolConfirm("Shell", command, explanation, dangerous);
        if (!value) {
            return { success: false, message: reason };
        }
        if (value === "acceptAll") {
            setAutoAcceptShell(true);
        }
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
 * Starts a background command and returns its session id. Always prompts (no auto-accept: a
 * detached long-running process keeps running unsupervised), but surfaces the same dangerous
 * flag as `run` so the user can see whether the background job is write-capable.
 */
async function startSession(args: ShellInput): Promise<ToolAnswer<ShellOutput>> {
    const shellType = getDefaultShellType();
    const command = (args.command ?? "").trim();
    const explanation = (args.explanation ?? "").trim();
    if (!command) {
        return toolError("start requires a command.");
    }
    logMsg(`Agent - use Shell-tool start shellType=${shellType} command="${command}" explanation="${explanation}"`);

    if (/(?:^|[;&|])\s*cd\b/.test(command)) {
        return toolError("cd is not allowed. The shell always runs with the workspace root as cwd.");
    }

    const root = getWorkspaceRoot();
    if (!root) {
        return toolError("No workspace root found");
    }

    const dangerous = (args.dangerous ?? false) || hasWriteConstructs(command);
    const { value, reason } = await requestToolConfirm("Shell:Background", command, explanation, dangerous);
    if (!value) {
        return { success: false, message: reason };
    }

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

/**
 * Returns output produced since the last check for a background session, plus its current
 * status/exit code. Output is incremental; large output spills to a temp file like `run`.
 */
async function checkSession(args: ShellInput): Promise<ToolAnswer<ShellOutput>> {
    const id = (args.sessionId ?? "").trim();
    if (!id) {
        return toolError("check requires a sessionId.");
    }
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
async function stopSession(args: ShellInput): Promise<ToolAnswer<ShellOutput>> {
    const id = (args.sessionId ?? "").trim();
    if (!id) {
        return toolError("stop requires a sessionId.");
    }
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
            `Run ${shellName} commands and uses workspace root as cwd; cd is never allowed. ` +
            "IMPORTANT: Prefer other tools. " +
            "Use as a last resort — prefer just for debugging and testing. " +
            "Restrictive, simple command logics. " +
            "Small output is returned inline; output over ~10k tokens is written to a temp file and " +
            "returned as filePath with lineCount — read it in ranges with the read tool. " +
            "Use 'run' for one-shot plain commands. " +
            "Use 'start' to start a command in the background and move on with other tasks while its processing. " +
            "Use 'check' with sessionId to read the output and exit status. Use 'stop' to terminate it. ",
        parameters: {
            type: "object",
            properties: {
                action: {
                    type: "string",
                    enum: ["run", "start", "check", "stop"],
                    description:
                        "'run' (default): one-shot command. 'start': run command in the background, returns sessionId. " +
                        "'check': read new output of a background sessionId. 'stop': terminate a background sessionId.",
                },
                explanation: {
                    type: "string",
                    description: "One sentence describing what this action does in the repo.",
                },
                command: {
                    type: "string",
                    description: `The full ${shellName} command to execute. Required for run/start.`,
                },
                dangerous: {
                    type: "boolean",
                    description:
                        "Set 'true' unless you are certain the command is read-only." +
                        "The user must see whether the command (incl. a background job) is write-capable.",
                },
                sessionId: {
                    type: "string",
                    description: "The background session id returned by 'start'. Required for check/stop.",
                },
            },
            required: ["explanation"],
        },
    },
};

// role registry
// role registry
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
