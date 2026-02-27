import { execFile } from "node:child_process";
import path from "node:path";
import { promisify } from "node:util";
import * as vscode from "vscode";
import { logMsg } from "../../logging";
import { confirmAction, getWorkspaceRoot, isWithinRoot } from "../tools";

const execFileAsync = promisify(execFile);

/**
 * Represents the VS Code Git extension interface.
 */
interface GitExtension {
    getAPI(version: number): GitAPI;
}

/**
 * API provided by the VS Code Git extension.
 */
interface GitAPI {
    repositories: GitRepository[];
}

/**
 * Represents a Git repository.
 */
interface GitRepository {
    diff(staged?: boolean): Promise<string>;
    diffBetween(ref1: string, ref2: string): Promise<GitChange[]>;
    diffBetween(ref1: string, ref2: string, path: string): Promise<string>;
    log(options?: { maxEntries?: number; path?: string }): Promise<GitCommit[]>;
    state: {
        HEAD?: { name?: string; commit?: string };
        refs: Array<{ name?: string; commit?: string; type: number }>;
    };
}

/**
 * Represents a Git commit.
 */
interface GitCommit {
    hash: string;
    message: string;
    authorDate?: Date;
    authorName?: string;
    authorEmail?: string;
}

/**
 * Represents a change in a Git repository.
 */
interface GitChange {
    uri: vscode.Uri;
    originalUri: vscode.Uri;
    renameUri?: vscode.Uri;
    status: number; // 0=Modified, 1=Added, 2=Deleted, 3=Renamed, etc.
}

/**
 * Gets the VS Code Git extension API.
 * Activates the extension if it is not already active.
 * @returns The Git API or null if the extension is not available.
 */
export async function getGitAPI(): Promise<GitAPI | null> {
    const gitExtension = vscode.extensions.getExtension<GitExtension>("vscode.git");
    if (!gitExtension) {
        return null;
    }
    if (!gitExtension.isActive) {
        await gitExtension.activate();
    }
    return gitExtension.exports.getAPI(1);
}

/**
 * Gets the first Git repository in the workspace.
 * Returns an object with the repo or a specific error message.
 * @returns An object containing the repository or an error string.
 */
export async function getFirstRepo(): Promise<{ repo: GitRepository } | { error: string }> {
    const gitExtension = vscode.extensions.getExtension<GitExtension>("vscode.git");
    if (!gitExtension) {
        return { error: "Git extension is not available. Is git installed?" };
    }
    const git = await getGitAPI();
    if (!git || !git.repositories.length) {
        return { error: "No Git repository found in workspace" };
    }
    return { repo: git.repositories[0] };
}

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
    logMsg(`Agent - tool use gitLog mode=${mode}`);

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

            const { stdout } = await execFileAsync("git", gitArgs, { cwd: root });
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
            logMsg(`Agent - gitLog branches error: ${msg}`);
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

        const { stdout } = await execFileAsync("git", gitArgs, { cwd: root });
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
        logMsg(`Agent - gitLog commits error: ${msg}`);
        return JSON.stringify({ error: `Failed to get commits: ${msg}` });
    }
}

