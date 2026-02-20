import fs from "fs";
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
        return JSON.stringify({ error: `Unknown tool: ${name}` });
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
 * Creates and configures an ignore filter for workspace operations.
 * This filter excludes common directories and files that should not be processed by tools.
 *
 * @param additionalPatterns - Optional additional patterns to ignore (e.g., ["node_modules"])
 * @returns A configured ignore instance ready for use
 */
export function buildIgnoreFilter(additionalPatterns?: string[]): ignore.Ignore {
    const ig = ignore();
    const defaultPatterns = [".git", ".gitignore", "node_modules", ".DS_Store"];
    ig.add(defaultPatterns);
    if (additionalPatterns && additionalPatterns.length > 0) {
        ig.add(additionalPatterns);
    }
    return ig;
}

export const lsPath_def = {
    type: "function" as const,
    function: {
        name: "lsPath",
        description:
            "List the contents of a directory in the workspace. No path lists the workspace root. Use depth > 1 to recurse.",
        parameters: {
            type: "object",
            properties: {
                path: {
                    type: "string",
                    description: "Relative path to list (e.g. 'src/components'). Omit for the workspace root.",
                },
                depth: {
                    type: "number",
                    description: "How many levels deep to recurse. Defaults to 1 (immediate children only).",
                },
            },
        },
    },
};

/**
 * Recursively lists directory contents while respecting ignore patterns.
 *
 * @param dir - The absolute path to the directory to scan.
 * @param depth - The current recursion depth. If 1, lists only immediate children.
 * @param ig - The ignore instance used to filter out unwanted files/directories.
 * @param basePath - The relative path from the workspace root, used for ignore pattern matching.
 * @returns An array of strings representing file and directory names relative to the input `dir`.
 */
function listDir(dir: string, depth: number, ig: ignore.Ignore, basePath: string = ""): string[] {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    const result: string[] = [];

    for (const entry of entries) {
        const relativePath = basePath ? `${basePath}/${entry.name}` : entry.name;

        // Check if this entry should be ignored
        if (ig.ignores(relativePath)) {
            continue;
        }

        result.push(entry.isDirectory() ? `${entry.name}/` : entry.name);

        if (entry.isDirectory() && depth > 1) {
            listDir(path.join(dir, entry.name), depth - 1, ig, relativePath).forEach((child) =>
                result.push(`${entry.name}/${child}`),
            );
        }
    }
    return result;
}

/**
 * Executes the logic for the lsPath tool.
 * Resolves the target path within the workspace, applies ignore filters, and retrieves the directory structure.
 *
 * @param args - The arguments provided to the tool.
 * @param args.path - Optional relative path within the workspace. Defaults to root.
 * @param args.depth - Optional depth of recursion. Defaults to 1.
 * @returns A JSON string containing the list of files, the requested path, and the depth used.
 */
async function lsPath_exec(args: { path?: string; depth?: number }): Promise<string> {
    logMsg(
        `Agent - tool use lsPath${args.path ? ` path=${args.path}` : ""}${args.depth ? ` depth=${args.depth}` : ""}`,
    );
    const root = getWorkspaceRoot();

    if (!root) {
        return JSON.stringify({ files: [], root: null });
    }

    const target = args.path ? path.join(root, args.path) : root;
    if (!fs.existsSync(target)) {
        return JSON.stringify({ error: `Path not found: ${args.path}` });
    }

    const ig = buildIgnoreFilter();
    const basePath = args.path || "";

    const files = listDir(target, args.depth ?? 1, ig, basePath);
    return JSON.stringify({ files, path: args.path ?? "/", depth: args.depth ?? 1 });
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

    const fullPath = path.join(root, args.filePath);
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

/**
 * Registry of available tools.
 * Maps tool names to their definitions (for schema generation) and execute functions.
 */
export const toolRegistry: Record<string, Tool<any, any>> = {
    lsPath: {
        definition: lsPath_def,
        execute: lsPath_exec,
    },
    readFile: {
        definition: readFile_def,
        execute: readFile_exec,
    },
};
