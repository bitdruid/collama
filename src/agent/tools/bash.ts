import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { logAgent, logMsg } from "../../logging";
import { getWorkspaceRoot } from "../tools";
import { requestToolConfirm } from "./edit";

const execFileAsync = promisify(execFile);

const ALLOWED_COMMANDS: string[][] = [
    ["git", "log"],
    ["git", "diff"],
    ["git", "status"],
    ["ls"], //
];

function isAllowed(command: string): boolean {
    const parts = command.trim().split(/\s+/);
    return ALLOWED_COMMANDS.some(
        (allowed) => parts.length >= allowed.length && allowed.every((word, i) => parts[i] === word),
    );
}

export async function bash_exec(args: { command: string }): Promise<string> {
    const command = args.command.trim();
    logMsg(`Agent - use bash-tool command="${command}"`);

    if (!isAllowed(command)) {
        const allowedList = ALLOWED_COMMANDS.map((c) => c.join(" ")).join(", ");
        logAgent(`[bash-tool] Command not allowed: ${command}`);
        return JSON.stringify({ error: `Command not allowed. Whitelisted: ${allowedList}` });
    }

    const root = getWorkspaceRoot();
    if (!root) {
        return JSON.stringify({ error: "No workspace root found" });
    }

    const { value, reason } = await requestToolConfirm("bash", command);
    if (!value) {
        return JSON.stringify({ success: false, message: reason });
    }

    try {
        const parts = command.split(/\s+/);
        const [bin, ...cmdArgs] = parts;
        const { stdout, stderr } = await execFileAsync(bin, cmdArgs, {
            cwd: root,
            timeout: 10000,
            maxBuffer: 1024 * 512,
        });

        return JSON.stringify({
            stdout: stdout.trimEnd(),
            stderr: stderr.trimEnd() || undefined,
        });
    } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        logMsg(`Agent - bash-tool error: ${msg}`);
        return JSON.stringify({ error: msg });
    }
}

export const bash_prompt = "bash tool: Run whitelisted shell commands (git log, git diff, git status, ls).";
export const bash_def = {
    type: "function" as const,
    function: {
        name: "bash",
        description:
            "Run a whitelisted shell command in the workspace root. Allowed commands: git log, git diff, git status, ls. Passes arguments directly, e.g. 'git log --oneline -10' or 'ls src/'.",
        parameters: {
            type: "object",
            properties: {
                command: {
                    type: "string",
                    description: "The full shell command to run (e.g. 'git log --oneline -5').",
                },
            },
            required: ["command"],
        },
    },
};
