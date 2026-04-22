import { spawn } from "node:child_process";
import { logAgent, logMsg } from "../../logging";
import { getWorkspaceRoot } from "../tools";
import { requestToolConfirm } from "./edit";

type ShellType = "bash" | "powershell";

function getDefaultShellType(): ShellType {
    return process.platform === "win32" ? "powershell" : "bash";
}

type ShellInput = {
    command: string;
};

type ShellResult = {
    output: string;
    exitCode: number;
};

const ALLOWED_COMMANDS: Record<ShellType, string[][]> = {
    bash: [["npm"], ["python"], ["python3"]],
    powershell: [["npm"], ["python"], ["python3"]],
};

function hasShellControlSyntax(command: string): boolean {
    return /[;&|<>`\n\r]/.test(command);
}

function isAllowed(shellType: ShellType, command: string): boolean {
    const parts = command.trim().split(/\s+/);
    return ALLOWED_COMMANDS[shellType].some(
        (allowed) => parts.length >= allowed.length && allowed.every((word, i) => parts[i] === word),
    );
}

function allowedList(shellType: ShellType): string {
    return ALLOWED_COMMANDS[shellType].map((c) => c.join(" ")).join(", ");
}

async function runBash(command: string, cwd: string): Promise<ShellResult> {
    const parts = command.trim().split(/\s+/);
    const [bin, ...cmdArgs] = parts;

    return new Promise((resolve, reject) => {
        const child = spawn(bin, cmdArgs, {
            cwd,
            shell: false,
            env: {
                ...process.env,
                FORCE_COLOR: "0",
                CI: "true",
            },
        });

        let output = "";

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
            resolve({ output: output.trimEnd(), exitCode: code ?? -1 });
        });

        child.on("error", (err) => {
            clearTimeout(timeout);
            reject(err);
        });
    });
}

async function runPowerShell(command: string, cwd: string): Promise<ShellResult> {
    const powershellBin = process.platform === "win32" ? "powershell.exe" : "pwsh";

    return new Promise((resolve, reject) => {
        const child = spawn(powershellBin, ["-Command", command], {
            cwd,
            shell: false,
            env: {
                ...process.env,
                CI: "true",
            },
        });

        let output = "";

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
            resolve({ output: output.trimEnd(), exitCode: code ?? -1 });
        });

        child.on("error", (err) => {
            clearTimeout(timeout);
            reject(err);
        });
    });
}

export async function debug_exec(args: ShellInput): Promise<string> {
    const shellType = getDefaultShellType();
    const command = args.command.trim();
    logMsg(`Agent - use Debug-tool shellType=${shellType} command="${command}"`);

    if (hasShellControlSyntax(command)) {
        logAgent(`[Debug-tool] Shell control syntax is not allowed: ${command}`);
        return JSON.stringify({ error: "Shell control syntax is not allowed in shell commands." });
    }

    if (!isAllowed(shellType, command)) {
        logAgent(`[Debug-tool] Command not allowed for ${shellType}: ${command}`);
        return JSON.stringify({
            error: `Command not allowed. Whitelisted for ${shellType}: ${allowedList(shellType)}`,
        });
    }

    const root = getWorkspaceRoot();
    if (!root) {
        return JSON.stringify({ error: "No workspace root found" });
    }

    const { value, reason } = await requestToolConfirm(`Debug:${shellType}`, command);
    if (!value) {
        return JSON.stringify({ success: false, message: reason });
    }

    try {
        const result = shellType === "bash" ? await runBash(command, root) : await runPowerShell(command, root);

        return JSON.stringify({
            output: result.output,
            exitCode: result.exitCode,
        });
    } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        logMsg(`Agent - Debug-tool error: ${msg}`);
        return JSON.stringify({ error: msg });
    }
}

export const debug_prompt = "Debug tool: Run common npm or Python build/test commands to debug projects.";

export const debug_def = {
    type: "function" as const,
    function: {
        name: "Debug",
        description:
            "Run common test, and package debugging commands in the workspace root. " +
            "Other commands are forbidden. You must check the available commands before use." +
            "Allowed commands: npm, python, python3. " +
            "Do not use pipes, redirects, command separators, or multi-line commands. " +
            "Response has output and exitCode.",
        parameters: {
            type: "object",
            properties: {
                command: {
                    type: "string",
                    description: "The full debugging command to execute.",
                },
            },
            required: ["command"],
        },
    },
};
