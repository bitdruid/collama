import fs from "fs";
import { globby } from "globby";
import path from "path";
import { logAgent, logMsg } from "../../logging";
import { isWithinRoot, secureWorkspace } from "../tools";

/** Returns true if the pattern contains '..' path segments. */
function hasPathTraversal(pattern: string): boolean {
    return pattern.split(/[/\\]/).includes("..");
}

/**
 * Reads a workspace file and returns selected lines with 1-based line numbers.
 * Returns a JSON error if the file doesn't exist, is outside workspace bounds,
 * or is too large (>~10k tokens).
 *
 * @param args.filePath - File path relative to workspace root
 * @param args.startLine - Optional 1-based starting line (inclusive)
 * @param args.endLine - Optional 1-based ending line (inclusive)
 * @returns Formatted string with numbered lines, or JSON error string
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
    const lines = content.split("\n");
    const start = (args.startLine ?? 1) - 1;
    const end = args.endLine ?? lines.length;
    const slice = lines.slice(start, end);

    const numbered = slice.map((line, i) => `${start + i + 1}\t${line}`).join("\n");

    if (numbered.length > 10_000 * 4) {
        return JSON.stringify({
            error: `Read exceeds ~10k tokens. File has ${lines.length} lines total. Use startLine/endLine to read a smaller range.`,
            lineCount: lines.length,
        });
    }

    return `${numbered}\n[lines ${start + 1}-${end} of ${lines.length}]`;
}

export const read_def = {
    type: "function" as const,
    function: {
        name: "read",
        description:
            "Read file contents with line numbers. If no range given, reads the entire file. " +
            "If output exceeds ~10k tokens, returns an error with total lineCount — use that to pick a smaller startLine/endLine range. " +
            "For large files read in chunks e.g. 1-200, 201-400.",
        parameters: {
            type: "object",
            properties: {
                filePath: { type: "string", description: "Path to the file" },
                startLine: { type: "number", description: "Starting line (1-based, inclusive)" },
                endLine: { type: "number", description: "Ending line (1-based, inclusive)" },
            },
            required: ["filePath"],
        },
    },
};

/**
 * Searches file contents for a regex pattern across files matched by an optional glob.
 * Returns results in `file:line:content` format, or "No matches found." if no matches exist.
 *
 * @param args.pattern - Regex pattern to search for
 * @param args.glob - Optional glob pattern to restrict search scope
 * @returns Matching lines in `file:line:content` format, or JSON error string on failure
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
        await globby(args.glob ?? "**/*", {
            cwd: ws.root,
            dot: false,
            gitignore: true,
            onlyFiles: true,
            ignore: ["**/node_modules/**", "**/.git/**", "**/.venv/**", "**/venv/**", "**/.DS_Store"],
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
 * Finds files and folders matching a glob pattern within the workspace.
 * Simple filenames are normalized for recursive matching.
 *
 * @param args.pattern - Glob pattern (e.g. "*.ts", "src/.*.js", "file.ts")
 * @returns JSON string with matches (sorted array), pattern, and total count
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
            await globby(pattern, {
                cwd: ws.root,
                dot: false,
                gitignore: true,
                onlyFiles: false,
                markDirectories: true,
                ignore: ["**/node_modules/**", "**/.git/**", "**/.venv/**", "**/venv/**", "**/.DS_Store"],
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
