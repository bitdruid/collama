import { ChatHistory } from "../common/context-chat";
import Tokenizer from "../common/utils-common";

/**
 * Session summary for UI display (excludes full message history).
 */
export interface SessionSummary {
    id: string;
    title: string;
    createdAt: number;
    updatedAt: number;
}

/**
 * Maps a session to a summary object for UI display.
 *
 * @param session - The session object with id, title, createdAt, updatedAt properties.
 * @returns A summary object suitable for sending to the webview.
 */
export function mapSessionToSummary<T extends SessionSummary>(session: T): SessionSummary {
    return {
        id: session.id,
        title: session.title,
        createdAt: session.createdAt,
        updatedAt: session.updatedAt,
    };
}

/**
 * Maps an array of sessions to summary objects for UI display.
 *
 * @param sessions - Array of session objects.
 * @returns Array of summary objects.
 */
export function mapSessionsToSummaries<T extends SessionSummary>(sessions: T[]): SessionSummary[] {
    return sessions.map(mapSessionToSummary);
}

/** Cache of token counts keyed by message content (avoids re-tokenizing unchanged messages). */
const tokenCache = new Map<string, number>();

/** Max content length to use as a direct cache key. Longer content uses a truncated key. */
const CACHE_KEY_MAX_LEN = 4096;

function tokenCacheKey(content: string): string {
    if (content.length <= CACHE_KEY_MAX_LEN) {
        return content;
    }
    // For very long messages, use length + head + tail as key
    return `${content.length}:${content.slice(0, 512)}…${content.slice(-512)}`;
}

/**
 * Calculates the total token usage for a chat session's messages.
 * Uses a per-content cache to avoid re-tokenizing unchanged messages.
 *
 * @param messages - The array of chat history messages.
 * @returns The total token count.
 */
export async function calculateContextUsage(messages: ChatHistory[]): Promise<number> {
    let total = 0;
    for (const msg of messages) {
        const key = tokenCacheKey(msg.content);
        const cached = tokenCache.get(key);
        if (cached !== undefined) {
            total += cached;
        } else {
            const count = await Tokenizer.calcTokens(msg.content);
            tokenCache.set(key, count);
            total += count;
        }
    }
    return total;
}

/**
 * Sanitizes chat messages for persistence and display.
 *
 * Removes any temporary loading flags and ensures that empty assistant messages
 * display a fallback text.
 *
 * @param messages - The array of chat history messages to sanitize.
 * @returns A new array of messages without loading flags and with fallback content where appropriate.
 */
export function sanitizeMessages(messages: ChatHistory[]): ChatHistory[] {
    return messages.map((m) => {
        const { loading, ...rest } = m as ChatHistory & { loading?: boolean };
        // If assistant message is empty and was loading, show fallback
        if (rest.role === "assistant" && !rest.content && loading) {
            return { ...rest, content: "No response received." };
        }
        return rest;
    });
}
