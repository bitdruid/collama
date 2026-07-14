import { structuredPatch } from "diff";
import os from "os";
import path from "path";
import * as vscode from "vscode";
import { ToolHistoryPolicy } from "../common/context-chat";
import { userConfig } from "../config";
import { logAgent, logMsg } from "../logging";
import { resetAutoAcceptEdits } from "./tools/confirm";
import { editTools } from "./tools/edit";
import { exploreTools } from "./tools/explore";
import { flowTools, notepadBody } from "./tools/flow";
import { gitTools } from "./tools/git";
import { notebookTools } from "./tools/notebook";
import { searchTools } from "./tools/search";
import { shellTools } from "./tools/shell";
export { resetAutoAcceptEdits };

export type { ToolHistoryPolicy };

/**
 * Tool roles: the semantic partition of the registry, independent of user settings.
 * Each role's membership is owned by its role file (the keys of its exported group);
 * here we only derive the name lists the orchestrators reason over. Manipulation spans
 * two files (edit + notebook), so it is composed here.
 * A future sub-agent orchestrator composes these per agent role; the user-facing
 * orchestrator (getAllowedTools) composes them per user settings.
 */
const manipulationTools: Record<string, Tool> = { ...editTools, ...notebookTools };
const EXPLORATION_TOOLS = Object.keys(exploreTools);
const MANIPULATION_TOOLS = Object.keys(manipulationTools);
const SHELL_TOOLS = Object.keys(shellTools);
const FLOW_TOOLS = Object.keys(flowTools);
const GIT_TOOLS = Object.keys(gitTools);

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
    return { success: false, error };
}

export function formatToolTargetValue(key: string, raw: unknown): string {
    if (!raw) {
        return "";
    }
    const value = String(raw);
    // Truncate file paths for compact UI display.
    if (key === "filePath") {
        const parts = value.split("/");
        if (parts.length > 3) {
            return "... /" + parts.slice(-3).join("/");
        }
    }
    return value;
}

export function formatGitRefTarget(raw: unknown): string {
    const value = formatToolTargetValue("branch", raw);
    return /^(?:[0-9a-f]{40}|[0-9a-f]{64})$/i.test(value) ? value.slice(0, 7) : value;
}

/**
 * Extracts the primary target value from tool args for UI display.
 * Uses the tool's `toolTarget` to pick or format the right args, then truncates file paths.
 */
export function getToolTarget(toolName: string, args: Record<string, any>): string {
    const tool = toolRegistry[toolName];
    const key = tool?.toolTarget;
    if (!key) {
        return "";
    }
    if (typeof key === "function") {
        return key(args);
    }
    return formatToolTargetValue(key, args[key]);
}

/**
 * Renders an edit tool's oldString → newString as the changed lines only
 * (`+`/`-`/context, no file header or hunk markers) so the chat accordion highlights it as a `diff` block.
 */
function buildEditDiff(filePath: string, oldString: string, newString: string): string {
    const { hunks } = structuredPatch(filePath, filePath, oldString, newString, "", "", { context: 3 });
    return hunks.map((h) => h.lines.join("\n")).join("\n");
}

/**
 * Represents a tool that can be executed by the agent.
 * @template TInput The type of input arguments the tool accepts.
 * @template TData The type of data returned on success.
 */
