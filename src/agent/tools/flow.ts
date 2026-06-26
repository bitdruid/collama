/**
 * Flow role: the agent's self-direction tools — they steer the run rather than
 * touch the workspace.
 *
 * - `decision`: ask the user to pick between options before committing to an edit.
 * - `memory`: persist/recall/forget durable facts across sessions.
 * - `notepad`: per-task working memory the agent overwrites as it reasons.
 *
 * @module flow-tools
 */

import { getWebview } from "../../chat/backend/utils";
import { deleteMemory, type MemoryScope, readMemory, writeMemory } from "../../common/memory";
import { logMsg } from "../../logging";
import { Tool, ToolAnswer, formatToolTargetValue, toolError, toolSuccess } from "../tools";

// decision
// decision
// decision

const _pending = new Map<string, (result: { value: string | null }) => void>();
let _idCounter = 0;

/**
 * Resolves a pending decision request.
 * Called when the webview sends a response to a previously issued decision request.
 * @param id - The unique identifier of the pending request.
 * @param value - The selected option value from the user.
 */
export function resolveToolDecision(id: string, value: string): void {
    const resolve = _pending.get(id);
    if (resolve) {
        _pending.delete(id);
        resolve({ value: value || null });
    }
}

/** Resolves all pending decision requests with null (used when the agent is cancelled). */
export function cancelAllPendingDecisions(): void {
    for (const [id, resolve] of _pending) {
        _pending.delete(id);
        resolve({ value: null });
    }
}

/**
 * Sends a decision request to the webview and awaits the user's selected option.
 * @param question - The question to present to the user.
 * @param options - An array of possible choices.
 * @returns A promise that resolves with the selected value, or `null` if unavailable/cancelled.
 */
function requestDecision(question: string, options: string[]): Promise<{ value: string | null }> {
    const webview = getWebview();
    if (!webview) {
        return Promise.resolve({ value: null });
    }
    const id = String(++_idCounter);
    return new Promise((resolve) => {
        _pending.set(id, resolve);
        webview.postMessage({ type: "tool-decision-request", id, question, options });
    });
}

/**
 * Executes the decision tool, prompting the user to pick between options.
 * @param args.question - The question to ask the user.
 * @param args.options - An array of mutually exclusive options (minimum 2).
 */
async function decision_exec(args: { question: string; options: string[] }): Promise<ToolAnswer<{ selected: string }>> {
    if (!args.question || typeof args.question !== "string") {
        return toolError("question is required");
    }
    if (!Array.isArray(args.options)) {
        return toolError("options must be an array");
    }
    if (!args.options.every((o) => typeof o === "string")) {
        logMsg(`Agent - decision-tool got non-string options: ${JSON.stringify(args.options)}`);
        return toolError("each entry in options must be a plain string, not an object");
    }

    logMsg(`Agent - use decision-tool question="${args.question}" options=${args.options.length}`);

    const { value } = await requestDecision(args.question, args.options);
    if (!value) {
        return toolError("No selection received from user");
    }
    return toolSuccess({ selected: value });
}

const decision_def = {
    type: "function" as const,
    function: {
        name: "decision",
        description:
            "Use to ask the user a question with multiple choices before you edit to verify the right way. " +
            "Minimum 2 options. For arguments use plain text only, no Markdown. An 'other' option is always provided. Don't add this.",
        parameters: {
            type: "object",
            properties: {
                question: {
                    type: "string",
                    description: "The question to show the user. Phrase clearly; the user sees this as a prompt.",
                },
                options: {
                    type: "array",
                    items: { type: "string" },
                    description:
                        "Short, mutually-exclusive options for the user to choose from. At least 2 entries. Each label should be self-explanatory with descriptive context.",
                },
            },
            required: ["question", "options"],
        },
    },
};

// memory
// memory
// memory

type MemoryAction = "write" | "read" | "delete";

function normalizeScope(_scope: unknown): MemoryScope {
    return "global";
}

/**
 * Executes the memory tool.
 * @param args.action - "write" stores a memory, "read" loads its full detail, "delete" removes it.
 * @param args.key - The memory's key (slugified on write).
 * @param args.short - Required for write: one-line summary shown in the prompt index.
 * @param args.long - Required for write: the full memory text.
 * @param args.scope - "global" (all projects) or "workspace" (this project, default).
 */
async function memory_exec(args: {
    action: MemoryAction;
    key: string;
    short?: string;
    long?: string;
    scope?: MemoryScope;
}): Promise<ToolAnswer<unknown>> {
    if (!args.key || typeof args.key !== "string") {
        return toolError("key is required");
    }
    const scope = normalizeScope(args.scope);

    switch (args.action) {
        case "write": {
            if (!args.short || typeof args.short !== "string") {
                return toolError("short is required for write (a one-line summary)");
            }
            if (!args.long || typeof args.long !== "string") {
                return toolError("long is required for write (the full memory text)");
            }
            const slug = await writeMemory(args.key, args.short, args.long, scope);
            logMsg(`Agent - memory write [${scope}] ${slug}`);
            return toolSuccess({ key: slug, scope }, `Stored memory '${slug}' (${scope}).`);
        }
        case "read": {
            const long = readMemory(args.key, args.scope ? scope : undefined);
            if (long === null) {
                return toolError(`No memory found for key '${args.key}'.`);
            }
            return toolSuccess({ key: args.key, long });
        }
        case "delete": {
            const removed = await deleteMemory(args.key, scope);
            if (!removed) {
                return toolError(`No memory found for key '${args.key}' in ${scope}.`);
            }
            logMsg(`Agent - memory delete [${scope}] ${args.key}`);
            return toolSuccess({ key: args.key, scope }, `Deleted memory '${args.key}' (${scope}).`);
        }
        default:
            return toolError(`Unknown action '${args.action}'. Use write, read or delete.`);
    }
}