export const gitLog_def = {
    type: "function" as const,
    function: {
        name: "gitLog",
        description:
            "Git log info. Use mode 'commits' to list commits (default), or mode 'branches' to list branches.",
        parameters: {
            type: "object",
            properties: {
                mode: {
                    type: "string",
                    description: "'commits' (default) to list commits, 'branches' to list branches.",
                },
                branch: {
                    type: "string",
                    description: "Branch to get commits from (e.g., 'main'). Defaults to current. Only for mode 'commits'.",
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
 * Mapping of Git status codes to human-readable strings.
 */
const GIT_CHANGE_STATUS: Record<number, string> = {
    0: "modified",
    1: "added",
    2: "deleted",
    3: "renamed",
    4: "copied",
    5: "untracked",
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
        `Agent - tool use gitDiff${args.fromCommit ? ` from=${args.fromCommit}` : ""}${args.toCommit ? ` to=${args.toCommit}` : ""}${args.staged ? " staged" : ""}${args.filePath ? ` file=${args.filePath}` : ""}`,
    );

    const result = await getFirstRepo();
    if ("error" in result) {
        return JSON.stringify({ error: result.error });
    }

    // Working tree diff (no commits specified)
    if (!args.fromCommit) {
        try {
            const diff = await result.repo.diff(args.staged ?? false);

            if (!diff || diff.trim().length === 0) {
                return JSON.stringify({
                    diff: "",
                    staged: args.staged ?? false,
                    filePath: args.filePath ?? null,
                    message: args.staged ? "No staged changes" : "No unstaged changes",
                });
            }

            let filteredDiff = diff;
            if (args.filePath) {
                const normalizedTarget = args.filePath.replace(/^\//, "");
                const lines = diff.split("\n");
                let inTargetFile = false;
                const filteredLines: string[] = [];

                for (const line of lines) {
                    const diffHeaderMatch = line.match(/^diff --git a\/(\S+) b\/(\S+)$/);
                    if (diffHeaderMatch) {
                        inTargetFile =
                            diffHeaderMatch[1] === normalizedTarget || diffHeaderMatch[2] === normalizedTarget;
                    }
                    if (inTargetFile) {
                        filteredLines.push(line);
                    }
                }

                filteredDiff = filteredLines.join("\n");
            }

            return JSON.stringify({
                diff: filteredDiff,
                staged: args.staged ?? false,
                filePath: args.filePath ?? null,
            });
        } catch (error) {
            const msg = error instanceof Error ? error.message : String(error);
            logMsg(`Agent - gitDiff working tree error: ${msg}`);
            return JSON.stringify({ error: `Failed to get working tree diff: ${msg}` });
        }
    }

    // Commit diff
    const toCommit = args.toCommit ?? "HEAD";
    try {
        const root = getWorkspaceRoot();

        if (args.filePath) {
            const diff = await result.repo.diffBetween(args.fromCommit, toCommit, args.filePath);
            return JSON.stringify({
                diff,
                fromCommit: args.fromCommit,
                toCommit,
                filePath: args.filePath,
            });
        }

        const changes = await result.repo.diffBetween(args.fromCommit, toCommit);
        const files = changes.map((c) => ({
            path: root ? path.relative(root, c.uri.fsPath) : c.uri.fsPath,
            status: GIT_CHANGE_STATUS[c.status] ?? `unknown(${c.status})`,
        }));

        return JSON.stringify({
            files,
            fromCommit: args.fromCommit,
            toCommit,
        });
    } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        logMsg(`Agent - gitDiff commit error: ${msg}`);
        return JSON.stringify({ error: `Failed to get commit diff: ${msg}` });
    }
}

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
                    description:
                        "Starting commit hash or branch name. If omitted, shows working tree changes instead.",
                },
                toCommit: {
                    type: "string",
                    description: "Ending commit hash or branch name (default: HEAD). Only used with fromCommit.",
                },
                staged: {
                    type: "boolean",
                    description:
                        "If true and no fromCommit, shows staged changes. Default false (unstaged).",
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

/**
 * Reverts a file to its last git-committed state using `git checkout`.
 *
 * @param args.filePath - Relative path to the file to revert.
 */
export async function revertFile_exec(args: { filePath: string }): Promise<string> {
    logMsg(`Agent - tool use revertFile file=${args.filePath}`);

    const root = getWorkspaceRoot();
    if (!root) {
        return JSON.stringify({ error: "No workspace root found" });
    }

    const fullPath = path.resolve(root, args.filePath);
    if (!isWithinRoot(root, fullPath)) {
        return JSON.stringify({ error: "Path must not escape the workspace root" });
    }

    try {
        if (
            !(await confirmAction(
                "Revert",
                `Revert ${args.filePath} to last committed state? Unsaved changes will be lost.`,
            ))
        ) {
            return JSON.stringify({ success: false, message: "Revert cancelled.", filePath: args.filePath });
        }

        await execFileAsync("git", ["checkout", "HEAD", "--", args.filePath], { cwd: root });

        // Reload the file in the editor if it's open so VS Code picks up the reverted content
        const uri = vscode.Uri.file(fullPath);
        const openDoc = vscode.workspace.textDocuments.find((d) => d.uri.toString() === uri.toString());
        if (openDoc) {
            await vscode.commands.executeCommand("workbench.action.files.revert");
        }

        return JSON.stringify({
            success: true,
            message: "File reverted to last committed state.",
            filePath: args.filePath,
        });
    } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        if (msg.includes("did not match any file")) {
            return JSON.stringify({ error: `File not tracked by git: ${args.filePath}` });
        }
        logMsg(`Agent - revertFile error: ${msg}`);
        return JSON.stringify({ error: `Failed to revert file: ${msg}` });
    }
}

export const revertFile_def = {
    type: "function" as const,
    function: {
        name: "revertFile",
        description:
            "Revert a file to its last git-committed state, discarding all uncommitted changes. Asks for user confirmation. Useful to undo mistakes or restore a file to a known good state.",
        parameters: {
            type: "object",
            properties: {
                filePath: {
                    type: "string",
                    description: "Path to the file to revert (relative to workspace root).",
                },
            },
            required: ["filePath"],
        },
    },
};
