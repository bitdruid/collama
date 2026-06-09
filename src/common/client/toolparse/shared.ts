import { nextToolId } from "../../litellmfix";
import { logMsg } from "../../../logging";
import type { ToolCall } from "../types";

/** A parsed turn: the recovered tool calls and the content with their blob stripped. */
export type ParseResult = { toolCalls: ToolCall[]; content: string };

/** Builds a tool call in the shared shape, with arguments as a JSON string. */
export function makeToolCall(name: string, args: Record<string, unknown>): ToolCall {
    return { id: nextToolId(), type: "function", function: { name, arguments: JSON.stringify(args) } };
}

/** Coerces a raw parameter string to JSON when it looks like JSON, else keeps the trimmed string. */
export function coerceValue(raw: string): unknown {
    const trimmed = raw.trim();
    try {
        return JSON.parse(trimmed);
    } catch {
        return trimmed;
    }
}

/** Logs which family/format recovered a text-emitted tool call, and the call names. */
export function toolparseLogging(format: string, hit: ParseResult): void {
    const names = hit.toolCalls.map((tc) => tc.function.name).join(", ");
    logMsg(`Toolparser - ${format} matched ${hit.toolCalls.length} call(s): ${names}`);
}
