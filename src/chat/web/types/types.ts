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
