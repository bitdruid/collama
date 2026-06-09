import type { ChatResult, ToolCall } from "../types";
import { jsonSentinels } from "./json";
import { markupSentinels } from "./markup";
import { parseTextToolCalls } from "./parse";

/** Opening markers that begin a text-emitted tool call, across every family. */
const OPEN_SENTINELS = [...new Set([...markupSentinels, ...jsonSentinels])];

/**
 * Streaming gate that withholds a text-emitted tool-call blob from the UI.
 *
 * The webview renders the assistant turn from streamed chunks alone, so a blob
 * that reaches `onChunk` is both shown and stored. The gate streams normal prose
 * untouched, but once the accumulated text hits an opening sentinel it stops
 * emitting; it also holds back a trailing partial sentinel split across chunks.
 *
 * Suppression is reversible: on a real tool call the caller simply never drains,
 * keeping the blob hidden; if parsing finds nothing (or native calls arrived),
 * the caller drains the buffer so the user still sees the held-back text.
 */
export class ToolCallStreamGate {
    private emitted = 0;
    private suppressing = false;

    /** Feeds the full accumulated content; returns the slice that is safe to emit now. */
    feed(full: string): string {
        if (this.suppressing) {
            return "";
        }
        const idx = this.earliestSentinel(full);
        if (idx >= 0) {
            this.suppressing = true;
            const safe = full.slice(this.emitted, idx);
            this.emitted = idx;
            return safe;
        }
        const boundary = full.length - this.partialHold(full);
        const safe = full.slice(this.emitted, boundary);
        this.emitted = boundary;
        return safe;
    }

    /** Returns everything held back so far and marks it emitted. Used when no tool call was confirmed. */
    drain(full: string): string {
        const rest = full.slice(this.emitted);
        this.emitted = full.length;
        return rest;
    }

    /** Index of the first complete opening sentinel at or after the emit cursor, or -1. */
    private earliestSentinel(full: string): number {
        let earliest = -1;
        for (const s of OPEN_SENTINELS) {
            const idx = full.indexOf(s, this.emitted);
            if (idx >= 0 && (earliest < 0 || idx < earliest)) {
                earliest = idx;
            }
        }
        return earliest;
    }

    /** Length of the trailing run of `full` that is a prefix of some sentinel (a split-mid-stream guard). */
    private partialHold(full: string): number {
        let hold = 0;
        for (const s of OPEN_SENTINELS) {
            const max = Math.min(s.length - 1, full.length);
            for (let k = max; k > hold; k--) {
                if (full.endsWith(s.slice(0, k))) {
                    hold = k;
                    break;
                }
            }
        }
        return hold;
    }
}

/**
 * A gated output channel (content or reasoning) accumulated during streaming.
 * `gate` is null when the turn offered no tools, in which case the helpers below
 * are pass-throughs.
 */
export interface GateChannel {
    gate: ToolCallStreamGate | null;
    raw: string;
    emit?: (chunk: string) => void;
}

/**
 * Streams one chunk through a channel's gate, emitting only the text that is safe
 * to show now. With no gate (no tools offered) the chunk passes straight through.
 */
export function emitGated(
    gate: ToolCallStreamGate | null,
    accumulated: string,
    chunk: string,
    emit?: (chunk: string) => void,
): void {
    const safe = gate ? gate.feed(accumulated) : chunk;
    if (safe) {
        emit?.(safe);
    }
}

/** Flushes any text a channel's gate withheld, so nothing is lost when it held no tool call. */
function drainChannel(ch: GateChannel): void {
    if (!ch.gate) {
        return;
    }
    const held = ch.gate.drain(ch.raw);
    if (held) {
        ch.emit?.(held);
    }
}

/**
 * Builds the final ChatResult after a stream ends. When tools were offered (gates
 * present) and no native tool calls arrived, it recovers a text-emitted tool call
 * from whichever channel holds it — content or reasoning, since some models (e.g.
 * Qwen3 MTP) leak the blob into thinking — keeping that channel's blob suppressed
 * and draining the other so no withheld text is lost.
 */
export function finalizeChat(
    content: string,
    toolCalls: ToolCall[],
    contentCh: GateChannel,
    reasoningCh: GateChannel,
): ChatResult {
    if (!contentCh.gate || !reasoningCh.gate) {
        return { content, toolCalls };
    }
    if (toolCalls.length === 0) {
        const fromContent = parseTextToolCalls(content);
        if (fromContent.toolCalls.length > 0) {
            drainChannel(reasoningCh);
            return { content: fromContent.content, toolCalls: fromContent.toolCalls };
        }
        const fromReasoning = parseTextToolCalls(reasoningCh.raw);
        if (fromReasoning.toolCalls.length > 0) {
            drainChannel(contentCh);
            return { content, toolCalls: fromReasoning.toolCalls };
        }
    }
    drainChannel(contentCh);
    drainChannel(reasoningCh);
    return { content, toolCalls };
}
