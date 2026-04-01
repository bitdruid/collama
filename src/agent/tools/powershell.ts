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
    ["Get-ChildItem"], //
];

function isAllowed(command: string): boolean {
    const parts = command.trim().split(/\s+/);
    return ALLOWED_COMMANDS.some(
        (allowed) => parts.length >= allowed.length && allowed.every((word, i) => parts[i] === word),
    );
}

export async function powershell_exec(args: { command: string }): Promise<string> {
    const command = args.command.trim();
    logMsg(`Agent - use powershell-tool command="${command}"`);

    if (!isAllowed(command)) {
        const allowedList = ALLOWED_COMMANDS.map((c) => c.join(" ")).join(", ");
        logAgent(`[powershell-tool] Command not allowed: ${command}`);
        return JSON.stringify({ error: `Command not allowed. Whitelisted: ${allowedList}` });
    }

    const root = getWorkspaceRoot();
    if (!root) {
        return JSON.stringify({ error: "No workspace root found" });
    }

    const { value, reason } = await requestToolConfirm("powershell", command);
    if (!value) {
        return JSON.stringify({ success: false, message: reason });
    }

    try {
        // Use pwsh (PowerShell Core) if available, otherwise fall back to powershell.exe
        const powershellBin = process.platform === "win32" ? "powershell.exe" : "pwsh";

        // Execute the PowerShell command
        const { stdout, stderr } = await execFileAsync(powershellBin, ["-Command", command], {
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
        logMsg(`Agent - powershell-tool error: ${msg}`);
        return JSON.stringify({ error: msg });
    }
}

export const powershell_prompt =
    "powershell tool: Run whitelisted PowerShell commands (git log, git diff, git status, dir).";
export const powershell_def = {
    type: "function" as const,
    function: {
        name: "powershell",
        description:
            "Run a whitelisted PowerShell command in the workspace root. Allowed commands: git log, git diff, git status, Get-ChildItem, ls. Passes arguments directly, e.g. 'git log --oneline -10' or 'Get-ChildItem src/'.",
        parameters: {
            type: "object",
            properties: {
                command: {
                    type: "string",
                    description:
                        "The full PowerShell command to run (e.g. 'git log --oneline -5' or 'Get-ChildItem src/').",
                },
            },
            required: ["command"],
        },
    },
};
