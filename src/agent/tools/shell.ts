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
    explanation: string;
};

const MAX_OUTPUT_CHARS = 10_000 * 4;

function trimOutput(output: string): { output: string; message?: string } {
    if (output.length <= MAX_OUTPUT_CHARS) {
        return { output };
    }
    return { output: output.slice(0, MAX_OUTPUT_CHARS), message: "Output was trimmed to 10k tokens." };
}

async function runBash(command: string, cwd: string): Promise<string> {
    const parts = command.trim().split(/\s+/);
    const [bin, ...cmdArgs] = parts;

    return new Promise((resolve, reject) => {
        const child = spawn(bin, cmdArgs, { cwd, shell: false, env: { ...process.env, FORCE_COLOR: "0", CI: "true" } });
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
        child.on("close", () => {
            clearTimeout(timeout);
            resolve(output.trimEnd());
        });
        child.on("error", (err) => {
            clearTimeout(timeout);
            reject(err);
        });
    });
}

async function runPowerShell(command: string, cwd: string): Promise<string> {
    const powershellBin = process.platform === "win32" ? "powershell.exe" : "pwsh";

    return new Promise((resolve, reject) => {
        const child = spawn(powershellBin, ["-Command", command], {
            cwd,
            shell: false,
            env: { ...process.env, CI: "true" },
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
        child.on("close", () => {
            clearTimeout(timeout);
            resolve(output.trimEnd());
        });
        child.on("error", (err) => {
            clearTimeout(timeout);
            reject(err);
        });
    });
}

export async function shell_exec(args: ShellInput): Promise<string> {
    const shellType = getDefaultShellType();
    const command = args.command.trim();
    const explanation = args.explanation.trim();
    logMsg(`Agent - use Shell-tool shellType=${shellType} command="${command}" explanation="${explanation}"`);

    const root = getWorkspaceRoot();
    if (!root) {
        return JSON.stringify({ error: "No workspace root found" });
    }

    const { value, reason } = await requestToolConfirm(`Shell:${shellType}`, command, explanation);
    if (!value) {
        return JSON.stringify({ success: false, message: reason });
    }

    try {
        const output = shellType === "bash" ? await runBash(command, root) : await runPowerShell(command, root);
        const { output: trimmedOutput, message } = trimOutput(output);
        return JSON.stringify({ output: trimmedOutput, ...(message && { message }) }, null, 2);
    } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        logAgent(`[Shell-tool] Failed to execute: ${msg}`);
        return JSON.stringify({ error: msg });
    }
}
export const shell_def = {
    type: "function" as const,
    function: {
        name: "shell",
        description:
            "Run shell commands and uses workspace root as cwd. " +
            "IMPORTANT: Prefer other tools. " +
            "Use as a last resort — prefer just for debugging and testing. " +
            "Restrictive, simple command logics.",
        parameters: {
            type: "object",
            properties: {
                explanation: {
                    type: "string",
                    description: "One sentence describing what the command does in the repo.",
                },
                command: {
                    type: "string",
                    description: "The full shell command to execute.",
                },
            },
            required: ["explanation", "command"],
        },
    },
};
