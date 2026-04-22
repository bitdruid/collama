import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { logMsg } from "../../logging";
import { getWorkspaceRoot } from "../tools";

const execFileAsync = promisify(execFile);

async function runGit(args: string[], cwd: string): Promise<string> {
    const { stdout } = await execFileAsync("git", args, {
        cwd,
        env: {
            ...process.env,
            GIT_TERMINAL_PROMPT: "0",
            FORCE_COLOR: "0",
        },
    });
    return stdout;
}

const GIT_CHANGE_STATUS: Record<string, string> = {
    A: "added",
    C: "copied",
    D: "deleted",
    M: "modified",
    R: "renamed",
    T: "typechanged",
    U: "unmerged",
};

/**
 * Retrieves git log info: commits or branches.
 * @param args.mode - "commits" (default) or "branches".
 * @param args.branch - Branch to list commits from (default: current). Only for mode "commits".
 * @param args.limit - Max commits to return (default 10, max 50). Only for mode "commits".
 * @param args.filePath - Filter commits to a specific file. Only for mode "commits".
 * @param args.includeRemote - Include remote branches. Only for mode "branches".
 */
export async function gitLog_exec(args: {
    mode?: string;
    branch?: string;
    limit?: number;
    filePath?: string;
    includeRemote?: boolean;
}): Promise<string> {
    const mode = args.mode ?? "commits";
    logMsg(`Agent - use gitLog-tool mode=${mode}`);

    const root = getWorkspaceRoot();
    if (!root) {
        return JSON.stringify({ error: "No workspace root found" });
    }

    if (mode === "branches") {
        try {
            const gitArgs = ["branch", "--format=%(refname:short)\t%(objectname:short)\t%(HEAD)"];
            if (args.includeRemote) {
                gitArgs.push("-a");
            }

            const stdout = await runGit(gitArgs, root);
            const branches = stdout
                .trim()
                .split("\n")
                .filter((line) => line.length > 0)
                .map((line) => {
                    const [name, commit, head] = line.split("\t");
                    return { name, isCurrent: head === "*", commit };
                });

            return JSON.stringify({ branches });
        } catch (error) {
            const msg = error instanceof Error ? error.message : String(error);
            logMsg(`Agent - gitLog-tool error: ${msg}`);
            return JSON.stringify({ error: `Failed to list branches: ${msg}` });
        }
    }

    // Default: commits
    const limit = Math.min(args.limit ?? 10, 50);
    try {
        const gitArgs = ["log", args.branch ?? "HEAD", `--max-count=${limit}`, "--format=%H%n%an%n%ae%n%aI%n%s"];
        if (args.filePath) {
            gitArgs.push("--", args.filePath);
        }

        const stdout = await runGit(gitArgs, root);
        const lines = stdout.trim().split("\n");
        const commits: Array<{
            hash: string;
            authorName: string;
            authorEmail: string;
            authorDate: string;
            message: string;
        }> = [];

        for (let i = 0; i + 4 < lines.length; i += 5) {
            commits.push({
                hash: lines[i],
                authorName: lines[i + 1],
                authorEmail: lines[i + 2],
                authorDate: lines[i + 3],
                message: lines[i + 4],
            });
        }

        return JSON.stringify({
            commits,
            branch: args.branch ?? "HEAD",
            limit,
            filePath: args.filePath ?? null,
        });
    } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        logMsg(`Agent - gitLog-tool error: ${msg}`);
        return JSON.stringify({ error: `Failed to get commits: ${msg}` });
    }
}

export const gitLog_prompt = "gitLog tool: Get git log info — commits or branches.";
export const gitLog_def = {
    type: "function" as const,
    function: {
        name: "gitLog",
        description: "Git log info. Use mode 'commits' to list commits (default), or mode 'branches' to list branches.",
        parameters: {
            type: "object",
            properties: {
                mode: {
                    type: "string",
                    description: "'commits' (default) to list commits, 'branches' to list branches.",
                },
                branch: {
                    type: "string",
                    description:
                        "Branch to get commits from (e.g., 'main'). Defaults to current. Only for mode 'commits'.",
                },
                limit: {
                    type: "number",
                    description: "Max commits to return (default 10, max 50). Only for mode 'commits'.",
                },
                filePath: {
                    type: "string",
                    description: "Filter to commits affecting this file. Only for mode 'commits'.",
                },
                includeRemote: {
                    type: "boolean",
                    description: "Include remote branches (default false). Only for mode 'branches'.",
                },
            },
            required: [],
        },
    },
};

