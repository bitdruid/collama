import * as vscode from "vscode";

import { ChatContext, ChatHistory, sumMsgTokens } from "../../common/context-chat";
import { chatSummarize_Template } from "../../common/prompt";
import { populateMsgTokens } from "../../common/tokenizer";
import { AgentRunner } from "../agent-runner";

/**
 * Runs the agent on the given messages and returns the raw summary text.
 */
async function summarizeText(
    agentRunner: AgentRunner,
    webview: vscode.Webview,
    sourceMessages: ChatHistory[],
): Promise<string> {
    const prompt = [...sourceMessages, { role: "user" as const, content: chatSummarize_Template }];
    let text = "";
    await agentRunner.run({
        webview,
        messages: new ChatContext(prompt),
        onChunk: (chunk) => {
            text += chunk;
        },
    });
    return text;
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
): Promise<ChatHistory[]> {
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

    await agentRunner.run({
        webview,
        messages: new ChatContext(summaryPrompt),
        onChunk: (chunk) => {
            summaryContent += chunk;
        },
    });

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

    sessionManager.updateSession(session, (s) => {
        if (isConversation) {
            s.messages.setMessages(summarized);
            s.contextStartIndex = 0;
        } else {
            s.messages.replaceRange(turnStart, turnEnd, summarized);
        }
    });

    const allMessages = isConversation ? summarized : session.messages.getMessages();
    webview.postMessage({ type: "summary-complete", messages: allMessages, isConversation });
    webview.postMessage({ type: "chat-complete", contextUsed: sumMsgTokens(allMessages) });
    sessionManager.sendSessionsUpdate();
}
