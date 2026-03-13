import fg from "fast-glob";
import fs from "fs";
import path from "path";
import { logAgent, logMsg } from "../../logging";
import { getWorkspaceRoot, isWithinRoot } from "../tools";

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
 *
 * @param args - The arguments for the operation.
 * @param args.filePath - The relative path to the file within the workspace.
 * @param args.startLine - Optional. The starting line number (1-based). Defaults to 1.
 * @param args.endLine - Optional. The ending line number (1-based). Defaults to the end of the file.
 * @returns A JSON string containing the file content and path, or an error object if the operation fails.
 */
const CHUNK_SIZE = 100;

function snapToChunkStart(line: number): number {
    return Math.floor((line - 1) / CHUNK_SIZE) * CHUNK_SIZE + 1;
}

function snapToChunkEnd(line: number): number {
    return Math.ceil(line / CHUNK_SIZE) * CHUNK_SIZE;
}

export async function readFile_exec(args: { filePath: string; startLine?: number; endLine?: number }): Promise<string> {
    const snappedStart = args.startLine !== undefined ? snapToChunkStart(args.startLine) : undefined;
    const snappedEnd = args.endLine !== undefined ? snapToChunkEnd(args.endLine) : undefined;

    logMsg(
        `Agent - tool use readFile file=${args.filePath}${snappedStart !== undefined ? ` startLine=${snappedStart}` : ""}${snappedEnd !== undefined ? ` endLine=${snappedEnd}` : ""}`,
    );
    const root = getWorkspaceRoot();
    if (!root) {
        logAgent(`[readFile] No workspace root`);
        throw new Error("No workspace root");
    }

    const fullPath = path.resolve(root, args.filePath);
    if (!isWithinRoot(root, fullPath)) {
        logAgent(`[readFile] Path must not escape the workspace root: ${args.filePath}`);
        return JSON.stringify({ error: "Path must not escape the workspace root" });
    }
    if (!fs.existsSync(fullPath)) {
        logAgent(`[readFile] File not found: ${args.filePath}`);
        return JSON.stringify({ error: `File not found: ${args.filePath}` });
    }

    const content = fs.readFileSync(fullPath, "utf-8");

    if (snappedStart === undefined && snappedEnd === undefined) {
        return JSON.stringify({ content, filePath: args.filePath });
    }

    const lines = content.split("\n");
    const start = (snappedStart ?? 1) - 1;
    const end = snappedEnd ?? lines.length;

    return JSON.stringify({
        content: lines.slice(start, end).join("\n"),
        filePath: args.filePath,
        startLine: snappedStart ?? 1,
        endLine: Math.min(end, lines.length),
    });
}
export const readFile_def = {
    type: "function" as const,
    function: {
        name: "readFile",
        description:
            "Read the contents of a file in the workspace. Optionally provide startLine and endLine to read a specific range. Line ranges are automatically snapped to 100-line chunks (1-100, 101-200, 201-300, etc.). If no range is provided, reads the entire file.",
        parameters: {
            type: "object",
            properties: {
                filePath: { type: "string", description: "Path to the file" },
                startLine: {
                    type: "number",
                    description:
                        "Starting line (optional). Use chunk boundaries: 1, 101, 201, … Will be snapped to the nearest chunk start.",
                },
                endLine: {
                    type: "number",
                    description:
                        "Ending line (optional). Use chunk boundaries: 100, 200, 300, … Will be snapped to the nearest chunk end.",
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
    const root = getWorkspaceRoot();
    if (!root) {
        logAgent(`[searchFiles] No workspace root`);
        return JSON.stringify({ error: "No workspace root" });
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
            cwd: root,
            dot: false,
            ignore: buildIgnorePatterns(root),
        })
    ).filter((f) => isWithinRoot(root, path.join(root, f)));

    const matches: { file: string; line: number; text: string }[] = [];
    for (const file of files) {
        const fullPath = path.join(root, file);
        let content: string;
        try {
            content = fs.readFileSync(fullPath, "utf-8");
        } catch {
            continue; // skip binary or unreadable files
        }
        const lines = content.split("\n");
        for (let i = 0; i < lines.length; i++) {
            if (regex.test(lines[i])) {
                matches.push({ file, line: i + 1, text: lines[i].trim() });
            }
        }
    }

    return JSON.stringify({ matches, pattern: args.pattern });
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
    const root = getWorkspaceRoot();
    if (!root) {
        logAgent(`[lsPath] No workspace root`);
        return JSON.stringify({ error: "No workspace root" });
    }
    if (hasPathTraversal(args.dirPath)) {
        logAgent(`[lsPath] Path must not contain path traversal (..): ${args.dirPath}`);
        return JSON.stringify({ error: "Path must not contain path traversal (..)" });
    }
    if (args.pattern && hasPathTraversal(args.pattern)) {
        logAgent(`[lsPath] Pattern must not contain path traversal (..): ${args.pattern}`);
        return JSON.stringify({ error: "Pattern must not contain path traversal (..)" });
    }

    const fullPath = path.resolve(root, args.dirPath);
    if (!isWithinRoot(root, fullPath)) {
        logAgent(`[lsPath] Path must not escape the workspace root: ${args.dirPath}`);
        return JSON.stringify({ error: "Path must not escape the workspace root" });
    }
    if (!fs.existsSync(fullPath)) {
        logAgent(`[lsPath] Path not found: ${args.dirPath}`);
        return JSON.stringify({ error: `Path not found: ${args.dirPath}` });
    }

    const maxDepth = Math.min(args.depth ?? 2, 5);
    const entries = (
        await fg(args.pattern ?? "**/*", {
            cwd: fullPath,
            deep: maxDepth,
            onlyFiles: false,
            markDirectories: true,
            dot: false,
            ignore: buildIgnorePatterns(root),
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
