import { execFile } from "node:child_process";
import path from "node:path";
import { promisify } from "node:util";
import * as vscode from "vscode";
import { logMsg } from "../../logging";
import { getWorkspaceRoot } from "../tools";

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
 * Retrieves git commits from a branch.
 * @param args - The arguments for the operation.
 * @param args.branch - Optional. Branch name to get commits from (defaults to current branch).
 * @param args.limit - Maximum number of commits to return (default 10, max 50).
 * @param args.filePath - Optional. Filter to commits affecting this specific file.
 * @returns JSON string containing the list of commits or an error message.
 */
export async function getCommits_exec(args: { branch?: string; limit?: number; filePath?: string }): Promise<string> {
    logMsg(
        `Agent - tool use getCommits branch=${args.branch ?? "HEAD"} limit=${args.limit ?? 10}${args.filePath ? ` file=${args.filePath}` : ""}`,
    );

    const limit = Math.min(args.limit ?? 10, 50);
    const root = getWorkspaceRoot();

    if (!root) {
        return JSON.stringify({ error: "No workspace root found" });
    }

    try {
        // Use git log directly to support branch parameter
        const gitArgs = [
            "log",
            args.branch ?? "HEAD",
            `--max-count=${limit}`,
            "--format=%H%n%an%n%ae%n%aI%n%s",
        ];
        if (args.filePath) {
            gitArgs.push("--", args.filePath);
        }

        const { stdout } = await execFileAsync("git", gitArgs, { cwd: root });
        const lines = stdout.trim().split("\n");
        const commits: Array<{ hash: string; authorName: string; authorEmail: string; authorDate: string; message: string }> = [];

        // Each commit is 5 lines: hash, authorName, authorEmail, authorDate, message
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
        logMsg(`Agent - getCommits error: ${msg}`);
        return JSON.stringify({ error: `Failed to get commits: ${msg}` });
    }
}

