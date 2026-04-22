import * as vscode from "vscode";

import { Agent, AgentEvent } from "../agent/agent";
import { ChatContext } from "../common/context-chat";
import { buildExportData } from "./utils-back";

export interface AgentRunnerRunOptions {
    webview: vscode.Webview;
    messages: ChatContext;
    onChunk: (chunk: string) => void;
    onEvent?: (event: AgentEvent) => void;
}

/**
 * Single chat-facing owner for agent execution, cancellation, timeout, and
 * error reporting. Chat and summarization should route agent work through this class.
 */
export class AgentRunner {
    private currentAgent: Agent | null = null;

    constructor(private readonly extContext: vscode.ExtensionContext) {}

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
    async run({ webview, messages, onChunk, onEvent }: AgentRunnerRunOptions): Promise<void> {
        const agent = new Agent();
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
        } catch (error) {
            agent.cancel();
            const errorInfo = {
                message: error instanceof Error ? error.message : String(error),
                stack: error instanceof Error ? error.stack : undefined,
                name: error instanceof Error ? error.name : "Error",
            };
            const exportedChat = JSON.stringify(buildExportData(this.extContext, messages.getMessages()), null, 2);
            const errorMessage = `\n\n--- ERROR ---\n\nname:\n${errorInfo.name}\n\nmessage:\n${errorInfo.message}\n\nstack:\n${errorInfo.stack || "N/A"}`;
            webview.postMessage({
                type: "agent-error",
                exportedChat,
                errorMessage,
            });
        } finally {
            clearTimeout(timeout);
            if (this.currentAgent === agent) {
                this.currentAgent = null;
            }
        }
    }
}
