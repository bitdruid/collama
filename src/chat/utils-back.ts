import { ChatHistory } from "../common/context-chat";

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
