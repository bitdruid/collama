import path from "path";
import * as vscode from "vscode";
import { logMsg } from "../logging";
import {
    createFile_def,
    createFile_exec,
    createFolder_def,
    createFolder_exec,
    editFile_def,
    editFile_exec,
} from "./tools/edit";
import {
    listFiles_def,
    listFiles_exec,
    lsPath_def,
    lsPath_exec,
    readFile_def,
    readFile_exec,
    searchFiles_def,
    searchFiles_exec,
} from "./tools/explore";
import {
    getCommitDiff_def,
    getCommitDiff_exec,
    getCommits_def,
    getCommits_exec,
    getWorkingTreeDiff_def,
    getWorkingTreeDiff_exec,
    listBranches_def,
    listBranches_exec,
} from "./tools/git";

/**
 * Represents a tool that can be executed by the agent.
 * @template TInput The type of input arguments the tool accepts.
 * @template TOutput The type of output the tool returns (usually a JSON string).
 */
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

/**
 * Retrieves the absolute file system path of the current workspace root.
 *
 * @returns The workspace root path as a string, or null if no workspace is open.
 */
export function getWorkspaceRoot(): string | null {
    const folders = vscode.workspace.workspaceFolders;
    if (!folders || folders.length === 0) {
        return null;
    }
    return folders[0].uri.fsPath;
}

/**
 * Returns true if the given resolvedPath is strictly within root (no traversal).
 */
export function isWithinRoot(root: string, resolvedPath: string): boolean {
    const normalizedRoot = path.resolve(root);
    const normalizedPath = path.resolve(resolvedPath);
    return normalizedPath === normalizedRoot || normalizedPath.startsWith(normalizedRoot + path.sep);
}

/**
 * Registry of available tools.
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
    getCommits: {
        definition: getCommits_def,
        execute: getCommits_exec,
    },
    getCommitDiff: {
        definition: getCommitDiff_def,
        execute: getCommitDiff_exec,
    },
    getWorkingTreeDiff: {
        definition: getWorkingTreeDiff_def,
        execute: getWorkingTreeDiff_exec,
    },
    listBranches: {
        definition: listBranches_def,
        execute: listBranches_exec,
    },
    editFile: {
        definition: editFile_def,
        execute: editFile_exec,
    },
    createFile: {
        definition: createFile_def,
        execute: createFile_exec,
    },
    createFolder: {
        definition: createFolder_def,
        execute: createFolder_exec,
    },
};