const memory_def = {
    type: "function" as const,
    function: {
        name: "memory",
        description:
            "Persist usefull facts across sessions. Stored memories are listed in your system prompt as [scope] key — summary. " +
            "Use action 'write' to remember a fact (user preferences, project conventions, settings)." +
            "Use action 'read' to load a memory's full detail by key." +
            "Use action 'delete' to remove an outdated one." +
            "Do not store transient, conversation-only details.",
        parameters: {
            type: "object",
            properties: {
                action: {
                    type: "string",
                    enum: ["write", "read", "delete"],
                    description: "What to do: write, read or delete a memory.",
                },
                key: {
                    type: "string",
                    description: "Short identifier for the memory, e.g. 'deploy-process' or 'user-style'.",
                },
                short: {
                    type: "string",
                    description: "Write only: a concise one-line summary.",
                },
                long: {
                    type: "string",
                    description: "Write only: full memory information.",
                },
            },
            required: ["action", "key"],
        },
    },
};

// notepad
// notepad
// notepad

/** Keeps only non-empty strings from an unknown value (the model may send junk or non-arrays). */
function asStringArray(value: unknown): string[] {
    if (!Array.isArray(value)) {
        return [];
    }
    return value.filter((v): v is string => typeof v === "string" && v.trim() !== "");
}

/** Formats the notepad into the plain text shown to the user and read back by the model. */
function formatNotepad(facts: string[], todos: string[]): string {
    const lines: string[] = [];
    if (facts.length) {
        lines.push("Facts:", ...facts.map((f) => `- ${f}`));
    }
    if (todos.length) {
        if (lines.length) {
            lines.push("");
        }
        lines.push("Todos:", ...todos.map((t) => `- ${t}`));
    }
    return lines.join("\n");
}

/** The UI display body for the chat accordion — same rendering the model reads back. */
export function notepadBody(args: { facts?: unknown; todos?: unknown }): string {
    return formatNotepad(asStringArray(args.facts), asStringArray(args.todos));
}

/**
 * Executes the notepad tool: validates the entries and echoes the formatted notepad
 * back as the result, so it persists in the history as the current working memory.
 * @param args.facts - Conclusions/findings/decisions reached so far (full list, not a delta).
 * @param args.todos - Remaining steps to reach the goal (full list, not a delta).
 */
async function notepad_exec(args: {
    facts?: string[];
    todos?: string[];
}): Promise<ToolAnswer<{ facts: string[]; todos: string[] }>> {
    const facts = asStringArray(args.facts);
    const todos = asStringArray(args.todos);
    if (!facts.length && !todos.length) {
        return toolError("Provide at least one entry in 'facts' or 'todos'.");
    }
    logMsg(`Agent - notepad ${facts.length} facts, ${todos.length} todos`);
    return toolSuccess({ facts, todos }, formatNotepad(facts, todos));
}

const notepad_def = {
    type: "function" as const,
    function: {
        name: "notepad",
        description:
            "Store facts and todos for your current task. Use facts while you explore to persist conclusions. " +
            "Use todos to keep track of your next steps to accomplish. Each call REPLACES the whole notepad, so always pass the full list. " +
            "Update it as your understanding changes — especially before a tool call to prevent the lose of important knowledge. " +
            "Only for the current task/turn. For persistant reusable facts use memory tool.",
        parameters: {
            type: "object",
            properties: {
                facts: {
                    type: "array",
                    items: { type: "string" },
                    description: "Conclusions, findings and decisions reached so far. One per entry, plain text.",
                },
                todos: {
                    type: "array",
                    items: { type: "string" },
                    description: "Remaining steps needed to reach the goal. One per entry, plain text.",
                },
            },
            required: [],
        },
    },
};

// role registry
// role registry
// role registry

export const flowTools: Record<string, Tool> = {
    decision: {
        historyPolicy: "dropAll",
        definition: decision_def,
        toolTarget: (args) => formatToolTargetValue("question", args.question),
        execute: decision_exec,
    },
    memory: {
        historyPolicy: "dropAll",
        definition: memory_def,
        toolTarget: (args) => {
            const action = formatToolTargetValue("action", args.action);
            const key = formatToolTargetValue("key", args.key);
            return key ? `${action}: ${key}` : action;
        },
        execute: memory_exec,
    },
    notepad: {
        historyPolicy: "dropAll",
        definition: notepad_def,
        toolTarget: (args) => {
            const f = Array.isArray(args.facts) ? args.facts.length : 0;
            const t = Array.isArray(args.todos) ? args.todos.length : 0;
            const parts: string[] = [];
            if (f) {
                parts.push(`${f} fact${f === 1 ? "" : "s"}`);
            }
            if (t) {
                parts.push(`${t} todo${t === 1 ? "" : "s"}`);
            }
            return parts.join(" · ") || "empty";
        },
        execute: notepad_exec,
    },
};
