import { toolparseLogging, makeToolCall, type ParseResult } from "./shared";
import type { ToolCall } from "../types";

/**
 * JSON family: models that emit `{"name": …, "arguments": …}` objects, only the
 * wrapper/sentinel differs. Each format captures the JSON text (object or array
 * of calls) via `blockRe` group 1; the engine JSON-parses and normalises it.
 *
 *   trigger   — substring that must be present for this dialect
 *   sentinels — opening markers that begin the blob in a stream (for the gate)
 *   blockRe   — global; group 1 = JSON text, an object or an array of call objects
 */
interface JsonFormat {
    name: string;
    trigger: string;
    sentinels: string[];
    blockRe: RegExp;
}

function parseJsonFormat(content: string, fmt: JsonFormat): ParseResult | null {
    if (!content.includes(fmt.trigger)) {
        return null;
    }
    const toolCalls: ToolCall[] = [];
    fmt.blockRe.lastIndex = 0;
    let match: RegExpExecArray | null;
    while ((match = fmt.blockRe.exec(content))) {
        let parsed: any;
        try {
            parsed = JSON.parse(match[1].trim());
        } catch {
            return null; // not JSON in the wrapper — let another format try
        }
        for (const obj of Array.isArray(parsed) ? parsed : [parsed]) {
            if (obj && typeof obj.name === "string") {
                toolCalls.push(makeToolCall(obj.name, obj.arguments ?? obj.parameters ?? {}));
            }
        }
    }
    if (toolCalls.length === 0) {
        return null;
    }
    return { toolCalls, content: content.replace(fmt.blockRe, "").trim() };
}

const jsonFormats: JsonFormat[] = [
    // Hermes / Nous, and Qwen's JSON mode: one object per <tool_call> wrapper.
    {
        name: "hermes-json",
        trigger: "<tool_call>",
        sentinels: ["<tool_call>"],
        blockRe: /<tool_call>\s*(\{[\s\S]*?\})\s*<\/tool_call>/g,
    },
    // Mistral: a [TOOL_CALLS] marker followed by a JSON array of calls, terminal in
    // the generation. Captured greedily to end-of-output; trailing prose breaks it.
    {
        name: "mistral-json",
        trigger: "[TOOL_CALLS]",
        sentinels: ["[TOOL_CALLS]"],
        blockRe: /\[TOOL_CALLS\]\s*(\[[\s\S]*\])/g,
    },
];

/** Opening markers for the JSON family, for the stream gate. */
export const jsonSentinels = [...new Set(jsonFormats.flatMap((f) => f.sentinels))];

/** Tries each JSON dialect in order; returns the first match, or null. */
export function parseJson(content: string): ParseResult | null {
    for (const fmt of jsonFormats) {
        const hit = parseJsonFormat(content, fmt);
        if (hit && hit.toolCalls.length > 0) {
            toolparseLogging(fmt.name, hit);
            return hit;
        }
    }
    return null;
}
