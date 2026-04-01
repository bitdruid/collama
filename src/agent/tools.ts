import path from "path";
import * as vscode from "vscode";
import { userConfig } from "../config";
import { logAgent, logMsg } from "../logging";
import { getDiagnostics_def, getDiagnostics_exec } from "./tools/analyse";
import {
    create_def,
    create_exec,
    delete_def,
    delete_exec,
    edit_def,
    edit_exec,
    resetAutoAcceptEdits,
} from "./tools/edit";
import { glob_def, glob_exec, grep_def, grep_exec, read_def, read_exec } from "./tools/explore";
import { gitDiff_def, gitDiff_exec, gitLog_def, gitLog_exec } from "./tools/git";
export { resetAutoAcceptEdits };

/**
 * Extracts the primary target value from tool args for UI display.
 * Uses the tool's `targetKey` to pick the right arg, then truncates file paths.
 */
export function getToolTarget(toolName: string, args: Record<string, any>): string {
    const tool = toolRegistry[toolName];
    const key = tool?.targetKey;
    if (!key) {
        return "";
    }
    const raw = args[key];
    if (!raw) {
        return "";
    }
    const value = String(raw);
    // Truncate file paths: .../<parent>/<file>
    if (key !== "pattern" && key !== "branch") {
        const parts = value.split("/");
        if (parts.length > 2) {
            return ".../" + parts.slice(-2).join("/");
        }
    }
    return value;
}

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
    /** The args key whose value identifies this tool's primary target (shown in UI). */
    targetKey?: string;
    execute: (input: TInput) => Promise<TOutput>;
}

/**
 * Retrieves the definitions of all registered tools.
 * This formats the internal tool registry for external consumption (e.g., LLM function calling).
 *
 * @returns An array of tool definition objects containing type, name, description, and parameters.
 */
export function getToolDefinitions() {
    const tools = Object.values(toolRegistry);

    // Filter out edit tools if enableEditTools is false (read-only mode)
    const filteredTools = userConfig.enableEditTools
        ? tools
        : tools.filter((tool) => !isEditTool(tool.definition.function.name));

    return filteredTools.map((tool) => ({
        type: tool.definition.type,
        function: {
            name: tool.definition.function.name,
            description: tool.definition.function.description,
            parameters: tool.definition.function.parameters, // Pass Zod schema directly
        },
    }));
}

/**
 * Checks if a tool is an edit tool (modifies files).
 * Edit tools are: edit, create, delete
 */
function isEditTool(toolName: string): boolean {
    const editTools = ["edit", "create", "delete"];
    return editTools.includes(toolName);
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
 * Resolves a relative path against the workspace root and validates it doesn't escape.
 * Returns { root, fullPath } on success, or { error } (a ready-to-return JSON string) on failure.
 */
export function secureWorkspace(relPath: string, toolName: string): { root: string; fullPath: string; error: string } {
    const root = getWorkspaceRoot();
    if (!root) {
        logAgent(`[${toolName}] No workspace root`);
        return { root: "", fullPath: "", error: JSON.stringify({ error: "No workspace root" }) };
    }
    const fullPath = path.resolve(root, relPath);
    if (!isWithinRoot(root, fullPath)) {
        logAgent(`[${toolName}] Path must not escape the workspace root: ${relPath}`);
        return { root: "", fullPath: "", error: JSON.stringify({ error: "Path must not escape the workspace root" }) };
    }
    return { root, fullPath, error: "" };
}

/**
 * Shows a quick-pick confirmation prompt with the given action label and a Cancel option.
 * @param action - The label for the confirm button (e.g. "Accept", "Delete", "Revert").
 * @param placeHolder - The message shown in the quick-pick.
 * @returns True if the user selected the action, false if they cancelled.
 */
export async function confirmAction(action: string, placeHolder: string): Promise<boolean> {
    const choice = await vscode.window.showQuickPick([action, "Cancel"], {
        placeHolder,
        canPickMany: false,
        ignoreFocusOut: true,
    });
    return choice === action;
}

/**
 * Registry of available tools.
 */
export const toolRegistry: Record<string, Tool<any, any>> = {
    read: {
        definition: read_def,
        targetKey: "filePath",
        execute: read_exec,
    },
    grep: {
        definition: grep_def,
        targetKey: "pattern",
        execute: grep_exec,
    },
    glob: {
        definition: glob_def,
        targetKey: "pattern",
        execute: glob_exec,
    },
    gitLog: {
        definition: gitLog_def,
        targetKey: "branch",
        execute: gitLog_exec,
    },
    gitDiff: {
        definition: gitDiff_def,
        targetKey: "filePath",
        execute: gitDiff_exec,
    },
    // bash: {
    //     definition: bash_def,
    //     targetKey: "command",
    //     execute: bash_exec,
    // },
    // powershell: {
    //     definition: powershell_def,
    //     targetKey: "command",
    //     execute: powershell_exec,
    // },
    edit: {
        definition: edit_def,
        targetKey: "filePath",
        execute: edit_exec,
    },
    create: {
        definition: create_def,
        targetKey: "filePath",
        execute: create_exec,
    },
    delete: {
        definition: delete_def,
        targetKey: "filePath",
        execute: delete_exec,
    },
    getDiagnostics: {
        definition: getDiagnostics_def,
        targetKey: "filePath",
        execute: getDiagnostics_exec,
    },
};
