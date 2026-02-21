import fs from "fs";
import fg from "fast-glob";
import ignore from "ignore";
import path from "path";
import * as vscode from "vscode";
import { logMsg } from "../logging";

export interface Tool<TInput = any, TOutput = any> {
    definition: {
        type: "function";
        function: {
            name: string;
            description?: string;
            parameters?: Record<string, any>;
        };
    };
    execute: (input: TInput) => Promise<TOutput>;
}

/**
 * Retrieves the definitions of all registered tools.
 * This formats the internal tool registry for external consumption (e.g., LLM function calling).
 *
 * @returns An array of tool definition objects containing type, name, description, and parameters.
 */
export function getToolDefinitions() {
    return Object.values(toolRegistry).map((tool) => ({
        type: tool.definition.type,
        function: {
            name: tool.definition.function.name,
            description: tool.definition.function.description,
            parameters: tool.definition.function.parameters, // Pass Zod schema directly
        },
    }));
}

/**
 * Executes a specific tool by name after validating the input arguments.
 *
 * @param name - The name of the tool to execute.
 * @param args - The arguments to pass to the tool (will be validated against the tool's schema).
 * @returns A JSON string representing the result of the tool execution.
 * @throws Error if the tool name is not found in the registry or if validation fails.
 */
export async function executeTool(name: string, args: unknown) {
    const tool = toolRegistry[name];
    if (!tool) {
        return JSON.stringify({ error: `Unknown tool: ${name}`, available: getToolDefinitions() });
    }
    try {
        return await tool.execute(args);
    } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        logMsg(`Agent - tool error ${name}: ${msg}`);
        return JSON.stringify({ error: msg });
    }
}

function getWorkspaceRoot(): string | null {
    const folders = vscode.workspace.workspaceFolders;
    if (!folders || folders.length === 0) {
        return null;
    }
    return folders[0].uri.fsPath;
}

/**
 * Returns true if the given resolvedPath is strictly within root (no traversal).
 */
function isWithinRoot(root: string, resolvedPath: string): boolean {
    const normalizedRoot = path.resolve(root);
    const normalizedPath = path.resolve(resolvedPath);
    return normalizedPath === normalizedRoot || normalizedPath.startsWith(normalizedRoot + path.sep);
}

/**
 * Returns true if the pattern contains path traversal segments (`..`).
 */
function hasPathTraversal(pattern: string): boolean {
    return pattern.split(/[/\\]/).includes("..");
}

/**
 * Creates and configures an ignore filter for workspace operations.
 * Reads .gitignore from the workspace root so ignore rules are fully respected.
 *
 * @param root - The workspace root path (required to load .gitignore)
 * @param additionalPatterns - Optional additional patterns to ignore
 * @returns A configured ignore instance ready for use
 */
export function buildIgnoreFilter(root: string, additionalPatterns?: string[]): ignore.Ignore {
    const ig = ignore();
    ig.add([".git", "node_modules", ".DS_Store"]);

    // Load .gitignore from the workspace root
    const gitignorePath = path.join(root, ".gitignore");
    if (fs.existsSync(gitignorePath)) {
        try {
            ig.add(fs.readFileSync(gitignorePath, "utf-8"));
        } catch {
            // ignore read errors
        }
    }

    if (additionalPatterns && additionalPatterns.length > 0) {
        ig.add(additionalPatterns);
    }
    return ig;
}

export const readFile_def = {
    type: "function" as const,
    function: {
        name: "readFile",
        description: "Read the contents of a file in the workspace",
        parameters: {
            type: "object",
            properties: {
                filePath: { type: "string", description: "Path to the file" },
                startLine: { type: "number", description: "Starting line (optional)" },
                endLine: { type: "number", description: "Ending line (optional)" },
            },
            required: ["filePath"],
        },
    },
};

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
async function readFile_exec(args: { filePath: string; startLine?: number; endLine?: number }): Promise<string> {
    const root = getWorkspaceRoot();
    if (!root) {
        throw new Error("No workspace root");
    }

    const fullPath = path.resolve(root, args.filePath);
    if (!isWithinRoot(root, fullPath)) {
        return JSON.stringify({ error: "Path must not escape the workspace root" });
    }
    if (!fs.existsSync(fullPath)) {
        return JSON.stringify({ error: `File not found: ${args.filePath}` });
    }

    let content = fs.readFileSync(fullPath, "utf-8");

    if (args.startLine !== undefined || args.endLine !== undefined) {
        const lines = content.split("\n");
        const start = (args.startLine ?? 1) - 1;
        const end = args.endLine ?? lines.length;
        content = lines.slice(start, end).join("\n");
    }

    return JSON.stringify({ content, filePath: args.filePath });
}

export const listFiles_def = {
    type: "function" as const,
    function: {
        name: "listFiles",
        description: "Find files in the workspace matching a glob pattern (e.g. '**/*.ts', 'src/**/*.json').",
        parameters: {
            type: "object",
            properties: {
                pattern: {
                    type: "string",
                    description: "Glob pattern to match files against.",
                },
            },
            required: ["pattern"],
        },
    },
};

