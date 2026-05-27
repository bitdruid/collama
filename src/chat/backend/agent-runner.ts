import * as vscode from "vscode";

import { Agent, AgentEvent, AgentMode } from "../../agent/agent";

import { ChatContext, ChatHistory } from "../../common/context-chat";

export interface AgentRunnerRunOptions {
    webview: vscode.Webview;
    messages: ChatContext;
    errorMessages?: () => ChatHistory[];
    onChunk: (chunk: string) => void;
    onEvent?: (event: AgentEvent) => void;
    mode?: AgentMode;
}

/**
 * Single chat-facing owner for agent execution, cancellation, timeout, and
 * error reporting. Chat and summarization should route agent work through this class.
 */
export class AgentRunner {
    private currentAgent: Agent | null = null;

    constructor() {}

    isRunning(): boolean {
        return this.currentAgent !== null;
    }

    cancel() {
        this.currentAgent?.cancel();
        this.currentAgent = null;
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
