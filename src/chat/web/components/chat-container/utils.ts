import { AttachedContext, ChatHistory } from "../../../../common/context-chat";
import { llmInfoTag } from "../../../utils-front";

/** Builds user content with embedded contexts. */
export function buildUserContent(contexts: AttachedContext[], text: string): string {
    if (contexts.length === 0) {
        return text;
    }
    const blocks = contexts
        .map((ctx) => {
            const label = ctx.hasSelection ? `${ctx.fileName} (${ctx.startLine}-${ctx.endLine})` : ctx.fileName;
            return `${llmInfoTag(`filepath: ${ctx.filePath}`)}\n\`\`\`Context: ${label}\n${ctx.content}\n\`\`\``;
        })
        .join("\n\n");
    return `${blocks}\n\n${text}`;
}

declare global {
    interface Window {
        vscode: {
            postMessage(message: any): void;
            getState(): any;
            setState(state: any): void;
        };
    }
}

/** Typed wrappers for all outbound postMessage calls to the VS Code host. */
export const backendApi = {
    ready: () => window.vscode.postMessage({ type: "chat-ready" }),
    sendChatRequest: (messages: ChatHistory[], sessionId: string) =>
        window.vscode.postMessage({ type: "chat-request", messages, sessionId }),
    cancel: () => window.vscode.postMessage({ type: "chat-cancel" }),
    summarize: (turnStart: number, turnEnd: number, sessionId: string) =>
        window.vscode.postMessage({ type: "summarize-request", turnStart, turnEnd, sessionId }),
    deleteMessages: (turnStart: number, turnEnd: number, sessionId: string) =>
        window.vscode.postMessage({ type: "delete-messages", turnStart, turnEnd, sessionId }),
    newSession: () => window.vscode.postMessage({ type: "new-session" }),
    newGhostSession: () => window.vscode.postMessage({ type: "new-ghost-session" }),
    switchSession: (sessionId: string) => window.vscode.postMessage({ type: "switch-session", sessionId }),
    deleteSession: (sessionId: string) => window.vscode.postMessage({ type: "delete-session", sessionId }),
    renameSession: (sessionId: string, newTitle: string) =>
        window.vscode.postMessage({ type: "rename-session", sessionId, newTitle }),
    copySession: (sessionId: string) => window.vscode.postMessage({ type: "copy-session", sessionId }),
    autoAcceptAll: (enabled: boolean) => window.vscode.postMessage({ type: "auto-accept-all", enabled }),
    convertToGhost: () => window.vscode.postMessage({ type: "convert-to-ghost" }),
    clearChat: () => window.vscode.postMessage({ type: "clear-chat" }),
    exportSession: (sessionId: string) => window.vscode.postMessage({ type: "export-session", sessionId }),
    toolConfirmResponse: (id: string, value: string, reason: string) =>
        window.vscode.postMessage({ type: "tool-confirm-response", id, value, reason }),
    contextSearch: (query: string) => window.vscode.postMessage({ type: "context-search", query }),
    contextAddFile: (filePath: string, isFolder: boolean) =>
        window.vscode.postMessage({ type: "context-add-file", filePath, isFolder }),
    updateConfig: (key: string, value: unknown) => window.vscode.postMessage({ type: "config-update-request", key, value }),
};
