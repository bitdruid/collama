import fs from "fs";
import { globby } from "globby";
import os from "os";
import path from "path";
import { logMsg } from "../../logging";
import { ToolAnswer, isWithinAllowedTemp, isWithinRoot, secureWorkspace, toolError, toolSuccess } from "../tools";

/** Returns true if the pattern contains '..' path segments. */
function hasPathTraversal(pattern: string): boolean {
    return pattern.split(/[/\\]/).includes("..");
}

function isAbsolutePattern(pattern: string): boolean {
    return path.isAbsolute(pattern);
}

function resolveExplorePatternRoot(
    pattern: string,
    toolName: "grep" | "glob",
): { root: string; pattern: string; error: string } {
    if (!isAbsolutePattern(pattern)) {
        const ws = secureWorkspace(".", toolName);
        return { root: ws.root, pattern, error: ws.error };
    }

    const normalizedPattern = path.resolve(pattern);
    if (!isWithinAllowedTemp(normalizedPattern)) {
        return { root: "", pattern: "", error: "Absolute pattern must stay within temp dir" };
    }

    return { root: os.tmpdir(), pattern: path.relative(os.tmpdir(), normalizedPattern) || ".", error: "" };
}

function formatExplorePath(root: string, file: string): string {
    return path.resolve(root) === path.resolve(os.tmpdir()) ? path.join(root, file) : file;
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
export async function read_exec(args: {
    filePath: string;
    startLine?: number;
    endLine?: number;
}): Promise<ToolAnswer<{ content: string; lineCount: number }>> {
    logMsg(
        `Agent - use read-tool file=${args.filePath}${args.startLine !== undefined ? ` startLine=${args.startLine}` : ""}${args.endLine !== undefined ? ` endLine=${args.endLine}` : ""}`,
    );
    const ws = secureWorkspace(args.filePath, "read");
    if (ws.error) {
        return toolError(ws.error);
    }

    if (!fs.existsSync(ws.fullPath)) {
        return toolError(`File not found: ${args.filePath}`);
    }

    const content = fs.readFileSync(ws.fullPath, "utf-8");
    const lines = content.split("\n");
    const start = (args.startLine ?? 1) - 1;
    const end = args.endLine ?? lines.length;
    const slice = lines.slice(start, end);

    const numbered = slice.map((line, i) => `${start + i + 1}\t${line}`).join("\n");

    if (numbered.length > 10_000 * 4) {
        return toolError(
            `Read exceeds ~10k tokens. File has ${lines.length} lines total. Use startLine/endLine to read a smaller range.`,
        );
    }

    return toolSuccess({
        content: `${numbered}\n[lines ${start + 1}-${end} of ${lines.length}]`,
        lineCount: lines.length,
    });
}

export const read_def = {
    type: "function" as const,
    function: {
        name: "read",
        description:
            "Read file contents with line numbers. To read the full file skip line numbers. " +
            "If output exceeds ~10k tokens, returns an error with total lineCount — use that to pick a smaller startLine/endLine range. " +
            "For large files read in large chunks e.g. 1-200.",
        parameters: {
            type: "object",
            properties: {
                explanation: {
                    type: "string",
                    description: "One sentence explaining why this tool call is needed for the user's request.",
                },
                filePath: { type: "string", description: "Path to the file" },
                startLine: { type: "number", description: "Starting line (1-based, inclusive)" },
                endLine: { type: "number", description: "Ending line (1-based, inclusive)" },
            },
            required: ["explanation", "filePath"],
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
export async function grep_exec(args: { pattern: string; glob?: string }): Promise<ToolAnswer<{ results: string[] }>> {
    logMsg(`Agent - use grep-tool pattern=${args.pattern}${args.glob ? ` glob=${args.glob}` : ""}`);

    let regex: RegExp;
    try {
        regex = new RegExp(args.pattern);
    } catch {
        regex = new RegExp(args.pattern.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
    }

    if (args.glob !== undefined && hasPathTraversal(args.glob)) {
        return toolError("Glob must not contain path traversal (..)");
    }

    const ws =
        args.glob !== undefined && isAbsolutePattern(args.glob)
            ? resolveExplorePatternRoot(args.glob, "grep")
            : { ...secureWorkspace(".", "grep"), pattern: args.glob ?? "**/*" };
    if (ws.error) {
        return toolError(ws.error);
    }

    const files = (
        await globby(ws.pattern, {
            cwd: ws.root,
            dot: false,
            gitignore: true,
            onlyFiles: true,
            ignore: ["**/node_modules/**", "**/.git/**", "**/.venv/**", "**/venv/**", "**/.DS_Store"],
        })
    ).filter((f) => isWithinRoot(ws.root, path.resolve(ws.root, f)));

    const results: string[] = [];
    for (const file of files) {
        const fullPath = path.resolve(ws.root, file);
        let content: string;
        try {
            content = fs.readFileSync(fullPath, "utf-8");
        } catch {
            continue;
        }
        const lines = content.split("\n");
        for (let i = 0; i < lines.length; i++) {
            if (regex.test(lines[i])) {
                results.push(`${formatExplorePath(ws.root, file)}:${i + 1}:${lines[i].trim()}`);
            }
        }
    }

    return results.length > 0 ? toolSuccess({ results }) : toolSuccess({ results: [] }, "No matches found.");
}
export const grep_def = {
    type: "function" as const,
    function: {
        name: "grep",
        description:
            "Grep file contents for a regex pattern. Returns filenames with exact line of the pattern. Use to locate strings.",
        parameters: {
            type: "object",
            properties: {
                explanation: {
                    type: "string",
                    description: "One sentence explaining why this tool call is needed for the user's request.",
                },
                pattern: {
                    type: "string",
                    description: "Valid regex pattern to search for.",
                },
                glob: {
                    type: "string",
                    description: "Optional glob pattern to restrict files (e.g. '**/*.ts'). Defaults to all files.",
                },
            },
            required: ["explanation", "pattern"],
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
export async function glob_exec(args: {
    pattern: string;
}): Promise<ToolAnswer<{ matches: string[]; pattern: string; total: number }>> {
    logMsg(`Agent - use glob-tool pattern=${args.pattern}`);

    let pattern = args.pattern;

    if (!isAbsolutePattern(pattern) && !pattern.includes("/") && !pattern.includes("*")) {
        pattern = `**/${pattern}`;
    }

    if (hasPathTraversal(pattern)) {
        return toolError("Pattern must not contain path traversal (..)");
    }

    const ws = isAbsolutePattern(pattern)
        ? resolveExplorePatternRoot(pattern, "glob")
        : { ...secureWorkspace(".", "glob"), pattern };
    if (ws.error) {
        return toolError(ws.error);
    }

    let matches: string[];
    try {
        matches = (
            await globby(ws.pattern, {
                cwd: ws.root,
                dot: false,
                gitignore: true,
                onlyFiles: false,
                markDirectories: true,
                ignore: ["**/node_modules/**", "**/.git/**", "**/.venv/**", "**/venv/**", "**/.DS_Store"],
            })
        )
            .filter((f) => isWithinRoot(ws.root, path.resolve(ws.root, f)))
            .map((f) => formatExplorePath(ws.root, f));
    } catch {
        return toolError(`Invalid glob pattern: ${args.pattern}`);
    }

    return toolSuccess({ matches: matches.sort(), pattern: args.pattern, total: matches.length });
}

export const glob_def = {
    type: "function" as const,
    function: {
        name: "glob",
        description: "Find files and folders by a valid glob pattern, searching recursively.",
        parameters: {
            type: "object",
            properties: {
                explanation: {
                    type: "string",
                    description: "One sentence explaining why this tool call is needed for the user's request.",
                },
                pattern: {
                    type: "string",
                    description: "Glob pattern (e.g. '**/*.ts', 'src/**/*.js', or just 'file.ts' to search anywhere).",
                },
            },
            required: ["explanation", "pattern"],
        },
    },
};
