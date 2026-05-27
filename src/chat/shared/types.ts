import type { ChatContext } from "../../common/context-chat";

/**
 * The subset of extension settings the chat webview can view and toggle.
 * The backend maps ExtensionConfig <-> ChatSettings; the webview never sees the full config.
 */
export interface ChatSettings {
    agenticMode: boolean;
    enableEditTools: boolean;
    enableShellTool: boolean;
    liteMode: boolean;
    verbosityMode: "compact" | "medium" | "detailed";
}

export const defaultChatSettings: ChatSettings = {
    agenticMode: true,
    enableEditTools: true,
    enableShellTool: false,
    liteMode: false,
    verbosityMode: "medium",
};

/**
 * Chat session data structure
 */
export interface ChatSession {
    id: string;
    title: string;
    ghost?: boolean;
    messages: ChatContext;
    contextStartIndex: number;
    updatedAt: number;
}

/**
 * Search result for context files
 */
export interface ContextSearchResult {
    fileName: string;
    relativePath: string;
    isFolder: boolean;
}

/**
 * Tool confirmation request data
 */
export interface ToolConfirmRequest {
    id: string;
    action: string;
    filePath: string;
    explanation: string;
}

/**
 * Tool decision request data — agent asks the user to pick an option.
 */
export interface ToolDecisionRequest {
    id: string;
    question: string;
    options: string[];
}
