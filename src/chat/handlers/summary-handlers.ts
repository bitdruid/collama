import * as vscode from "vscode";

import { ChatContext, ChatHistory } from "../../common/context-chat";
import { chatSummarize_Template } from "../../common/prompt";
import { populateMsgTokens } from "../../common/tokenizer";
import { AgentRunner } from "../agent-runner";
import { recomputeContextState } from "../context-state";

/**
 * Runs the agent on the given messages and returns the raw summary text.
 */
async function summarizeText(
    agentRunner: AgentRunner,
    webview: vscode.Webview,
    sourceMessages: ChatHistory[],
): Promise<string | null> {
    const prompt = [...sourceMessages, { role: "user" as const, content: chatSummarize_Template }];
    let text = "";
    const ok = await agentRunner.run({
        webview,
        messages: new ChatContext(prompt),
        onChunk: (chunk) => {
            text += chunk;
        },
    });
    return ok ? text : null;
}

/**
 * Handles compressing the chat history into a summary.
 */
async function summarizeContent(
    agentRunner: AgentRunner,
    webview: vscode.Webview,
    sourceMessages: ChatHistory[],
    promptTemplate: string,
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

    const summaryPrompt = [...sourceMessages, { role: "user" as const, content: promptTemplate }];
    let summaryContent = "";

    const ok = await agentRunner.run({
        webview,
        messages: new ChatContext(summaryPrompt),
        onChunk: (chunk) => {
            summaryContent += chunk;
        },
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

export interface SummarySessionManager {
    sessions: { id: string; messages: ChatContext; contextStartIndex: number }[];
    updateSession: (session: any, fn: (s: any) => void) => void;
    sendSessionsUpdate: () => void;
}

/**
 * Handles compressing the chat history into a summary.
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
    const summarized = await summarizeContent(agentRunner, webview, sourceMessages, chatSummarize_Template, label);
    if (summarized === null) {
        webview.postMessage({ type: "summary-error", isConversation });
        webview.postMessage({ type: "chat-complete", contextUsed: session.messages.sumTokensFrom(session.contextStartIndex) });
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
