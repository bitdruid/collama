import * as vscode from "vscode";

import { ChatContext, ChatHistory } from "../../../common/context-chat";
import { PromptConstructor } from "../../../common/prompt";
import { populateMsgTokens } from "../../../common/tokenizer";
import { AgentRunner } from "../agent-runner";
import { recomputeContextState } from "../context-state";

/**
 * Runs the agent on the given messages and returns the raw summary text.
 * @param agentRunner - The agent runner instance
 * @param webview - The VS Code webview for communication
 * @param sourceMessages - The messages to summarize
 * @returns The raw summary text or null if summarization failed
 */
async function summarizeText(
    agentRunner: AgentRunner,
    webview: vscode.Webview,
    sourceMessages: ChatHistory[],
): Promise<string | null> {
    const summary = PromptConstructor.summaryTemplate();
    const prompt = [summary.system, ...sourceMessages, summary.user];
    let text = "";
    const ok = await agentRunner.run({
        webview,
        messages: new ChatContext(prompt),
        onChunk: (chunk) => {
            text += chunk;
        },
        mode: "plain",
    });
    return ok ? text : null;
}

/**
 * Handles compressing the chat history into a summary.
 * @param agentRunner - The agent runner instance
 * @param webview - The VS Code webview for communication
 * @param sourceMessages - The messages to summarize
 * @param promptTemplate - The prompt template to use for summarization
 * @param label - The label for the summary (e.g., "Conversation" or "Turn")
 * @returns An array of chat history entries representing the summary, or null if summarization failed
 */
async function summarizeContent(
    agentRunner: AgentRunner,
    webview: vscode.Webview,
    sourceMessages: ChatHistory[],
    label: string,
): Promise<ChatHistory[] | null> {
    if (label === "Conversation") {
        const messages = new ChatContext(sourceMessages);
        const turnSummaries: string[] = [];
        let i = 0;
        let turnNum = 1;
        const totalTurns = messages.getTurnCount();
        while (i < sourceMessages.length) {
            const end = messages.getTurnEnd(i);
            if (end <= i) {
                break;
            }
            const turnMsgs = sourceMessages.slice(i, end);
            webview.postMessage({ type: "summary-progress", current: turnNum, total: totalTurns });
            const text = await summarizeText(agentRunner, webview, turnMsgs);
            if (text === null) {
                return null;
            }
            turnSummaries.push(`# Turn ${turnNum}\n${text}`);
            turnNum++;
            i = end;
        }
        const combined = turnSummaries.join("\n\n");
        const fenced = `\`\`\`Summary: ${label}\n${combined.replace(/`/g, "\\`")}\n\`\`\``;
        const result: ChatHistory[] = [
            { role: "user" as const, content: "Context summary:" },
            { role: "assistant" as const, content: fenced },
        ];
        await populateMsgTokens(result);
        return result;
    }

    if (label === "Turn") {
        const summary = PromptConstructor.summaryTemplate();
        const summaryPrompt = [summary.system, ...sourceMessages, summary.user];
        let summaryContent = "";

        const ok = await agentRunner.run({
            webview,
            messages: new ChatContext(summaryPrompt),
            onChunk: (chunk) => {
                summaryContent += chunk;
            },
            mode: "plain",
        });
        if (!ok) {
            return null;
        }

        const fenced = `\`\`\`Summary: ${label}\n${summaryContent.replace(/`/g, "\\`")}\n\`\`\``;
        const result: ChatHistory[] = [
            { role: "user" as const, content: "Context summary:" },
            { role: "assistant" as const, content: fenced },
        ];
        await populateMsgTokens(result);
        return result;
    }

    return null;
}

/**
 * Manages summary sessions for chat context compression.
 * @interface
 */
export interface SummarySessionManager {
    sessions: { id: string; messages: ChatContext; contextStartIndex: number }[];
    updateSession: (session: any, fn: (s: any) => void) => void;
    sendSessionsUpdate: () => void;
}

/**
 * Handles the request to summarize chat messages within a session.
 * Updates the session with the summarized content and posts progress/completion messages.
 * @param msg - The request message containing turnStart, turnEnd, and sessionId
 * @param webview - The VS Code webview for communication
 * @param sessionManager - The session manager instance
 * @param agentRunner - The agent runner instance
 */
export async function handleSummarizeRequest(
    msg: { turnStart: number; turnEnd: number; sessionId: string },
    webview: vscode.Webview,
    sessionManager: SummarySessionManager,
    agentRunner: AgentRunner,
) {
    const { turnStart, turnEnd, sessionId } = msg;
    const session = sessionManager.sessions.find((s) => s.id === sessionId)!;
    const isConversation = turnStart === 0 && turnEnd === session.messages.length();
    const label = isConversation ? "Conversation" : "Turn";
    const sourceMessages = session.messages.getMessages().slice(turnStart, turnEnd);
    const summarized = await summarizeContent(agentRunner, webview, sourceMessages, label);
    if (summarized === null) {
        webview.postMessage({ type: "summary-error", isConversation });
        webview.postMessage({
            type: "chat-complete",
            contextUsed: session.messages.sumTokensFrom(session.contextStartIndex),
        });
        return;
    }

    sessionManager.updateSession(session, (s) => {
        if (isConversation) {
            s.messages.setMessages(summarized);
        } else {
            s.messages.replaceRange(turnStart, turnEnd, summarized);
        }
    });
    const { contextStartIndex, contextUsed } = await recomputeContextState(session.messages);
    sessionManager.updateSession(session, (s) => {
        s.contextStartIndex = contextStartIndex;
    });

    const allMessages = isConversation ? summarized : session.messages.getMessages();
    webview.postMessage({
        type: "summary-complete",
        messages: allMessages,
        isConversation,
        contextStartIndex: session.contextStartIndex,
    });
    webview.postMessage({ type: "chat-complete", contextUsed });
    sessionManager.sendSessionsUpdate();
}