export const getCommits_def = {
    type: "function" as const,
    function: {
        name: "getCommits",
        description:
            "List git commits from a branch. Returns commit hash, author, date, and message. Defaults to the current branch if no branch is specified.",
        parameters: {
            type: "object",
            properties: {
                branch: {
                    type: "string",
                    description: "Branch name to get commits from (e.g., 'main', 'feature/foo'). Defaults to current branch.",
                },
                limit: {
                    type: "number",
                    description: "Maximum number of commits to return (default 10, max 50).",
                },
                filePath: {
                    type: "string",
                    description: "Optional. Filter to commits affecting this specific file.",
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
 * Compares two commits or branches.
 * @param args - The arguments for the operation.
 * @param args.fromCommit - Starting commit hash or branch name (e.g., 'main', 'abc123').
 * @param args.toCommit - Ending commit hash or branch name (e.g., 'HEAD', 'feature/my-feature', 'def456').
 * @param args.filePath - Optional. Returns the full diff text for this file if provided. Otherwise returns a list of changed files.
 * @returns JSON string containing the diff text or list of files, or an error message.
 */
export async function getCommitDiff_exec(args: {
    fromCommit: string;
    toCommit: string;
    filePath?: string;
}): Promise<string> {
    logMsg(
        `Agent - tool use getCommitDiff from=${args.fromCommit} to=${args.toCommit}${args.filePath ? ` file=${args.filePath}` : ""}`,
    );

    const result = await getFirstRepo();
    if ("error" in result) {
        return JSON.stringify({ error: result.error });
    }

    try {
        const root = getWorkspaceRoot();

        if (args.filePath) {
            // With filePath: return the actual diff text for that file
            const diff = await result.repo.diffBetween(args.fromCommit, args.toCommit, args.filePath);
            return JSON.stringify({
                diff,
                fromCommit: args.fromCommit,
                toCommit: args.toCommit,
                filePath: args.filePath,
            });
        }

        // Without filePath: return list of changed files
        const changes = await result.repo.diffBetween(args.fromCommit, args.toCommit);
        const files = changes.map((c) => ({
            path: root ? path.relative(root, c.uri.fsPath) : c.uri.fsPath,
            status: GIT_CHANGE_STATUS[c.status] ?? `unknown(${c.status})`,
        }));

        return JSON.stringify({
            files,
            fromCommit: args.fromCommit,
            toCommit: args.toCommit,
        });
    } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        logMsg(`Agent - getCommitDiff error: ${msg}`);
        return JSON.stringify({ error: `Failed to get commit diff: ${msg}` });
    }
}

export const getCommitDiff_def = {
    type: "function" as const,
    function: {
        name: "getCommitDiff",
        description:
            "Compare two commits or branches. Without filePath, returns the list of changed files and their status. With filePath, returns the actual diff text for that specific file. Use getCommits to find commit hashes first.",
        parameters: {
            type: "object",
            properties: {
                fromCommit: {
                    type: "string",
                    description: "Starting commit hash or branch name (e.g., 'main', 'abc123').",
                },
                toCommit: {
                    type: "string",
                    description: "Ending commit hash or branch name (e.g., 'HEAD', 'feature/my-feature', 'def456').",
                },
                filePath: {
                    type: "string",
                    description:
                        "Optional. When provided, returns the full diff text for this specific file. When omitted, returns the list of all changed files.",
                },
            },
            required: ["fromCommit", "toCommit"],
        },
    },
};

/**
 * Gets unstaged or staged changes in the working directory.
 * @param args - The arguments for the operation.
 * @param args.staged - If true, returns staged changes. Defaults to false (unstaged).
 * @param args.filePath - Optional. Filter the diff to a specific file.
 * @returns JSON string containing the diff text or an error message.
 */
export async function getWorkingTreeDiff_exec(args: { staged?: boolean; filePath?: string }): Promise<string> {
    logMsg(
        `Agent - tool use getWorkingTreeDiff staged=${args.staged ?? false}${args.filePath ? ` file=${args.filePath}` : ""}`,
    );

    const result = await getFirstRepo();
    if ("error" in result) {
        return JSON.stringify({ error: result.error });
    }

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
                    inTargetFile = diffHeaderMatch[1] === normalizedTarget || diffHeaderMatch[2] === normalizedTarget;
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
        logMsg(`Agent - getWorkingTreeDiff error: ${msg}`);
        return JSON.stringify({ error: `Failed to get working tree diff: ${msg}` });
    }
}

export const getWorkingTreeDiff_def = {
    type: "function" as const,
    function: {
        name: "getWorkingTreeDiff",
        description: "Get unstaged or staged changes in the working directory.",
        parameters: {
            type: "object",
            properties: {
                staged: {
                    type: "boolean",
                    description: "If true, returns staged changes. If false, returns unstaged changes (default false).",
                },
                filePath: {
                    type: "string",
                    description: "Optional. Filter the diff to a specific file.",
                },
            },
            required: [],
        },
    },
};

/**
 * Lists all local (and optionally remote) git branches in the repository.
 * @param args - The arguments for the operation.
 * @param args.includeRemote - If true, include remote branches. Defaults to false.
 * @returns JSON string containing the list of branches or an error message.
 */
export async function listBranches_exec(args: { includeRemote?: boolean }): Promise<string> {
    logMsg(`Agent - tool use listBranches includeRemote=${args.includeRemote ?? false}`);

    const root = getWorkspaceRoot();
    if (!root) {
        return JSON.stringify({ error: "No workspace root found" });
    }

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
                return {
                    name,
                    isCurrent: head === "*",
                    commit,
                };
            });

        return JSON.stringify({ branches });
    } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        logMsg(`Agent - listBranches error: ${msg}`);
        return JSON.stringify({ error: `Failed to list branches: ${msg}` });
    }
}

export const listBranches_def = {
    type: "function" as const,
    function: {
        name: "listBranches",
        description: "List all local (and optionally remote) git branches in the repository.",
        parameters: {
            type: "object",
            properties: {
                includeRemote: {
                    type: "boolean",
                    description: "If true, include remote branches. Defaults to false (local only).",
                },
            },
            required: [],
        },
    },
};
