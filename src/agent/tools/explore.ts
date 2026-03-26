import fg from "fast-glob";
import fs from "fs";
import path from "path";
import { logAgent, logMsg } from "../../logging";
import { isWithinRoot, secureWorkspace } from "../tools";

/**
 * Returns true if the pattern contains path traversal segments (`..`).
 */
function hasPathTraversal(pattern: string): boolean {
    return pattern.split(/[/\\]/).includes("..");
}

/**
 * Builds an array of ignore patterns from .gitignore and sensible defaults.
 * Suitable for passing directly to fast-glob's `ignore` option.
 *
 * @param root - The workspace root path (required to load .gitignore)
 * @returns An array of glob ignore patterns
 */
export function buildIgnorePatterns(root: string): string[] {
    const patterns = [".git", "**/node_modules", "**/.DS_Store"];

    const gitignorePath = path.join(root, ".gitignore");
    if (fs.existsSync(gitignorePath)) {
        try {
            const lines = fs
                .readFileSync(gitignorePath, "utf-8")
                .split("\n")
                .map((l) => l.trim())
                .filter((l) => l && !l.startsWith("#"));
            patterns.push(...lines);
        } catch {}
    }

    return patterns;
}

/**
 * Executes the readFile operation.
 * Reads the content of a file from the workspace. Supports reading specific line ranges
 * via startLine and endLine arguments (1-based indexing).
 */
export async function readFile_exec(args: { filePath: string; startLine?: number; endLine?: number }): Promise<string> {
    logMsg(
        `Agent - tool use readFile file=${args.filePath}${args.startLine !== undefined ? ` startLine=${args.startLine}` : ""}${args.endLine !== undefined ? ` endLine=${args.endLine}` : ""}`,
    );
    const ws = secureWorkspace(args.filePath, "readFile");
    if (ws.error) {
        return ws.error;
    }

    if (!fs.existsSync(ws.fullPath)) {
        logAgent(`[readFile] File not found: ${args.filePath}`);
        return JSON.stringify({ error: `File not found: ${args.filePath}` });
    }

    const content = fs.readFileSync(ws.fullPath, "utf-8");

    if (args.startLine === undefined && args.endLine === undefined) {
        return content;
    }

    const lines = content.split("\n");
    const start = (args.startLine ?? 1) - 1;
    const end = args.endLine ?? lines.length;

    return lines.slice(start, end).join("\n");
}
export const readFile_def = {
    type: "function" as const,
    function: {
        name: "readFile",
        description:
            "Read the contents of a file in the workspace. Optionally provide startLine and endLine to read a specific range (1-based). Prefer reading in 100-line chunks (1-100, 101-200, 201-300, etc.) to keep responses manageable. If no range is provided, reads the entire file.",
        parameters: {
            type: "object",
            properties: {
                filePath: { type: "string", description: "Path to the file" },
                startLine: {
                    type: "number",
                    description: "Starting line (optional, 1-based). Prefer chunk boundaries: 1, 101, 201, …",
                },
                endLine: {
                    type: "number",
                    description: "Ending line (optional, 1-based). Prefer chunk boundaries: 100, 200, 300, …",
                },
            },
            required: ["filePath"],
        },
    },
};

/**
 * Executes the searchFiles operation.
 * Searches file contents for a regex pattern and returns matching lines.
 *
 * @param args - The arguments for the operation.
 * @param args.pattern - Regex pattern to search for.
 * @param args.glob - Optional glob pattern to restrict search scope.
 * @returns A JSON string containing the search matches, or an error object.
 */
