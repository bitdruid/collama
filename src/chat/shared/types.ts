import { ChatContext } from "../../common/context-chat";
import type { ExtensionConfig } from "../../config";

/**
 * Chat session data structure
 */
export interface ChatSession {
    id: string;
    title: string;
    customTitle?: boolean;
    temporary?: boolean;
    ghost?: boolean;
    messages: ChatContext;
    contextStartIndex: number;
    createdAt: number;
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

/**
 * Chat-facing extension configuration snapshot.
 */
export interface ChatConfig extends ExtensionConfig {
    agentsMdActive: boolean;
}

export const defaultChatConfig: ChatConfig = {
    apiEndpointCompletion: "http://127.0.0.1:11434",
    apiEndpointInstruct: "http://127.0.0.1:11434",
    apiModelCompletion: "qwen2.5-coder:3b",
    apiModelInstruct: "qwen2.5-coder:3b-instruct",
    agenticMode: true,
    autoComplete: true,
    suggestMode: "inline",
    verbosityMode: "medium",
    suggestDelay: 1500,
    enableEditTools: true,
    enableShellTool: false,
    liteMode: false,
    tlsRejectUnauthorized: false,
    apiTokenContextLenCompletion: 4096,
    apiTokenContextLenInstruct: 4096,
    apiTokenPredictCompletion: 400,
    apiTokenPredictInstruct: 4096,
    agentsMdActive: false,
};
