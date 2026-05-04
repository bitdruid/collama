import { spawn } from "node:child_process";
import { logMsg } from "../../logging";
import { ToolAnswer, getWorkspaceRoot, toolError, toolSuccess } from "../tools";
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

export async function shell_exec(args: ShellInput): Promise<ToolAnswer<{ output: string }>> {
    const shellType = getDefaultShellType();
    const command = args.command.trim();
    const explanation = args.explanation.trim();
    logMsg(`Agent - use Shell-tool shellType=${shellType} command="${command}" explanation="${explanation}"`);

    // matches `cd` at start or after &&, ;, | separators
    if (/(?:^|[;&|])\s*cd\b/.test(command)) {
        return toolError("cd is not allowed. The shell always runs with the workspace root as cwd.");
    }

    const root = getWorkspaceRoot();
    if (!root) {
        return toolError("No workspace root found");
    }

    const { value, reason } = await requestToolConfirm(`Shell:${shellType}`, command, explanation);
    if (!value) {
        return { success: false, message: reason };
    }

    try {
        const result = shellType === "bash" ? await runBash(command, root) : await runPowerShell(command, root);

        if (result.exitCode !== 0) {
            return toolError(result.output);
        }

        const { output: trimmedOutput, message } = trimOutput(result.output);
        return toolSuccess({ output: trimmedOutput }, message);
    } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        return toolError(msg);
    }
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
                    description: `The full ${shellName} command to execute.`,
                },
            },
            required: ["explanation", "command"],
        },
    },
};
