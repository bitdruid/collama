/**
 * Cheap, dependency-free token estimation shared by the extension host and the webview.
 *
 * Kept separate from {@link ./tokenizer} so the browser bundle can import it without pulling
 * in `@microsoft/tiktokenizer` (which needs node `fs`/`path` and cannot bundle for the webview).
 */

/**
 * Estimates token count from a unit count (characters or bytes) at ~4 units per token.
 * Cheap and synchronous — use to gate oversized input before the exact, blocking encode.
 */
export function estTokens(units: number): number {
    return Math.ceil(units / 4);
}

export const EXTENSION_HARD_TOKEN_CAP = 10_000;
