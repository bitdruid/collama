import * as vscode from "vscode";

import { ChatContext, ChatHistory } from "../../../common/context-chat";
import { PromptConstructor } from "../../../common/prompt";
import { populateMsgTokens } from "../../../common/tokenizer";
import { notepadSnapshot } from "../../../agent/tools/flow";
import { AgentRunner } from "../agent-runner";
import { recomputeContextState } from "../context-state";

type SummaryLabel = "Conversation" | "Turn";

// runs the agent over the messages and returns the raw summary text, null when it failed
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

// wraps summary text into the history pair it is stored as: hidden notice + fenced assistant reply
async function buildSummaryEntry(text: string, label: SummaryLabel): Promise<ChatHistory[]> {
    const fenced = `\`\`\`Summary: ${label}\n${text.replace(/`/g, "\\`")}\n\`\`\``;
    const result: ChatHistory[] = [
        PromptConstructor.asHiddenMessage(PromptConstructor.summaryNotificationTemplate()),
        { role: "assistant" as const, content: fenced },
    ];
    await populateMsgTokens(result);
    return result;
}

// a conversation is summarized turn by turn so each request stays small; a turn goes in one shot
async function summarizeContent(
    agentRunner: AgentRunner,
    webview: vscode.Webview,
    sourceMessages: ChatHistory[],
    label: SummaryLabel,
): Promise<ChatHistory[] | null> {
    if (label === "Turn") {
        const text = await summarizeText(agentRunner, webview, sourceMessages);
        return text === null ? null : buildSummaryEntry(text, label);
    }

    const messages = new ChatContext(sourceMessages);
    const totalTurns = messages.getTurnCount();
    const turnSummaries: string[] = [];
    let i = 0;
    while (i < sourceMessages.length) {
        const end = messages.getTurnEnd(i);
        if (end <= i) {
            break;
        }
        webview.postMessage({ type: "summary-progress", current: turnSummaries.length + 1, total: totalTurns });
        const text = await summarizeText(agentRunner, webview, sourceMessages.slice(i, end));
        if (text === null) {
            return null;
        }
        turnSummaries.push(`# Turn ${turnSummaries.length + 1}\n${text}`);
        i = end;
    }
    return buildSummaryEntry(turnSummaries.join("\n\n"), label);
}

/** Session store the summary handler reads and writes back into. */
export interface SummarySessionManager {
    sessions: { id: string; messages: ChatContext; contextStartIndex: number; toolState?: Record<string, unknown> }[];
    updateSession: (session: any, fn: (s: any) => void) => void;
    sendSessionsUpdate: () => void;
}

/** Summarizes a message range in place and pushes the rewritten history back to the webview. */
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

    // a conversation summary drops the history the notepad lived in - carry the pad over
    const pad = isConversation ? notepadSnapshot(session.toolState) : null;
    if (pad) {
        const carried = [PromptConstructor.asHiddenMessage(PromptConstructor.notepadNotificationTemplate(pad))];
        await populateMsgTokens(carried);
        summarized.push(...carried);
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
