import { ToolCall } from "./client";

export type ToolHistoryPolicy = "keepAll" | "dropAll" | "evalOutdated";

export interface AttachedContext {
    fileName: string;
    relativePath: string;
    isFolder: boolean;
    hasSelection: boolean;
    startLine: number;
    endLine: number;
    /** File content. Omitted in agent mode, where only a path reference is attached. */
    content?: string;
}

/** Custom keys attached to messages for UI/internal use (not sent to LLM). */
export interface CustomMessageKeys {
    toolMeta?: {
        toolName: string;
        toolArgs: string;
        toolTarget: string;
        toolStatus?: string; // present ⇒ background shell action; renders standalone (not in the tool group)
        toolSuccess: boolean; // false ⇒ hide from webview (the error is in msg.content for the LLM)
    };
    contexts?: AttachedContext[];
    loading?: boolean;
    msgTokens?: number;
    id?: string;
    thinking?: string;
    datetime?: number;
}

export type ChatHistory =
    | {
          role: "system" | "user";
          content: string;
          customKeys?: CustomMessageKeys;
      }
    | {
          role: "assistant";
          content: string;
          tool_calls?: ToolCall[];
          customKeys?: CustomMessageKeys;
      }
    | {
          role: "tool";
          content: string;
          tool_call_id: string;
          customKeys?: CustomMessageKeys;
      };

export type UserMessage = Extract<ChatHistory, { role: "user" | "system" }>;
export type AssistantMessage = Extract<ChatHistory, { role: "assistant" }>;
export type ToolMessage = Extract<ChatHistory, { role: "tool" }>;

let messageIdCounter = 0;

function nextMessageId(): string {
    if (typeof globalThis.crypto?.randomUUID === "function") {
        return globalThis.crypto.randomUUID();
    }
    messageIdCounter++;
    return `msg_${Date.now()}_${messageIdCounter}`;
}

function ensureMessageId<T extends ChatHistory>(message: T): T {
    const hasId = message.customKeys?.id !== undefined;
    const hasDatetime = message.customKeys?.datetime !== undefined;
    if (hasId && hasDatetime) {
        return message;
    }
    return {
        ...message,
        customKeys: {
            ...message.customKeys,
            id: hasId ? undefined : nextMessageId(),
            datetime: hasDatetime ? undefined : Date.now(),
        },
    };
}

function ensureMessageIds(messages: ChatHistory[]): ChatHistory[] {
    return messages.map((message) => ensureMessageId(message));
}

/**
 * Message history container shared between host and webview.
 *
 * Note: the tool-call methods (`findToolCall`, `findToolResponse`, `setToolResponse`,
 * `getToolCallId`) are host-only and only meaningful with `ChatHistory` messages.
 */
export class ChatContext {
    private messages: ChatHistory[];

    constructor(messages?: ChatHistory[]) {
        this.messages = messages ? ensureMessageIds(messages) : [];
    }

    /**
     * Gets the current list of messages.
     */
    public getMessages(): ChatHistory[] {
        return this.messages;
    }

    /**
     * Sets the messages (e.g. when loading from a session).
     */
    public setMessages(messages: ChatHistory[]): void {
        this.messages = ensureMessageIds(messages);
    }

    /**
     * Returns the number of messages.
     */
    public length(): number {
        return this.messages.length;
    }

    /**
     * Appends a message to the end of the history.
     */
    public push(message: ChatHistory): void {
        this.messages.push(ensureMessageId(message));
    }

    /**
     * Appends a text chunk to the content of the message at the given index.
     * Mutates in-place for streaming performance.
     */
    public appendContent(index: number, chunk: string): void {
        const msg = this.messages[index];
        if (msg) {
            msg.content += chunk;
        }
    }

    /**
     * Appends a reasoning/thinking chunk to the message at the given index.
     * Stored in customKeys so it's never sent back to the LLM.
     */
    public appendThinking(index: number, chunk: string): void {
        const msg = this.messages[index];
        if (msg) {
            msg.customKeys = {
                ...msg.customKeys,
                thinking: (msg.customKeys?.thinking ?? "") + chunk,
            };
        }
    }

    /**
     * Replaces the content of the message at the given index.
     */
    public setContent(index: number, content: string): void {
        const msg = this.messages[index];
        if (msg) {
            msg.content = content;
        }
    }

    /**
     * Keeps only messages before the given index (exclusive).
     * truncate(3) keeps messages[0..2].
     */
    public truncate(index: number): void {
        this.messages = this.messages.slice(0, Math.max(0, index));
    }

    /**
     * Removes messages in the range [start, end).
     */
    public removeRange(start: number, end: number): void {
        if (start < 0 || end > this.messages.length || start >= end) {
            return;
        }
        this.messages.splice(start, end - start);
    }

    /**
     * Replaces messages in the range [start, end) with the given messages.
     * Can be used to insert, delete, or replace a range.
     */
    public replaceRange(start: number, end: number, messages: ChatHistory[]): void {
        if (start < 0 || end > this.messages.length || start > end) {
            return;
        }
        this.messages.splice(start, end - start, ...ensureMessageIds(messages));
    }

    /**
     * Returns the exclusive end index of the turn starting at the given user message index.
     * A turn = the user message + all following non-user messages until the next user message.
     * Returns index+1 if the message at index is not a user message.
     */
    public getTurnEnd(index: number): number {
        if (index < 0 || index >= this.messages.length) {
            return index;
        }
        if (this.messages[index].role !== "user") {
            return index + 1;
        }
        let end = index + 1;
        while (end < this.messages.length && this.messages[end].role !== "user") {
            end++;
        }
        return end;
    }

