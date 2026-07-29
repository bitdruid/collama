import { mailbox } from "../../agent/mailbox";

/**
 * Per-session storage for tool state that must outlive the chat history.
 *
 * A tool result only lives as long as the message that carries it — a summary rewrites
 * the history, and history policies mark old results stale. State a tool has to read back
 * later (the notepad's plan) therefore cannot live in the history alone. It is stored on
 * the session under the tool's own key and persisted with it.
 *
 * Tools address their key only; the owning session is always the run in flight, so a
 * mailbox wake can never write into the chat the user happens to be viewing.
 */
export interface ToolStateHost {
    read(sessionId: string, key: string): unknown;
    write(sessionId: string, key: string, value: unknown): void;
}

let host: ToolStateHost | null = null;

/** Registers the session-backed store; called once by the panel at startup. */
export function setToolStateHost(newHost: ToolStateHost): void {
    host = newHost;
}

/** State the tool stored for the running session, or null when it has none. */
export function readToolState<T>(key: string): T | null {
    const sessionId = mailbox.getRunSession();
    if (!host || !sessionId) {
        return null;
    }
    return (host.read(sessionId, key) as T) ?? null;
}

/** Stores the tool's state on the running session and schedules its save. */
export function writeToolState(key: string, value: unknown): void {
    const sessionId = mailbox.getRunSession();
    if (host && sessionId) {
        host.write(sessionId, key, value);
    }
}
