import os from "os";
import path from "path";
import * as vscode from "vscode";
import { ToolHistoryPolicy } from "../common/context-chat";
import { userConfig } from "../config";
import { logAgent, logMsg } from "../logging";
import { analyse_def, analyse_exec } from "./tools/analyse";
import { decision_def, decision_exec } from "./tools/decision";
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
// import { fetch_def, fetch_exec } from "./tools/fetch";
import { gitDiff_def, gitDiff_exec, gitLog_def, gitLog_exec } from "./tools/git";
import { shell_def, shell_exec } from "./tools/shell";
export { resetAutoAcceptEdits };

export type ToolCategory = "explore" | "git" | "edit" | "analyse" | "shell"; // | "fetch";
export type { ToolHistoryPolicy };

export interface ToolAnswer<TOutput = unknown> {
    success: boolean;
    output?: TOutput;
    error?: string;
    message?: string;
}

export function toolSuccess<TOutput>(output: TOutput, message?: string): ToolAnswer<TOutput> {
    return { success: true, output, ...(message && { message }) };
}

export function toolError(error: string): ToolAnswer<never> {
    const caller = new Error().stack?.split("\n")[2]?.match(/at\s+(.*)\s/)?.[1] ?? "unknown";
    logAgent(`[${caller}-tool] ${error}`);
    return { success: false, error };
}

function formatToolTargetValue(key: string, raw: unknown): string {
    if (!raw) {
        return "";
    }
    const value = String(raw);
    // Truncate file paths for compact UI display.
    if (key === "filePath") {
        const parts = value.split("/");
        if (parts.length > 2) {
            return ".../" + parts.slice(-2).join("/");
        }
    }
    return value;
}

function formatGitRefTarget(raw: unknown): string {
    const value = formatToolTargetValue("branch", raw);
    return /^(?:[0-9a-f]{40}|[0-9a-f]{64})$/i.test(value) ? value.slice(0, 7) : value;
}

/**
 * Extracts the primary target value from tool args for UI display.
 * Uses the tool's `targetKey` to pick or format the right args, then truncates file paths.
 */
export function getToolTarget(toolName: string, args: Record<string, any>): string {
    const tool = toolRegistry[toolName];
    const key = tool?.targetKey;
    if (!key) {
        return "";
    }
    if (typeof key === "function") {
        return key(args);
    }
    return formatToolTargetValue(key, args[key]);
}

/**
 * Represents a tool that can be executed by the agent.
 * @template TInput The type of input arguments the tool accepts.
 * @template TData The type of data returned on success.
 */
export interface Tool<TInput = any, TData = unknown> {
    category: ToolCategory;
    historyPolicy: ToolHistoryPolicy;
    definition: {
        type: "function";
        function: {
            name: string;
            description?: string;
            parameters?: Record<string, any>;
        };
    };
    /** The args key or formatter whose value identifies this tool's primary target (shown in UI). */
    targetKey?: string | ((args: Record<string, any>) => string);
    execute: (input: TInput) => Promise<ToolAnswer<TData>>;
}

/**
 * Retrieves the definitions of all registered tools.
 * This formats the internal tool registry for external consumption (e.g., LLM function calling).
 *
 * @returns An array of tool definition objects containing type, name, description, and parameters.
 */
export function getToolDefinitions() {
    const filteredTools = getAllowedTools();

    return filteredTools.map((tool) => ({
        type: tool.definition.type,
        function: {
            name: tool.definition.function.name,
            description: tool.definition.function.description,
            parameters: tool.definition.function.parameters, // Pass Zod schema directly
        },
    }));
}

function getToolNames() {
    return getAllowedTools().map((tool) => tool.definition.function.name);
}

function getAllowedTools() {
    const tools = Object.values(toolRegistry);

    return tools.filter((tool) => {
        switch (tool.category) {
            case "explore":
            case "git":
            case "analyse":
                return true;
            case "edit":
                return userConfig.enableEditTools;
            case "shell":
                return userConfig.enableShellTool;
            default:
                return true;
        }
    });
}

export function getToolHistoryPolicy(toolName: string): ToolHistoryPolicy {
    return toolRegistry[toolName]?.historyPolicy ?? "keepAll";
}

/**
 * Executes a specific tool by name after validating the input arguments.
 *
 * @param name - The name of the tool to execute.
 * @param args - The arguments to pass to the tool (will be validated against the tool's schema).
 * @returns A JSON string representing the result of the tool execution.
 * @throws Error if the tool name is not found in the registry or if validation fails.
 */
export async function executeTool(name: string, args: unknown): Promise<string> {
    let response: ToolAnswer;

    const tool = toolRegistry[name];
    if (!tool) {
        response = toolError(`Unknown tool: ${name}. Available: ${getToolNames().join(", ")}`);
    } else if (!getAllowedTools().includes(tool)) {
        response = toolError(`Tool is disabled: ${name}. Available: ${getToolNames().join(", ")}`);
    } else {
        try {
            response = await tool.execute(args);
        } catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            logMsg(`Agent - tool error ${name}: ${msg}`);
            response = toolError(msg);
        }
    }

    return JSON.stringify(response);
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
 * Returns true if the given resolvedPath is within allowed temp directories.
 * Allowed: os.tmpdir()
 */