    /**
     * Returns the total number of turns in the conversation.
     * A turn = a user message + all following non-user messages until the next user message.
     */
    public getTurnCount(): number {
        let count = 0;
        let i = 0;
        while (i < this.messages.length) {
            if (this.messages[i].role === "user") {
                count++;
            }
            i = this.getTurnEnd(i);
        }
        return count;
    }

    /**
     * Returns the message at the given index, or undefined if out of bounds.
     */
    public getMsgByIndex(index: number): ChatHistory | undefined {
        return this.messages[index];
    }

    // -- ToolCall accessors (host-side only) --

    /**
     * Returns the tool_call_id of a tool message at the given index, or undefined.
     */
    public getToolCallId(index: number): string | undefined {
        const msg = this.messages[index];
        if (msg && msg.role === "tool") {
            return msg.tool_call_id;
        }
        return undefined;
    }

    /**
     * Finds a ToolCall in the history by its id.
     */
    public findToolCall(toolCallId: string): ToolCall | undefined {
        for (const msg of this.messages) {
            if (msg.role === "assistant" && msg.tool_calls) {
                const tc = msg.tool_calls.find((tc) => tc.id === toolCallId);
                if (tc) {
                    return tc;
                }
            }
        }
        return undefined;
    }

    /**
     * Finds the tool response message (role: "tool") for a given tool_call_id.
     */
    public findToolResponse(toolCallId: string): (ChatHistory & { role: "tool" }) | undefined {
        for (const msg of this.messages) {
            if (msg.role === "tool" && msg.tool_call_id === toolCallId) {
                return msg as ChatHistory & { role: "tool" };
            }
        }
        return undefined;
    }

    /**
     * Partially updates a tool response message by its tool_call_id.
     * Allows modifying the content of an existing tool response.
     *
     * Example: setToolResponse("call_123", { content: "[stale - tool re-run later]" })
     */
    public setToolResponse(toolCallId: string, fields: Partial<{ content: string; tool_call_id: string }>): boolean {
        const msg = this.findToolResponse(toolCallId);
        if (!msg) {
            return false;
        }
        if (fields.content !== undefined) {
            msg.content = fields.content;
            if (msg.customKeys) {
                const { msgTokens: _, ...restKeys } = msg.customKeys;
                msg.customKeys = Object.keys(restKeys).length > 0 ? restKeys : undefined;
            }
        }
        if (fields.tool_call_id !== undefined) {
            msg.tool_call_id = fields.tool_call_id;
        }
        return true;
    }

    /**
     * Sweeps every tool response at turn-end, marking `dropAll` tools' content as
     * `[stale]`. `keepAll` is a noop. `evalOutdated` marks a tool response as stale
     * if the file it operated on was later edited (edit/create/delete/notebook).
     * Called once per agent turn after the work-loop completes — tool results stay
     * live throughout the loop that produced them.
     */
    public applyToolHistoryPolicy(getPolicy: (toolName: string) => ToolHistoryPolicy): void {
        for (let i = 0; i < this.length(); i++) {
            const toolCallId = this.getToolCallId(i);
            if (!toolCallId) {
                continue;
            }
            const tc = this.findToolCall(toolCallId);
            if (!tc) {
                continue;
            }
            const policy = getPolicy(tc.function.name);
            if (policy === "dropAll") {
                this.setToolResponse(toolCallId, { content: "[stale - dropped after turn]" });
            } else if (policy === "evalOutdated") {
                const filePath = this.parseToolFilePath(tc);
                if (filePath && this.isFileEditedAfter(i, filePath)) {
                    this.setToolResponse(toolCallId, { content: "[stale - file was edited after this read]" });
                }
            }
        }
    }

    /** Extracts `filePath` from a tool call's JSON arguments, or undefined. */
    private parseToolFilePath(tc: ToolCall): string | undefined {
        try {
            const args = JSON.parse(tc.function.arguments);
            return typeof args.filePath === "string" ? args.filePath : undefined;
        } catch {
            return undefined;
        }
    }

    /**
     * Returns true if any edit-type tool call on the given filePath appears after `fromIndex`.
     * Paths are compared verbatim; the agent canonicalizes `filePath` args to absolute paths
     * before execution (normalizeToolArgs), so the same file has a single representation here.
     */
    private isFileEditedAfter(fromIndex: number, filePath: string): boolean {
        const editTools = new Set(["edit", "create", "delete", "notebook"]);
        for (let j = fromIndex + 1; j < this.length(); j++) {
            const msg = this.messages[j];
            if (msg.role === "assistant" && msg.tool_calls) {
                for (const tc of msg.tool_calls) {
                    if (editTools.has(tc.function.name)) {
                        const editedPath = this.parseToolFilePath(tc);
                        if (editedPath === filePath) {
                            return true;
                        }
                    }
                }
            }
        }
        return false;
    }

    /** Sums cached `msgTokens` across all messages in the context. */
    public sumTokens(): number {
        return sumMsgTokens(this.messages);
    }

    /** Sums cached `msgTokens` for messages in the range [start, end). */
    public sumTokensInRange(start: number, end: number): number {
        return sumMsgTokens(this.messages.slice(start, end));
    }

    /** Sums cached `msgTokens` from the given start index through the end. */
    public sumTokensFrom(start: number): number {
        return this.sumTokensInRange(Math.max(0, start), this.messages.length);
    }
}

/** Sums up cached `msgTokens` across all messages. Returns 0 for messages without a cached value. */
export function sumMsgTokens(messages: ChatHistory[]): number {
    return messages.reduce((sum, msg) => sum + (msg.customKeys?.msgTokens ?? 0), 0);
}
