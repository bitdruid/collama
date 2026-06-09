import { coerceValue, toolparseLogging, makeToolCall, type ParseResult } from "./shared";
import type { ToolCall } from "../types";

/**
 * Markup family: models that emit tool calls as key/value tags rather than JSON
 * (Qwen3, GLM, MiniMax, DeepSeek). Every dialect is the same loop driven by
 * different regexes, so each is just data:
 *
 *   trigger   — substring that must be present (disambiguates; e.g. GLM uses
 *               <arg_key> because <tool_call> is shared with function-xml)
 *   sentinels — opening markers that begin the blob in a stream (for the gate;
 *               distinct from `trigger`, e.g. GLM's is <tool_call>)
 *   callRe    — global; group 1 = function name, group 2 = parameter body
 *   paramRe   — global, run over the call body; group 1 = parameter key
 *   decode    — turns a paramRe match into the typed parameter value
 *   stripRe   — global; regions removed from the displayed content
 */
interface MarkupFormat {
    name: string;
    trigger: string;
    sentinels: string[];
    callRe: RegExp;
    paramRe: RegExp;
    decode: (param: RegExpExecArray) => unknown;
    stripRe: RegExp;
}

function parseMarkupFormat(content: string, fmt: MarkupFormat): ParseResult | null {
    if (!content.includes(fmt.trigger)) {
        return null;
    }
    const toolCalls: ToolCall[] = [];
    fmt.callRe.lastIndex = 0;
    let call: RegExpExecArray | null;
    while ((call = fmt.callRe.exec(content))) {
        const args: Record<string, unknown> = {};
        fmt.paramRe.lastIndex = 0;
        let param: RegExpExecArray | null;
        while ((param = fmt.paramRe.exec(call[2]))) {
            args[param[1].trim()] = fmt.decode(param);
        }
        toolCalls.push(makeToolCall(call[1].trim(), args));
    }
    if (toolCalls.length === 0) {
        return null;
    }
    return { toolCalls, content: content.replace(fmt.stripRe, "").trim() };
}

const markupFormats: MarkupFormat[] = [
    // Qwen3-Coder / MoE: <function=read><parameter=filePath>a.py</parameter></function>,
    // optionally wrapped in <tool_call> … </tool_call>.
    {
        name: "function-xml",
        trigger: "<function=",
        sentinels: ["<tool_call>", "<function="],
        callRe: /<function=([^>\s]+)>([\s\S]*?)<\/function>/g,
        paramRe: /<parameter=([^>\s]+)>([\s\S]*?)<\/parameter>/g,
        decode: (p) => coerceValue(p[2]),
        stripRe: /<function=[\s\S]*?<\/function>|<\/?tool_call>/g,
    },
    // GLM 4.6 / 4.7 / Flash: <tool_call>read\n<arg_key>k</arg_key><arg_value>v</arg_value></tool_call>.
    // Bare function name on line 1, then alternating key/value tags. Argument-less
    // calls have no <arg_key> marker and fall through unparsed.
    {
        name: "glm",
        trigger: "<arg_key>",
        sentinels: ["<tool_call>"],
        callRe: /<tool_call>\s*([^\n<]+?)\s*\n([\s\S]*?)<\/tool_call>/g,
        paramRe: /<arg_key>([\s\S]*?)<\/arg_key>\s*<arg_value>([\s\S]*?)<\/arg_value>/g,
        decode: (p) => coerceValue(p[2]),
        stripRe: /<tool_call>[\s\S]*?<\/tool_call>/g,
    },
    // MiniMax M2 / M2.5 / M2.7: <minimax:tool_call><invoke name="read">
    // <parameter name="filePath">a.py</parameter></invoke></minimax:tool_call>.
    {
        name: "minimax",
        trigger: "<minimax:tool_call>",
        sentinels: ["<minimax:tool_call>"],
        callRe: /<invoke name="([^"]+)">([\s\S]*?)<\/invoke>/g,
        paramRe: /<parameter name="([^"]+)">([\s\S]*?)<\/parameter>/g,
        decode: (p) => coerceValue(p[2]),
        stripRe: /<minimax:tool_call>[\s\S]*?<\/minimax:tool_call>/g,
    },
    // DeepSeek V4 / Flash "DSML": <｜DSML｜tool_calls><｜DSML｜invoke name="read">
    // <｜DSML｜parameter name="filePath" string="true">a.py</｜DSML｜parameter>… .
    // The string="true|false" flag decides raw-text vs JSON; ｜DSML｜ is one token.
    {
        name: "deepseek-dsml",
        trigger: "｜DSML｜tool_calls",
        sentinels: ["<｜DSML｜tool_calls"],
        callRe: /<｜DSML｜invoke name="([^"]+)">([\s\S]*?)<\/｜DSML｜invoke>/g,
        paramRe: /<｜DSML｜parameter name="([^"]+)" string="(true|false)">([\s\S]*?)<\/｜DSML｜parameter>/g,
        decode: (p) => (p[2] === "true" ? p[3] : coerceValue(p[3])),
        stripRe: /<｜DSML｜tool_calls>[\s\S]*?<\/｜DSML｜tool_calls>/g,
    },
];

/** Opening markers for the markup family, for the stream gate. */
export const markupSentinels = [...new Set(markupFormats.flatMap((f) => f.sentinels))];

/**
 * Tries each markup dialect in order; returns the first match, or null. The four
 * are disjoint by `trigger`, so order is not load-bearing.
 */
export function parseMarkup(content: string): ParseResult | null {
    for (const fmt of markupFormats) {
        const hit = parseMarkupFormat(content, fmt);
        if (hit && hit.toolCalls.length > 0) {
            toolparseLogging(fmt.name, hit);
            return hit;
        }
    }
    return null;
}
