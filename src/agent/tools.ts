import { structuredPatch } from "diff";
import path from "path";
import * as vscode from "vscode";
import { ToolHistoryPolicy } from "../common/context-chat";
import { sysConfig, userConfig } from "../config";
import { logAgent, logMsg } from "../logging";
import { editTools } from "./tools/edit";
import { exploreTools } from "./tools/explore";
import { flowTools } from "./tools/flow";
import { gitTools } from "./tools/git";
import { shellTools } from "./tools/shell";
import { resetAutoAcceptEdits } from "./tools/utils/confirm";
import { getWorkspaceRoot } from "./tools/utils/workspace";
import { websearchTools } from "./tools/websearch";
export { resetAutoAcceptEdits };

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
 * Tool roles: the semantic partition of the registry, independent of user settings.
 * Each role's membership is owned by its role file (the keys of its exported group);
 * `enabled` is the only place user settings decide what the model may see, and
 * `filter` narrows a role per-tool. A future sub-agent orchestrator composes the
 * same groups per agent role.
 */
const ROLES: { tools: Record<string, Tool>; enabled: () => boolean; filter?: (name: string) => boolean }[] = [
    { tools: exploreTools, enabled: () => true },
    { tools: editTools, enabled: () => userConfig.enableEditTools },
    { tools: shellTools, enabled: () => userConfig.enableShellTool },
    { tools: gitTools, enabled: () => userConfig.liteMode || !userConfig.enableShellTool },
    { tools: websearchTools, enabled: () => sysConfig.searxngConnected }, // only with a reachable searxng server
    { tools: flowTools, enabled: () => true, filter: isFlowEnabled },
];

/** Flow gate: memory/notepad not for lite-mode; decision only if edit or shell enabled. */
function isFlowEnabled(name: string): boolean {
    if (name === "memory" || name === "notepad") {
        return !userConfig.liteMode;
    }
    if (name === "decision") {
        return userConfig.enableEditTools || userConfig.enableShellTool;
    }
    return true;
}

/**
 * The tool orchestrator. Owns the role table above, derives the registry from it so the
 * two can never drift, and answers everything the agent asks about tools: which ones the
 * model may see, their definitions, execution, UI target, and history policy.
 */
class ToolRegistry {
    /** Every tool that exists, regardless of config. */
    readonly all: Record<string, Tool<any, any>> = Object.assign({}, ...ROLES.map((role) => role.tools));

    /** The tools the current config exposes to the model. */
    allowed(): Tool[] {
        return ROLES.filter((role) => role.enabled()).flatMap((role) =>
            Object.entries(role.tools)
                .filter(([name]) => !role.filter || role.filter(name))
                .map(([, tool]) => tool),
        );
    }

    /** Allowed tools formatted for external consumption (LLM function calling). */
    definitions() {
        return this.allowed().map((tool) => ({
            type: tool.definition.type,
            function: {
                name: tool.definition.function.name,
                description: tool.definition.function.description,
                parameters: tool.definition.function.parameters,
            },
        }));
    }

    /** Arrow property so it stays callable when passed as a bare reference. */
    historyPolicy = (name: string): ToolHistoryPolicy => this.all[name]?.historyPolicy ?? "keepAll";

    /**
     * Extracts the primary target value from tool args for UI display.
     * Uses the tool's `toolTarget` to pick or format the right args.
     */
    target(name: string, args: Record<string, any>): string {
        const key = this.all[name]?.toolTarget;
        if (!key) {
            return "";
        }
        return typeof key === "function" ? key(args) : formatToolTargetValue(key, args[key]);
    }

    /**
     * Executes a tool by name after validating the input arguments.
     * @returns A JSON string representing the result of the tool execution.
     */
    async execute(name: string, args: unknown): Promise<string> {
        let response: ToolAnswer;

        const tool = this.all[name];
        const missingArg = tool && findMissingRequiredArg(tool, args);
        const available = () => this.allowed().map((t) => t.definition.function.name).join(", ");
        if (!tool) {
            response = toolError(`Unknown tool: ${name}. Available: ${available()}`);
        } else if (!this.allowed().includes(tool)) {
            response = toolError(`Tool is disabled: ${name}. Available: ${available()}`);
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
}

export const toolRegistry = new ToolRegistry();

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
            ? buildEditDiff(relPath, args.oldString ?? "", args.newString ?? "")
            : Object.entries(args)
                  .map(([k, v]) => `${k}:\n${v}`)
                  .join("\n");
    return { argsJson, args, body };
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

