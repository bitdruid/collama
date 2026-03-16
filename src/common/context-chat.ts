import { ToolCall } from "./llmoptions";

export interface AttachedContext {
    fileName: string;
    filePath: string;
    hasSelection: boolean;
    startLine: number;
    endLine: number;
    content: string;
}

export type ChatHistory =
    | {
          role: "system" | "user";
          content: string;
          contexts?: AttachedContext[];
      }
    | {
          role: "assistant";
          content: string;
          tool_calls?: ToolCall[];
      }
    | {
          role: "tool";
          content: string;
          tool_call_id: string;
          toolName?: string;
          toolArgs?: string;
      };

export type UserMessage = Extract<ChatHistory, { role: "user" | "system" }>;
export type AssistantMessage = Extract<ChatHistory, { role: "assistant" }>;
export type ToolMessage = Extract<ChatHistory, { role: "tool" }>;

/**
 * Message history container shared between host and webview.
 *
 * Note: the tool-call methods (`findToolCall`, `findToolResponse`, `setToolResponse`,
 * `getToolCallId`) are host-only and only meaningful with `ChatHistory` messages.
 */
export class ChatContext {
    private messages: ChatHistory[];

    constructor() {
        this.messages = [];
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
        this.messages = messages;
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
        this.messages.push(message);
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
        this.messages.splice(start, end - start, ...messages);
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
     * Example: setToolResponse("call_123", { content: "[stale - file re-read later]" })
     */
    public setToolResponse(toolCallId: string, fields: Partial<{ content: string; tool_call_id: string }>): boolean {
        const msg = this.findToolResponse(toolCallId);
        if (!msg) {
            return false;
        }
        if (fields.content !== undefined) {
            msg.content = fields.content;
        }
        if (fields.tool_call_id !== undefined) {
            msg.tool_call_id = fields.tool_call_id;
        }
        return true;
    }
}
