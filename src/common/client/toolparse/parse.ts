import { parseJson } from "./json";
import { parseMarkup } from "./markup";
import type { ParseResult } from "./shared";

/**
 * Extracts tool calls a model emitted as plain text instead of via the provider's
 * native tool-call field. Tries the markup family first (Qwen3, GLM, MiniMax,
 * DeepSeek), then the JSON family (Hermes, Mistral). Markup runs first because its
 * <tool_call>-wrapped dialects would otherwise be probed as JSON and fail.
 *
 * Only call this when native toolCalls are empty AND tools were offered this turn,
 * so a model writing `<tool_call>` inside an explanation isn't mistaken for a call.
 */
export function parseTextToolCalls(content: string): ParseResult {
    return parseMarkup(content) ?? parseJson(content) ?? { toolCalls: [], content };
}
