/**
 * Recovers tool calls that models emit as plain text (markup or JSON dialects)
 * instead of via the provider's native tool-call field, and gates the streamed
 * output so the raw blob never reaches the UI. Each family lives in its own
 * registry (markup.ts, json.ts); add a model by appending one entry there.
 */
export { parseTextToolCalls } from "./parse";
export { emitGated, finalizeChat, ToolCallStreamGate } from "./gate";
export type { GateChannel } from "./gate";
export type { ParseResult } from "./shared";
