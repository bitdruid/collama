/**
 * Flow role: the agent's self-direction tools — they steer the run rather than
 * touch the workspace.
 *
 * - `decision`: ask the user to pick between options before committing to an edit.
 * - `memory`: persist/recall/forget durable facts across sessions.
 * - `notepad`: per-task plan and facts the agent updates in deltas as it reasons.
 *
 * @module flow-tools
 */

import { readToolState, writeToolState } from "../../chat/backend/tool-state";
import { getWebview } from "../../chat/backend/utils";
import { deleteMemory, readMemory, writeMemory, type MemoryScope } from "../../common/memory";
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
    if (typeof args.question !== "string" || !args.question.trim()) {
        return toolError("question is required");
    }
    if (!Array.isArray(args.options)) {
        return toolError("options must be an array");
    }
    if (!args.options.every((o) => typeof o === "string")) {
        logMsg(`Agent - decision-tool got non-string options: ${JSON.stringify(args.options)}`);
        return toolError("each entry in options must be a plain string, not an object");
    }
    // blank labels pass the string check but render as unclickable empty buttons
    const options = args.options.map((o) => o.trim()).filter((o) => o !== "");
    if (options.length < 2) {
        logMsg(`Agent - decision-tool got ${options.length} usable options: ${JSON.stringify(args.options)}`);
        return toolError("options needs at least 2 non-empty labels - blank entries are dropped, so write them out");
    }

    logMsg(`Agent - use decision-tool question="${args.question}" options=${options.length}`);

    const { value } = await requestDecision(args.question, options);
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
            additionalProperties: false,
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
            additionalProperties: false,
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

export const NOTEPAD_KEY = "notepad";

interface PlanStep {
    text: string;
    done: boolean;
}

export interface NotepadState {
    plan: PlanStep[];
    facts: string[];
}

/** Keeps only non-empty strings; the model may send a bare string, junk entries or nothing. */
function asStringList(value: unknown): string[] {
    const items = Array.isArray(value) ? value : [value];
    return items.filter((v): v is string => typeof v === "string" && v.trim() !== "").map((v) => v.trim());
}

/** Bullet or numbering a model puts in front of a step: "- ", "2. ", "[x] ". */
const STEP_MARKER = /^\s*(?:[-*•]|\d+[.)]|\[[ xX>]?\])\s*/;

/**
 * Steps out of whatever shape the plan arrived in. Models often send the whole plan as one
 * bulleted string instead of one entry per step - split it back apart, and drop the markers so
 * the render's own numbering is not doubled. Only a string that starts with a marker is split
 * mid-line, so a step that merely contains a dash stays intact.
 */
function asPlanList(value: unknown): string[] {
    return asStringList(value)
        .flatMap((s) =>
            s.includes("\n") ? s.split("\n") : STEP_MARKER.test(s) ? s.split(/\s+(?=(?:[-*•]|\d+[.)])\s)/) : [s],
        )
        .map((s) => s.replace(STEP_MARKER, "").trim())
        .filter((s) => s !== "");
}

/** 1-based positions the model addresses steps and facts by; tolerates "2" and a bare number. */
function asIndexList(value: unknown): number[] {
    const items = Array.isArray(value) ? value : [value];
    return items.map(Number).filter((n) => Number.isInteger(n) && n > 0);
}

/** Renders the pad as the plain text the user sees and the model reads back. */
export function renderNotepad(pad: NotepadState): string {
    const lines: string[] = [];
    if (pad.plan.length) {
        // the first open step is the one in progress - derived, so it can't contradict `done`
        const current = pad.plan.findIndex((s) => !s.done);
        const mark = (s: PlanStep, i: number) => (s.done ? "x" : i === current ? ">" : " ");
        lines.push("Plan:", ...pad.plan.map((s, i) => `[${mark(s, i)}] ${i + 1}. ${s.text}`));
    }
    if (pad.facts.length) {
        if (lines.length) {
            lines.push("");
        }
        lines.push("Facts:", ...pad.facts.map((f, i) => `${i + 1}. ${f}`));
    }
    return lines.join("\n") || "empty";
}

/** Rendered pad of a session, or null when it holds nothing worth carrying over. */
export function notepadSnapshot(toolState: Record<string, unknown> | undefined): string | null {
    const pad = toolState?.[NOTEPAD_KEY] as NotepadState | undefined;
    if (!pad?.plan?.length && !pad?.facts?.length) {
        return null;
    }
    return renderNotepad({ plan: pad.plan ?? [], facts: pad.facts ?? [] });
}