export interface Tool<TInput = any, TData = unknown> {
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
    toolTarget?: string | ((args: Record<string, any>) => string);
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

/**
 * User-facing orchestrator: maps the current user settings onto the tool roles.
 * Lite-mode and the per-role enable flags live here and nowhere else.
 */
function getAllowedTools(): Tool[] {
    const names = [
        ...EXPLORATION_TOOLS, // always on
        ...(userConfig.enableEditTools ? MANIPULATION_TOOLS : []),
        ...(userConfig.enableShellTool ? SHELL_TOOLS : []),
        ...(userConfig.liteMode || !userConfig.enableShellTool ? GIT_TOOLS : []),
        ...FLOW_TOOLS.filter(isFlowEnabled),
    ];
    return names.map((n) => {
        const tool = toolRegistry[n];
        if (!tool) {
            throw new Error(`Role list references unknown tool "${n}".`);
        }
        return tool;
    });

    // Flow gate: memory not for lite-mode; decision only if edit or shell enabled
    function isFlowEnabled(tool: string): boolean {
        if (tool === "memory" || tool === "notepad") {
            return !userConfig.liteMode;
        }
        if (tool === "decision") {
            return userConfig.enableEditTools || userConfig.enableShellTool;
        }
        return true;
    }
}

export function getToolHistoryPolicy(toolName: string): ToolHistoryPolicy {
    return toolRegistry[toolName]?.historyPolicy ?? "keepAll";
}

/**
 * Executes a specific tool by name after validating the input arguments.
 *
 * @param name - The name of the tool to execute.
 * @param args - The arguments to pass to the tool; required keys are validated against the tool's schema.
 * @returns A JSON string representing the result of the tool execution.
 */
export async function executeTool(name: string, args: unknown): Promise<string> {
    let response: ToolAnswer;

    const tool = toolRegistry[name];
    const missingArg = tool && findMissingRequiredArg(tool, args);
    if (!tool) {
        response = toolError(`Unknown tool: ${name}. Available: ${getToolNames().join(", ")}`);
    } else if (!getAllowedTools().includes(tool)) {
        response = toolError(`Tool is disabled: ${name}. Available: ${getToolNames().join(", ")}`);
    } else if (missingArg) {
        response = toolError(`Missing required argument '${missingArg}' for tool: ${name}`);
    } else {
        try {
            response = await tool.execute(args);
        } catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            logMsg(`Agent - tool error ${name}: ${msg}`);
            response = toolError(msg);
        }
    }

    if (!response.success) {
        logAgent(`[${name}-tool] ${response.error}`);
    }

    return JSON.stringify(response);
}

/**
 * Returns the name of the first required parameter (per the tool's schema) missing from args,
 * or null if all are present. Gives the model a precise, correctable error instead of a
 * downstream `undefined` crash.
 */
function findMissingRequiredArg(tool: Tool, args: unknown): string | null {
    const required = tool.definition.function.parameters?.required;
    if (!Array.isArray(required) || typeof args !== "object" || args === null) {
        return null;
    }
    return required.find((key) => (args as Record<string, unknown>)[key] === undefined) ?? null;
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

export interface NormalizedToolArgs {
    /** Args re-serialized with `filePath` canonicalized to an absolute path (for history / execution / evalOutdated). */
    argsJson: string;
    /** The parsed args, with `filePath` already canonicalized. */
    args: Record<string, any>;
    /** UI display body for the chat accordion: a unified diff for edits, else a `key:\nvalue` dump. */
    body: string;
}

/**
 * Parses a tool call's raw JSON arguments once and derives everything downstream needs:
 * a canonical `filePath` (absolute, so the same file has one representation everywhere), the
 * parsed args for execution, and the display body for the UI. Throws on unparseable JSON.
 */
export function normalizeToolArgs(toolName: string, argsJson: string): NormalizedToolArgs {
    const args = JSON.parse(argsJson);
    const relPath = typeof args.filePath === "string" ? args.filePath : "";
    if (relPath) {
        args.filePath = path.resolve(getWorkspaceRoot() ?? "", relPath);
        argsJson = JSON.stringify(args);
    }
    const body =
        toolName === "edit"
            ? `${buildEditDiff(relPath, args.oldString ?? "", args.newString ?? "")}`
            : toolName === "notepad"
              ? notepadBody(args)
              : Object.entries(args)
                    .map(([k, v]) => `${k}:\n${v}`)
                    .join("\n");
    return { argsJson, args, body };
}

/**
 * Resolves a relative path against the workspace root and validates it doesn't escape.
 * Also allows explore tools to access os.tmpdir() files (e.g., shell's spilled output).
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
    if (EXPLORATION_TOOLS.includes(toolName) && isWithinAllowedTemp(fullPath)) {
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
 * Registry of available tools, assembled from the per-role groups.
 */
export const toolRegistry: Record<string, Tool<any, any>> = {
    ...exploreTools,
    ...manipulationTools,
    ...shellTools,
    ...flowTools,
    ...gitTools,
};
