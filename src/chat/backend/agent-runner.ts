import { randomUUID } from "node:crypto";
import * as vscode from "vscode";

import { Agent, AgentEvent, AgentMode } from "../../agent/agent";
import { mailbox } from "../../agent/mailbox";

import { ChatContext, ChatHistory } from "../../common/context-chat";
import { userConfig } from "../../config";
import { logMsg } from "../../logging";

export interface AgentRunnerRunOptions {
    webview: vscode.Webview;
    messages: ChatContext;
    errorMessages?: () => ChatHistory[];
    onChunk: (chunk: string) => void;
    onEvent?: (event: AgentEvent) => void;
    mode?: AgentMode;
}

// what an exclusive operation runs for
export type RunKind = "chat" | "summary" | "wake";

// panel-side callbacks for mailbox delivery: the shown session + the wake-run body
export interface MailboxHost {
    getActiveSessionId(): string | null;
    runWake(sessionId: string, notes: ChatHistory[]): Promise<void>;
}

/**
 * Single owner for agent execution, cancellation, and mailbox delivery. Every operation
 * that drives the agent (chat, summary, wake) claims the runner via {@link runExclusive}
 * — one at a time. Mailbox posts are injected mid-run or wake the host when idle.
 */
export class AgentRunner {
    private currentAgent: Agent | null = null;
    private active: { kind: RunKind; done: Promise<void> } | null = null;
    private cancelRequested = false;
    private host: MailboxHost | null = null;

    constructor() {}

    /** Registers the host callbacks and subscribes to mailbox posts. */
    attachMailbox(host: MailboxHost): void {
        this.host = host;
        mailbox.setWakeHandler(() => this.checkMailbox());
    }

    isRunning(): boolean {
        return this.active !== null;
    }

    /** Kind of the operation in flight, or null when idle. */
    activeKind(): RunKind | null {
        return this.active?.kind ?? null;
    }

    /** True once the user cancelled the operation in flight. */
    wasCancelled(): boolean {
        return this.cancelRequested;
    }

    /**
     * Claims the runner for one exclusive operation; false when another is in flight.
     * Pins the mailbox run session for producers/cancel and re-checks the mailbox on finish.
     */
    async runExclusive(kind: RunKind, sessionId: string, fn: () => Promise<void>): Promise<boolean> {
        if (this.active) {
            return false;
        }
        let finish!: () => void;
        this.active = { kind, done: new Promise<void>((resolve) => (finish = resolve)) };
        this.cancelRequested = false;
        mailbox.setRunSession(sessionId);
        try {
            await fn();
        } finally {
            mailbox.setRunSession(null);
            this.active = null;
            finish();
            // deliver messages that landed mid-run; quiet after a user cancel
            if (!this.cancelRequested) {
                this.checkMailbox();
            }
        }
        return true;
    }

    /** Routes pending mailbox messages: inject into the running session's loop, else wake when idle. */
    checkMailbox(): void {
        if (!this.host || !userConfig.agenticMode) {
            return;
        }
        if (this.active) {
            // mid-run delivery only into a live agent loop, never into a summarization
            const agent = this.currentAgent;
            const runSession = mailbox.getRunSession();
            if (runSession && agent && this.active.kind !== "summary" && mailbox.hasPendingFor(runSession)) {
                for (const note of mailbox.drainFor(runSession)) {
                    agent.injectMessage(note.message.content, note.message.customKeys, randomUUID());
                }
            }
            return;
        }
        const sessionId = this.host.getActiveSessionId();
        if (!sessionId || !mailbox.hasPendingFor(sessionId)) {
            return;
        }
        void this.wakeRun(sessionId);
    }

    // claim the runner for a wake and hand the pending notes to the host
    private async wakeRun(sessionId: string): Promise<void> {
        await this.runExclusive("wake", sessionId, async () => {
            try {
                const notes = mailbox.drainFor(sessionId).map((m) => m.message);
                if (notes.length === 0) {
                    return;
                }
                logMsg(`Mailbox: waking session ${sessionId} with ${notes.length} notification(s)`);
                await this.host!.runWake(sessionId, notes);
            } catch (error) {
                // fire-and-forget entry: never let a wake failure escape to the producer
                logMsg(`Mailbox: wake failed: ${error instanceof Error ? error.message : String(error)}`);
            }
        });
    }

    cancel() {
        this.cancelRequested = true;
        this.currentAgent?.cancel();
        this.currentAgent = null;
    }

    /** Cancels the operation in flight and resolves once it wound down. */
    async cancelAndWait(): Promise<void> {
        const active = this.active;
        if (!active) {
            return;
        }
        this.cancel();
        await active.done;
    }

    /** Queues a user message into the running agent loop without interrupting it. */
    injectMessage(content: string, customKeys: Parameters<Agent["injectMessage"]>[1], id: string) {
        this.currentAgent?.injectMessage(content, customKeys, id);
    }

    /** Removes a still-queued interjection by id (no-op if it already drained). */
    cancelInjected(id: string) {
        this.currentAgent?.cancelInjected(id);
    }

    /**
     * Runs the agent with a 60s startup timeout. The timeout fires only if the agent
     * never produces a first chunk or event; any inbound activity clears it. Callers
     * are responsible for sending `chat-complete` after post-processing.
     */
    async run({
        webview,
        messages,
        errorMessages,
        onChunk,
        onEvent,
        mode = "default",
    }: AgentRunnerRunOptions): Promise<boolean> {
        const agent = new Agent(mode);
        this.currentAgent = agent;
        const timeout = setTimeout(() => {
            agent.cancel();
            webview.postMessage({ type: "chat-complete", contextUsed: messages.sumTokens() });
        }, 60000);

        try {
            await agent.work(
                messages,
                (chunk) => {
                    clearTimeout(timeout);
                    onChunk(chunk);
                },
                (event) => {
                    clearTimeout(timeout);
                    onEvent?.(event);
                },
            );
            return true;
        } catch (error) {
            agent.cancel();
            const errorInfo = {
                message: error instanceof Error ? error.message : String(error),
                stack: error instanceof Error ? error.stack : undefined,
                name: error instanceof Error ? error.name : "Error",
            };
            // Export live session history before the caller prunes the failed run tail.
            const exportedChat = JSON.stringify(errorMessages?.() ?? messages.getMessages(), null, 2);
            const errorMessage = `\n\n--- ERROR ---\n\nname:\n${errorInfo.name}\n\nmessage:\n${errorInfo.message}\n\nstack:\n${errorInfo.stack || "N/A"}`;
            webview.postMessage({
                type: "agent-error",
                exportedChat,
                errorMessage,
            });
            return false;
        } finally {
            clearTimeout(timeout);
            if (this.currentAgent === agent) {
                this.currentAgent = null;
            }
        }
    }
}
