import { logAgent } from "../logging";
import { ToolCall } from "./types-llm";

let _toolIdSeq = 0;
export function nextToolId(): string {
    return `t${Date.now().toString(36)}${(_toolIdSeq++).toString(36)}`;
}

/**
 * Accumulates streamed tool-call deltas into complete tool calls.
 * Handles LiteLLM issue: duplicate id on every chunk, and
 * summary chunk that re-sends complete args after streaming.
 * See https://github.com/BerriAI/litellm/issues/20480
 */
export class ToolCallAccumulator {
    private pending = new Map<number, { id: string; name: string; args: string }>();

    /**
     * Processes a single tool-call delta from a streaming chunk.
     */
    push(tc: { index?: number; id?: string; function?: { name?: string; arguments?: string } }) {
        const idx = tc.index ?? 0;
        if (!this.pending.has(idx)) {
            this.pending.set(idx, { id: "", name: "", args: "" });
        }
        const entry = this.pending.get(idx)!;

        // id: keep first non-empty (LiteLLM re-sends on every chunk)
        if (tc.id && !entry.id) {
            entry.id = tc.id;
        }
        // name: keep first non-empty
        if (tc.function?.name && !entry.name) {
            entry.name = tc.function.name;
        }
        // args: append, but drop LiteLLM summary duplicates
        if (tc.function?.arguments) {
            const incoming = tc.function.arguments;
            if (this.isSummaryChunk(entry.args, incoming)) {
                logAgent(`[tool] idx=${idx} dropped summary (${incoming.length} chars)`);
            } else {
                entry.args += incoming;
            }
        }

        // logAgent(`[tool] idx=${idx} id=${entry.id} name=${entry.name} args=${entry.args}`);
    }

    /**
     * Returns the assembled tool calls. Call once after the stream ends.
     */
    build(): ToolCall[] {
        const toolCalls: ToolCall[] = Array.from(this.pending.values()).map((tc) => ({
            id: nextToolId(),
            type: "function" as const,
            function: { name: tc.name, arguments: this.sanitizeArgs(tc.args) },
        }));

        if (toolCalls.length > 0) {
            logAgent(`[tool_calls] ${JSON.stringify(toolCalls)}`);
        }
        return toolCalls;
    }

    /**
     * Detects the LiteLLM/vLLM summary chunk that re-sends complete args
     * after streaming. A chunk is a summary only if the accumulated args
     * are already valid JSON and the incoming chunk is also valid JSON
     * of equal or greater length.
     */
    private isSummaryChunk(accumulated: string, incoming: string): boolean {
        if (accumulated.length === 0 || incoming.length < accumulated.length) {
            return false;
        }
        try {
            JSON.parse(accumulated);
        } catch {
            return false;
        }
        try {
            JSON.parse(incoming);
            return true;
        } catch {
            return false;
        }
    }

    /**
     * Safety net: if accumulated args aren't valid JSON (e.g. a summary chunk
     * slipped through), extracts the last valid JSON object from the string.
     */
    private sanitizeArgs(raw: string): string {
        const args = raw || "{}";
        try {
            JSON.parse(args);
            return args;
        } catch {
            for (let i = args.length - 1; i > 0; i--) {
                if (args[i] === "{") {
                    const tail = args.substring(i);
                    try {
                        JSON.parse(tail);
                        logAgent(`[tool_sanitize] ${args} → ${tail}`);
                        return tail;
                    } catch {
                        /* keep searching */
                    }
                }
            }
            logAgent(`[tool_sanitize] failed: ${args}`);
            return args;
        }
    }
}
