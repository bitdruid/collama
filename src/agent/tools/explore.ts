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
 * Executes the read-tool operation.
 * Reads the content of a file from the workspace. Supports reading specific line ranges
 * via startLine and endLine arguments (1-based indexing).
 */
export async function read_exec(args: { filePath: string; startLine?: number; endLine?: number }): Promise<string> {
    logMsg(
        `Agent - use read-tool file=${args.filePath}${args.startLine !== undefined ? ` startLine=${args.startLine}` : ""}${args.endLine !== undefined ? ` endLine=${args.endLine}` : ""}`,
    );
    const ws = secureWorkspace(args.filePath, "read");
    if (ws.error) {
        return ws.error;
    }

    if (!fs.existsSync(ws.fullPath)) {
        logAgent(`[read-tool] File not found: ${args.filePath}`);
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
export const read_prompt = "read tool: Read file contents. Prefer reading files over grep.";
export const read_def = {
    type: "function" as const,
    function: {
        name: "read",
        description:
            "Read the contents of a file in the workspace. Optionally provide startLine and endLine to read a specific range. Prefer reading in 100-line chunks (1-100, 101-200, 201-300, etc.). If no range is provided, reads the entire file.",
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
 * Executes the grep-tool operation.
 * Searches file contents for a regex pattern and returns matching lines.
 *
 * @param args - The arguments for the operation.
 * @param args.pattern - Regex pattern to search for.
 * @param args.glob - Optional glob pattern to restrict search scope.
 * @returns A JSON string containing the search matches, or an error object.
 */
export async function grep_exec(args: { pattern: string; glob?: string }): Promise<string> {
    logMsg(`Agent - use grep-tool pattern=${args.pattern}${args.glob ? ` glob=${args.glob}` : ""}`);

    const ws = secureWorkspace(".", "grep");
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
        logAgent(`[grep-tool] Glob must not contain path traversal (..): ${args.glob}`);
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
export const grep_prompt = "grep tool: Grep file contents for a regex pattern.";
export const grep_def = {
    type: "function" as const,
    function: {
        name: "grep",
        description:
            "Grep file contents for a regex pattern. STRATEGY: Start with broad, common patterns (e.g., a function name, variable name, or keyword), then use complex patterns. If no results, try a simpler pattern once, then stop.",
        parameters: {
            type: "object",
            properties: {
                pattern: {
                    type: "string",
                    description: "Valid regex pattern to search for.",
                },
                glob: {
                    type: "string",
                    description: "Optional glob pattern to restrict files (e.g. '**/*.ts'). Defaults to all files.",
                },
            },
            required: ["pattern"],
        },
    },
};

/**
 * Executes the glob operation.
 *
 * @param args - The arguments for the operation.
 * @param args.pattern - The glob pattern to search for.
 * @returns A JSON string containing the matched paths, the original pattern,
 *          and the total count. If an error occurs (e.g., invalid pattern or
 *          workspace error), the JSON string will contain an `error` property.
 */
export async function glob_exec(args: { pattern: string }): Promise<string> {
    logMsg(`Agent - use glob-tool pattern=${args.pattern}`);

    const ws = secureWorkspace(".", "glob");
    if (ws.error) {
        return ws.error;
    }

    let pattern = args.pattern;

    // 🔧 Normalize simple filenames → **/filename
    if (!pattern.includes("/") && !pattern.includes("*")) {
        pattern = `**/${pattern}`;
    }

    if (hasPathTraversal(pattern)) {
        logAgent(`[glob-tool] Pattern must not contain path traversal (..): ${pattern}`);
        return JSON.stringify({ error: "Pattern must not contain path traversal (..)" });
    }

    let matches: string[];
    try {
        matches = (
            await fg(pattern, {
                cwd: ws.root,
                dot: false,
                onlyFiles: false,
                markDirectories: true,
                ignore: buildIgnorePatterns(ws.root),
            })
        ).filter((f) => isWithinRoot(ws.root, path.join(ws.root, f)));
    } catch {
        return JSON.stringify({ error: `Invalid glob pattern: ${args.pattern}` });
    }

    return JSON.stringify({
        matches: matches.sort(),
        pattern: args.pattern,
        total: matches.length,
    });
}

export const glob_prompt = "glob tool: Find files and folders by glob pattern.";
export const glob_def = {
    type: "function" as const,
    function: {
        name: "glob",
        description: "Find files and folders by a valid glob pattern, searching recursively.",
        parameters: {
            type: "object",
            properties: {
                pattern: {
                    type: "string",
                    description: "Glob pattern (e.g. '**/*.ts', 'src/**/*.js', or just 'file.ts' to search anywhere).",
                },
            },
            required: ["pattern"],
        },
    },
};