export async function searchFiles_exec(args: { pattern: string; glob?: string }): Promise<string> {
    logMsg(`Agent - tool use searchFiles pattern=${args.pattern}${args.glob ? ` glob=${args.glob}` : ""}`);

    const ws = secureWorkspace(".", "searchFiles");
    if (ws.error) {
        return ws.error;
    }

    let regex: RegExp;
    try {
        regex = new RegExp(args.pattern);
    } catch {
        regex = new RegExp(args.pattern.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
    }

    if (args.glob !== undefined && hasPathTraversal(args.glob)) {
        logAgent(`[searchFiles] Glob must not contain path traversal (..): ${args.glob}`);
        return JSON.stringify({ error: "Glob must not contain path traversal (..)" });
    }

    const files = (
        await fg(args.glob ?? "**/*", {
            cwd: ws.root,
            dot: false,
            ignore: buildIgnorePatterns(ws.root),
        })
    ).filter((f) => isWithinRoot(ws.root, path.join(ws.root, f)));

    const results: string[] = [];
    for (const file of files) {
        const fullPath = path.join(ws.root, file);
        let content: string;
        try {
            content = fs.readFileSync(fullPath, "utf-8");
        } catch {
            continue; // skip binary or unreadable files
        }
        const lines = content.split("\n");
        for (let i = 0; i < lines.length; i++) {
            if (regex.test(lines[i])) {
                results.push(`${file}:${i + 1}:${lines[i].trim()}`);
            }
        }
    }

    return results.length > 0 ? results.join("\n") : "No matches found.";
}
export const searchFiles_def = {
    type: "function" as const,
    function: {
        name: "searchFiles",
        description:
            "Search file contents for a regex pattern. STRATEGY: Start with broad, common patterns that will definitely match (e.g., a function name, variable name, or keyword). Get results first, then read files to find what you need. Avoid overly specific patterns or complex regex - they often fail. If no results, try a simpler pattern once, then stop.",
        parameters: {
            type: "object",
            properties: {
                pattern: {
                    type: "string",
                    description:
                        "Valid regex pattern to search for. Start broad (e.g., 'functionName', 'myVar', 'import') rather than specific context. You'll get results faster and can then read files for details.",
                },
                glob: {
                    type: "string",
                    description:
                        "Optional glob pattern to restrict which files are searched (e.g. '**/*.ts'). Defaults to all files.",
                },
            },
            required: ["pattern"],
        },
    },
};

/**
 * Executes the lsPath operation.
 * Lists files and folders in a workspace directory, optionally filtered by a glob pattern.
 * Results are capped at {@link MAX_LS_RESULTS} to prevent context overflow.
 *
 * @param args - The arguments for the operation.
 * @param args.dirPath - Relative path to the directory to list. Use '.' for root.
 * @param args.depth - Optional. Recursion depth (default 2, max 5).
 * @param args.pattern - Optional. Glob pattern to filter results (e.g. '*.ts').
 * @returns A JSON string containing the entries, or an error object.
 */
const MAX_LS_RESULTS = 200;

export async function lsPath_exec(args: { dirPath: string; depth?: number; pattern?: string }): Promise<string> {
    logMsg(
        `Agent - tool use lsPath dirPath=${args.dirPath}${args.depth ? ` depth=${args.depth}` : ""}${args.pattern ? ` pattern=${args.pattern}` : ""}`,
    );
    const ws = secureWorkspace(args.dirPath, "lsPath");
    if (ws.error) {
        return ws.error;
    }

    if (hasPathTraversal(args.dirPath)) {
        logAgent(`[lsPath] Path must not contain path traversal (..): ${args.dirPath}`);
        return JSON.stringify({ error: "Path must not contain path traversal (..)" });
    }

    if (args.pattern && hasPathTraversal(args.pattern)) {
        logAgent(`[lsPath] Pattern must not contain path traversal (..): ${args.pattern}`);
        return JSON.stringify({ error: "Pattern must not contain path traversal (..)" });
    }

    if (!fs.existsSync(ws.fullPath)) {
        logAgent(`[lsPath] Path not found: ${args.dirPath}`);
        return JSON.stringify({ error: `Path not found: ${args.dirPath}` });
    }

    const maxDepth = Math.min(args.depth ?? 2, 5);
    const entries = (
        await fg(args.pattern ?? "**/*", {
            cwd: ws.fullPath,
            deep: maxDepth,
            onlyFiles: false,
            markDirectories: true,
            dot: false,
            ignore: buildIgnorePatterns(ws.root),
        })
    ).sort();

    const truncated = entries.length > MAX_LS_RESULTS;

    return JSON.stringify({
        entries: truncated ? entries.slice(0, MAX_LS_RESULTS) : entries,
        dirPath: args.dirPath,
        total: entries.length,
        ...(truncated && { truncated: true, showing: MAX_LS_RESULTS }),
    });
}
export const lsPath_def = {
    type: "function" as const,
    function: {
        name: "lsPath",
        description:
            "List files and folders in a workspace directory. Directories end with '/'. Use to explore project structure or find files matching a pattern.",
        parameters: {
            type: "object",
            properties: {
                dirPath: {
                    type: "string",
                    description: "Relative path to the directory. Use '.' for the workspace root.",
                },
                depth: {
                    type: "number",
                    description: "Recursion depth (default 2, max 5).",
                },
                pattern: {
                    type: "string",
                    description: "Glob pattern to filter results (e.g. '**/*.ts'). Defaults to all files.",
                },
            },
            required: ["dirPath"],
        },
    },
};