/**
 * Unified git diff: compare commits/branches or show working tree changes.
 * @param args.fromCommit - Starting commit/branch. If omitted, shows working tree diff.
 * @param args.toCommit - Ending commit/branch (default: HEAD). Only for commit diff.
 * @param args.staged - If true and no fromCommit, shows staged changes (default false).
 * @param args.filePath - Filter diff to a specific file.
 */
export async function gitDiff_exec(args: {
    fromCommit?: string;
    toCommit?: string;
    staged?: boolean;
    filePath?: string;
}): Promise<string> {
    logMsg(
        `Agent - use gitDiff-tool${args.fromCommit ? ` from=${args.fromCommit}` : ""}${args.toCommit ? ` to=${args.toCommit}` : ""}${args.staged ? " staged" : ""}${args.filePath ? ` file=${args.filePath}` : ""}`,
    );

    const root = getWorkspaceRoot();
    if (!root) {
        return JSON.stringify({ error: "No workspace root found" });
    }

    // Working tree diff (no commits specified)
    if (!args.fromCommit) {
        try {
            const gitArgs = ["diff", "--no-ext-diff"];
            if (args.staged) {
                gitArgs.push("--cached");
            }
            if (args.filePath) {
                gitArgs.push("--", args.filePath);
            }

            const diff = await runGit(gitArgs, root);

            if (!diff || diff.trim().length === 0) {
                return JSON.stringify({
                    diff: "",
                    staged: args.staged ?? false,
                    filePath: args.filePath ?? null,
                    message: args.staged ? "No staged changes" : "No unstaged changes",
                });
            }

            return JSON.stringify({
                diff,
                staged: args.staged ?? false,
                filePath: args.filePath ?? null,
            });
        } catch (error) {
            const msg = error instanceof Error ? error.message : String(error);
            logMsg(`Agent - gitDiff-tool error: ${msg}`);
            return JSON.stringify({ error: `Failed to get working tree diff: ${msg}` });
        }
    }

    // Commit diff
    const toCommit = args.toCommit ?? "HEAD";
    try {
        if (args.filePath) {
            const diff = await runGit(["diff", "--no-ext-diff", args.fromCommit, toCommit, "--", args.filePath], root);
            return JSON.stringify({
                diff,
                fromCommit: args.fromCommit,
                toCommit,
                filePath: args.filePath,
            });
        }

        const changes = await runGit(["diff", "--name-status", args.fromCommit, toCommit], root);
        const files = changes
            .trim()
            .split("\n")
            .filter((line) => line.length > 0)
            .map((line) => {
                const [statusCode, firstPath, secondPath] = line.split("\t");
                return {
                    path: secondPath ?? firstPath,
                    status: GIT_CHANGE_STATUS[statusCode[0]] ?? `unknown(${statusCode})`,
                };
            });

        return JSON.stringify({
            files,
            fromCommit: args.fromCommit,
            toCommit,
        });
    } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        logMsg(`Agent - gitDiff-tool error: ${msg}`);
        return JSON.stringify({ error: `Failed to get commit diff: ${msg}` });
    }
}

export const gitDiff_prompt = "gitDiff tool: Get a git diff of working tree or between commits.";
export const gitDiff_def = {
    type: "function" as const,
    function: {
        name: "gitDiff",
        description:
            "Get a git diff. Without fromCommit, shows working tree changes (unstaged by default, staged with staged=true). With fromCommit, compares two commits or branches.",
        parameters: {
            type: "object",
            properties: {
                fromCommit: {
                    type: "string",
                    description: "Starting commit hash or branch name. If omitted, shows working tree changes instead.",
                },
                toCommit: {
                    type: "string",
                    description: "Ending commit hash or branch name (default: HEAD). Only used with fromCommit.",
                },
                staged: {
                    type: "boolean",
                    description: "If true and no fromCommit, shows staged changes. Default false (unstaged).",
                },
                filePath: {
                    type: "string",
                    description: "Filter the diff to a specific file.",
                },
            },
            required: [],
        },
    },
};