/**
 * Executes the notepad tool: applies the deltas to the session's pad and echoes the whole
 * pad back, so the model reads the merged state without ever resending it.
 * @param args.plan - Sets or replaces the step list, clearing the facts of the finished task.
 * @param args.done - Step numbers to tick off.
 * @param args.fact - Fact(s) to append.
 * @param args.forget - Fact numbers to drop.
 */
async function notepad_exec(args: {
    plan?: unknown;
    done?: unknown;
    fact?: unknown;
    forget?: unknown;
}): Promise<ToolAnswer<NotepadState>> {
    // a sent field is intent, so `plan: []` clears the plan - only an absent one means "leave it"
    const setsPlan = args.plan !== undefined;
    const plan = asPlanList(args.plan);
    const added = asStringList(args.fact);
    const done = asIndexList(args.done);
    const forget = asIndexList(args.forget);

    // rebuilt rather than mutated in place: a pad read back from disk may be partial
    const stored = readToolState<NotepadState>(NOTEPAD_KEY);
    const pad: NotepadState = { plan: stored?.plan ?? [], facts: stored?.facts ?? [] };

    // no fields at all is a read - the pad outlives the history, so it can always be fetched back
    if (!setsPlan && !added.length && !done.length && !forget.length) {
        return toolSuccess(pad, renderNotepad(pad));
    }
    // a new plan is a new task - its findings are the old task's, and the model never drops them itself
    if (setsPlan) {
        pad.plan = plan.map((text) => ({ text, done: false }));
        pad.facts = [];
    }
    for (const i of done) {
        if (pad.plan[i - 1]) {
            pad.plan[i - 1].done = true;
        }
    }
    // drop before appending, so `forget` numbers still refer to the pad the model saw
    if (forget.length) {
        const dropped = new Set(forget.map((i) => i - 1));
        pad.facts = pad.facts.filter((_, i) => !dropped.has(i));
    }
    pad.facts.push(...added);

    writeToolState(NOTEPAD_KEY, pad);
    const doneCount = pad.plan.filter((s) => s.done).length;
    logMsg(`Agent - notepad ${doneCount}/${pad.plan.length} steps, ${pad.facts.length} facts`);
    return toolSuccess(pad, renderNotepad(pad));
}

const notepad_def = {
    type: "function" as const,
    function: {
        name: "notepad",
        description:
            "Your working pad for the current implementation task. A step plan with reasoning facts. " +
            "The pad persists - so only send changes. You always receive the full updated pad. " +
            "Record a conclusion with 'fact' the moment you reach it and before user faced output; " +
            "an unrecorded conclusion is lost. " +
            "Start a task by setting 'plan', then always tick each steps off with 'done' immediatly. " +
            "Call with no arguments to read the pad back if you lost sight of it. " +
            "Never overwrite an unfinished plan except it was wrong or you got adviced." +
            "For facts worth keeping across sessions use the memory tool.",
        parameters: {
            type: "object",
            additionalProperties: false,
            properties: {
                plan: {
                    type: "array",
                    items: { type: "string" },
                    description:
                        "One array entry per step, no bullets or numbering - never the whole plan as one string. " +
                        "Sets or replaces the whole step list and clears the facts of the finished task. " +
                        "Send only when starting a task or when the plan itself changes, not to tick steps off. " +
                        "An empty list clears the pad.",
                },
                done: {
                    type: "array",
                    items: { type: "integer" },
                    description: "Step numbers to mark complete, as shown in the returned plan.",
                },
                fact: {
                    type: "string",
                    description:
                        "One thing you learned about the code or a decision you made about the implementation. " +
                        "Plain text. No task, no plan step, no progress, no recap, not what you are about to do. " +
                        "If it replaces an earlier fact, 'forget' the old one in the same call.",
                },
                forget: {
                    type: "array",
                    items: { type: "integer" },
                    description:
                        "Fact numbers to drop, as shown in the returned pad. Use when a fact was wrong or stale.",
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
        historyPolicy: "evalSuperseded",
        definition: notepad_def,
        // the whole delta, one call is one entry - the fact's text belongs in the accordion body
        toolTarget: (args) => {
            const parts: string[] = [];
            const added = asStringList(args.fact);
            const forget = asIndexList(args.forget);
            if (args.plan !== undefined) {
                const plan = asPlanList(args.plan);
                parts.push(plan.length ? `plan ${plan.length} steps` : "plan cleared");
            }
            const done = asIndexList(args.done);
            if (done.length) {
                parts.push(`done ${done.map((i) => `#${i}`).join(" ")}`);
            }
            if (added.length) {
                parts.push(`+${added.length} fact${added.length === 1 ? "" : "s"}`);
            }
            if (forget.length) {
                parts.push(`-${forget.length} fact${forget.length === 1 ? "" : "s"}`);
            }
            return parts.join(" · ");
        },
        execute: notepad_exec,
    },
};
