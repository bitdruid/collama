import { spawn } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { logMsg } from "../../logging";
import { ToolAnswer, getWorkspaceRoot, toolError, toolSuccess } from "../tools";
import { requestToolConfirm } from "./confirm";

type ShellType = "bash" | "powershell";

/**
 * Determines the default shell type based on the current operating system.
 * @returns "powershell" on Windows, "bash" on all other platforms.
 */
function getDefaultShellType(): ShellType {
    return process.platform === "win32" ? "powershell" : "bash";
}

/**
 * Input type for the shell execution tool.
 */
type ShellInput = {
    command: string;
    explanation: string;
};

const MAX_OUTPUT_CHARS = 10_000 * 4;
const TEMP_DIR_NAME = "collama-tmp";

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
    if (output.length <= MAX_OUTPUT_CHARS) {
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
 * Executes a shell command with user confirmation and workspace safety checks.
 * @param args - The shell input containing command and explanation.
 * @returns A promise resolving to a ToolAnswer with output, filePath, or lineCount.
 * @throws Error if workspace root is not found or command execution fails.
 */
export async function shell_exec(
    args: ShellInput,
): Promise<ToolAnswer<{ output?: string; filePath?: string; lineCount?: number }>> {
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
            "returned as filePath with lineCount — read it in ranges with the read tool.",
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
