import { ChatContext } from "../../../common/context-chat";

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
    filePath: string;
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
}

/**
 * Chat-facing extension configuration snapshot.
 */
export interface ChatConfig {
    apiEndpointCompletion: string;
    apiEndpointInstruct: string;
    apiModelCompletion: string;
    apiModelInstruct: string;
    agentic: boolean;
    autoComplete: boolean;
    suggestMode: string;
    verbosityMode: "compact" | "medium" | "detailed";
    suggestDelay: number;
    enableEditTools: boolean;
    enableShellTool: boolean;
    tlsRejectUnauthorized: boolean;
    apiTokenContextLenCompletion: number;
    apiTokenContextLenInstruct: number;
    apiTokenPredictCompletion: number;
    apiTokenPredictInstruct: number;
}

export const defaultChatConfig: ChatConfig = {
    apiEndpointCompletion: "http://127.0.0.1:11434",
    apiEndpointInstruct: "http://127.0.0.1:11434",
    apiModelCompletion: "qwen2.5-coder:3b",
    apiModelInstruct: "qwen2.5-coder:3b-instruct",
    agentic: true,
    autoComplete: true,
    suggestMode: "inline",
    verbosityMode: "medium",
    suggestDelay: 1500,
    enableEditTools: true,
    enableShellTool: false,
    tlsRejectUnauthorized: false,
    apiTokenContextLenCompletion: 4096,
    apiTokenContextLenInstruct: 4096,
    apiTokenPredictCompletion: 400,
    apiTokenPredictInstruct: 4096,
};
