import { ChatHistory } from "../../../../common/context-chat";

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
    compress: (messages: ChatHistory[], assistantIndex: number, sessionId: string) =>
        window.vscode.postMessage({ type: "compress-request", messages, assistantIndex, sessionId }),
    updateMessages: (messages: ChatHistory[], sessionId: string, approxTokensFreed: number) =>
        window.vscode.postMessage({ type: "update-messages", messages, sessionId, approxTokensFreed }),
    newSession: () => window.vscode.postMessage({ type: "new-session" }),
    switchSession: (sessionId: string) => window.vscode.postMessage({ type: "switch-session", sessionId }),
    deleteSession: (sessionId: string) => window.vscode.postMessage({ type: "delete-session", sessionId }),
    renameSession: (sessionId: string, newTitle: string) =>
        window.vscode.postMessage({ type: "rename-session", sessionId, newTitle }),
    copySession: (sessionId: string) => window.vscode.postMessage({ type: "copy-session", sessionId }),
};
