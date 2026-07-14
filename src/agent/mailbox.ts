import { ChatHistory } from "../common/context-chat";
import { logMsg } from "../logging";

// process-wide queue for out-of-band notifications (background shell exits, later sub-agents)
// every post fires the subscriber (agent-runner), which injects into the running session's
// next turn or wakes an idle run; session-tagged posts only deliver to their own session

export type MailboxSource = "shell" | "subagent" | "system";

// a queued notification; sessionId undefined = broadcast, deliverable anywhere
export interface MailboxMessage {
    source: MailboxSource;
    sessionId?: string;
    message: ChatHistory;
}

// cap so bursts with nothing consuming can't accumulate unbounded; oldest are dropped
const MAX_PENDING = 32;

class Mailbox {
    private pending: MailboxMessage[] = [];
    private wakeHandler: (() => void) | null = null;
    // session of the run in flight; producers capture it when starting background work
    private runSessionId: string | null = null;

    /** Enqueues a notification and fires the wake handler. */
    post(source: MailboxSource, content: string, sessionId?: string): void {
        this.pending.push({
            source,
            sessionId,
            // hidden: the notification exists for the LLM only - the user sees the reaction
            message: { role: "user", content, customKeys: { hidden: true } },
        });
        if (this.pending.length > MAX_PENDING) {
            this.pending.splice(0, this.pending.length - MAX_PENDING);
        }
        logMsg(`Mailbox: post from ${source} for session ${sessionId ?? "*"} (${this.pending.length} pending)`);

        // producers (e.g. a child-process close handler) must not blow up on host failures
        try {
            this.wakeHandler?.();
        } catch (error) {
            logMsg(`Mailbox: wake handler failed: ${error instanceof Error ? error.message : String(error)}`);
        }
    }

    /** Removes and returns the messages for the given session (own + broadcasts). */
    drainFor(sessionId: string): MailboxMessage[] {
        const deliver: MailboxMessage[] = [];
        const keep: MailboxMessage[] = [];
        for (const msg of this.pending) {
            (!msg.sessionId || msg.sessionId === sessionId ? deliver : keep).push(msg);
        }
        this.pending = keep;
        return deliver;
    }

    /** True when a pending message is deliverable to the given session. */
    hasPendingFor(sessionId: string): boolean {
        return this.pending.some((msg) => !msg.sessionId || msg.sessionId === sessionId);
    }

    /** Pins the session a run executes for; null when the run ends. */
    setRunSession(sessionId: string | null): void {
        this.runSessionId = sessionId;
    }

    /** Session of the run in flight, if any. */
    getRunSession(): string | null {
        return this.runSessionId;
    }

    /** Drops pending messages of a deleted session. */
    purgeSession(sessionId: string): void {
        this.pending = this.pending.filter((msg) => msg.sessionId !== sessionId);
    }

    /** Sets the host's wake handler, fired on every post; returns a disposer. */
    setWakeHandler(handler: () => void): () => void {
        this.wakeHandler = handler;
        return () => {
            if (this.wakeHandler === handler) {
                this.wakeHandler = null;
            }
        };
    }

    /** Drops all state. Called on extension deactivate. */
    clear(): void {
        this.pending = [];
        this.wakeHandler = null;
        this.runSessionId = null;
    }
}

/** Process-wide agent mailbox. */
export const mailbox = new Mailbox();