export function isWithinAllowedTemp(resolvedPath: string): boolean {
    const normalizedPath = path.resolve(resolvedPath);
    const tmpDir = os.tmpdir();
    const normalizedTmp = path.resolve(tmpDir);
    return normalizedPath === normalizedTmp || normalizedPath.startsWith(normalizedTmp + path.sep);
}

/**
 * Resolves a relative path against the workspace root and validates it doesn't escape.
 * Also allows explore tools to access os.tmpdir() files (e.g., from fetch tool).
 * Returns { root, fullPath } on success, or { error } (a ready-to-return JSON string) on failure.
 */
export function secureWorkspace(relPath: string, toolName: string): { root: string; fullPath: string; error: string } {
    const root = getWorkspaceRoot();
    if (!root) {
        logAgent(`[${toolName}] No workspace root`);
        return { root: "", fullPath: "", error: "No workspace root" };
    }
    const fullPath = path.resolve(root, relPath);
    if (isWithinRoot(root, fullPath)) {
        return { root, fullPath, error: "" };
    }
    // Explore tools are read-only and may inspect temporary files. Edit tools stay workspace-bound.
    if (toolRegistry[toolName]?.category === "explore" && isWithinAllowedTemp(fullPath)) {
        return { root: os.tmpdir(), fullPath, error: "" };
    }
    logAgent(`[${toolName}] Path must not escape the workspace root: ${relPath}`);
    return { root: "", fullPath: "", error: "Path must not escape the workspace root" };
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
        category: "explore",
        historyPolicy: "dedupeExactArgs",
        definition: read_def,
        targetKey: (args) => formatToolTargetValue("filePath", args.filePath),
        execute: read_exec,
    },
    grep: {
        category: "explore",
        historyPolicy: "dedupeExactArgs",
        definition: grep_def,
        targetKey: (args) => {
            const pattern = formatToolTargetValue("pattern", args.pattern);
            const glob = formatToolTargetValue("filePath", args.glob);
            return glob ? `${pattern} → ${glob}` : pattern;
        },
        execute: grep_exec,
    },
    glob: {
        category: "explore",
        historyPolicy: "dedupeExactArgs",
        definition: glob_def,
        targetKey: "pattern",
        execute: glob_exec,
    },
    gitLog: {
        category: "git",
        historyPolicy: "dedupeExactArgs",
        definition: gitLog_def,
        targetKey: (args) => {
            const mode = formatToolTargetValue("mode", args.mode ?? "commits");
            if (mode === "branches") {
                return args.includeRemote ? "branches (all)" : "branches";
            }
            const branch = formatGitRefTarget(args.branch ?? "HEAD");
            const filePath = formatToolTargetValue("filePath", args.filePath);
            const target = filePath ? `${branch} → ${filePath}` : branch;
            return `${mode}: ${target}`;
        },
        execute: gitLog_exec,
    },
    gitDiff: {
        category: "git",
        historyPolicy: "dropAll",
        definition: gitDiff_def,
        targetKey: (args) => {
            const from = formatGitRefTarget(args.fromCommit);
            const to = formatGitRefTarget(args.toCommit ?? "HEAD");
            const filePath = formatToolTargetValue("filePath", args.filePath);
            const base = from ? `${from}..${to}` : args.staged ? "staged" : "working-tree";
            return filePath ? `${base} → ${filePath}` : base;
        },
        execute: gitDiff_exec,
    },
    shell: {
        category: "shell",
        historyPolicy: "keepAll",
        definition: shell_def,
        targetKey: (args) => formatToolTargetValue("command", args.command),
        execute: shell_exec,
    },
    // fetch: {
    //     category: "fetch",
    //     historyPolicy: "dedupeExactArgs",
    //     definition: fetch_def,
    //     targetKey: (args) => formatToolTargetValue("url", args.url),
    //     execute: fetch_exec,
    // },
    edit: {
        category: "edit",
        historyPolicy: "keepAll",
        definition: edit_def,
        targetKey: (args) => formatToolTargetValue("filePath", args.filePath),
        execute: edit_exec,
    },
    create: {
        category: "edit",
        historyPolicy: "keepAll",
        definition: create_def,
        targetKey: (args) => formatToolTargetValue("filePath", args.filePath),
        execute: create_exec,
    },
    delete: {
        category: "edit",
        historyPolicy: "keepAll",
        definition: delete_def,
        targetKey: (args) => formatToolTargetValue("filePath", args.filePath),
        execute: delete_exec,
    },
    analyse: {
        category: "analyse",
        historyPolicy: "dropAll",
        definition: analyse_def,
        targetKey: (args) => {
            const mode = formatToolTargetValue("mode", args.mode);
            const file = formatToolTargetValue("filePath", args.filePath);
            return file ? `${mode}: ${file}` : mode;
        },
        execute: analyse_exec,
    },
    decision: {
        category: "edit",
        historyPolicy: "dropAll",
        definition: decision_def,
        targetKey: (args) => formatToolTargetValue("question", args.question),
        execute: decision_exec,
    },
};
