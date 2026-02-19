import fs from "fs";
import Ignore from "ignore";
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
        throw new Error(`Unknown tool: ${name}`);
    }
    return await tool.execute(args);
}

function getWorkspaceRoot(): string | null {
    const folders = vscode.workspace.workspaceFolders;
    if (!folders || folders.length === 0) {
        return null;
    }
    return folders[0].uri.fsPath;
}

export const getRepoTree_def = {
    type: "function" as const,
    function: {
        name: "getRepoTree",
        description: "Get the folder structure of the current workspace.",
        parameters: {},
    },
};
async function getRepoTree_exec(): Promise<string> {
    logMsg(`Agent - tool use getRepoTree`);
    const ignore = Ignore();
    const root = getWorkspaceRoot();

    if (!root) {
        return JSON.stringify({ files: [], root: null });
    }

    const ignorePath = path.join(root, ".gitignore");
    if (fs.existsSync(ignorePath)) {
        ignore.add(fs.readFileSync(ignorePath, "utf-8"));
    }

    const allFiles = fs.readdirSync(root);
    const filteredFiles = allFiles.filter((f) => !ignore.ignores(f));

    return JSON.stringify({ files: filteredFiles, root });
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
async function readFile_exec(args: { filePath: string; startLine?: number; endLine?: number }): Promise<string> {
    const root = getWorkspaceRoot();
    if (!root) {
        throw new Error("No workspace root");
    }

    const fullPath = path.join(root, args.filePath);
    if (!fs.existsSync(fullPath)) {
        throw new Error(`File not found: ${args.filePath}`);
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

export const toolRegistry: Record<string, Tool<any, any>> = {
    getRepoTree: {
        definition: getRepoTree_def,
        execute: getRepoTree_exec,
    },
    readFile: {
        definition: readFile_def,
        execute: readFile_exec,
    },
};