async function listFiles_exec(args: { pattern: string }): Promise<string> {
    logMsg(`Agent - tool use listFiles pattern=${args.pattern}`);
    const root = getWorkspaceRoot();
    if (!root) {
        return JSON.stringify({ error: "No workspace root" });
    }
    if (hasPathTraversal(args.pattern)) {
        return JSON.stringify({ error: "Pattern must not contain path traversal (..)" });
    }
    const ig = buildIgnoreFilter(root);
    const files = (await fg(args.pattern, { cwd: root, dot: false, onlyFiles: false }))
        .filter((f) => !ig.ignores(f))
        .filter((f) => isWithinRoot(root, path.join(root, f)));
    return JSON.stringify({ files, pattern: args.pattern });
}

export const searchFiles_def = {
    type: "function" as const,
    function: {
        name: "searchFiles",
        description:
            "Search file contents in the workspace for a regex pattern. Returns matching lines with their line numbers and file paths.",
        parameters: {
            type: "object",
            properties: {
                pattern: {
                    type: "string",
                    description: "Regex pattern to search for.",
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

async function searchFiles_exec(args: { pattern: string; glob?: string }): Promise<string> {
    logMsg(`Agent - tool use searchFiles pattern=${args.pattern}${args.glob ? ` glob=${args.glob}` : ""}`);
    const root = getWorkspaceRoot();
    if (!root) {
        return JSON.stringify({ error: "No workspace root" });
    }

    let regex: RegExp;
    try {
        regex = new RegExp(args.pattern);
    } catch {
        return JSON.stringify({ error: `Invalid regex: ${args.pattern}` });
    }

    if (args.glob !== undefined && hasPathTraversal(args.glob)) {
        return JSON.stringify({ error: "Glob must not contain path traversal (..)" });
    }
    const ig = buildIgnoreFilter(root);
    const files = (await fg(args.glob ?? "**/*", { cwd: root, dot: false }))
        .filter((f) => !ig.ignores(f))
        .filter((f) => isWithinRoot(root, path.join(root, f)));

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

export const lsPath_def = {
    type: "function" as const,
    function: {
        name: "lsPath",
        description:
            "List the directory tree of a path in the workspace up to a given depth. Use this to orient yourself in the project structure before drilling into files.",
        parameters: {
            type: "object",
            properties: {
                dirPath: {
                    type: "string",
                    description: "Relative path to the directory to list. Use '.' for the workspace root.",
                },
                depth: {
                    type: "number",
                    description: "How many levels deep to recurse (default 2, max 5).",
                },
            },
            required: ["dirPath"],
        },
    },
};

async function lsPath_exec(args: { dirPath: string; depth?: number }): Promise<string> {
    const root = getWorkspaceRoot();
    if (!root) {
        return JSON.stringify({ error: "No workspace root" });
    }
    if (hasPathTraversal(args.dirPath)) {
        return JSON.stringify({ error: "Path must not contain path traversal (..)" });
    }

    const fullPath = path.resolve(root, args.dirPath);
    if (!isWithinRoot(root, fullPath)) {
        return JSON.stringify({ error: "Path must not escape the workspace root" });
    }
    if (!fs.existsSync(fullPath)) {
        return JSON.stringify({ error: `Path not found: ${args.dirPath}` });
    }

    const maxDepth = Math.min(args.depth ?? 2, 5);
    const ig = buildIgnoreFilter(root);

    function walk(dir: string, depth: number): string[] {
        if (depth > maxDepth) {
            return [];
        }
        let entries: fs.Dirent[];
        try {
            entries = fs.readdirSync(dir, { withFileTypes: true });
        } catch {
            return [];
        }
        const lines: string[] = [];
        for (const entry of entries) {
            const rel = path.relative(root!, path.join(dir, entry.name));
            if (ig.ignores(rel)) {
                continue;
            }
            const indent = "  ".repeat(depth);
            if (entry.isDirectory()) {
                lines.push(`${indent}${entry.name}/`);
                lines.push(...walk(path.join(dir, entry.name), depth + 1));
            } else {
                lines.push(`${indent}${entry.name}`);
            }
        }
        return lines;
    }

    const tree = walk(fullPath, 0);
    return JSON.stringify({ tree, dirPath: args.dirPath });
}

/**
 * Registry of available tools.
 * Maps tool names to their definitions (for schema generation) and execute functions.
 */
export const toolRegistry: Record<string, Tool<any, any>> = {
    readFile: {
        definition: readFile_def,
        execute: readFile_exec,
    },
    listFiles: {
        definition: listFiles_def,
        execute: listFiles_exec,
    },
    searchFiles: {
        definition: searchFiles_def,
        execute: searchFiles_exec,
    },
    lsPath: {
        definition: lsPath_def,
        execute: lsPath_exec,
    },
};
