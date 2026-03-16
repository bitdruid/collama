import { ToolCall } from "./llmoptions";

export type ChatHistory =
    | {
          role: "system" | "user";
          content: string;
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
     * Returns the message at the given index, or undefined if out of bounds.
     */
    public getMessage(index: number): ChatHistory | undefined {
        return this.messages[index];
    }

    /**
     * Appends a message to the end of the history.
     */
    public push(message: ChatHistory): void {
        this.messages.push(message);
    }

    /**
     * Inserts a message at the given index (shifts existing messages right).
     * If index is out of bounds, the message is appended.
     */
    public insert(index: number, message: ChatHistory): void {
        if (index >= this.messages.length) {
            this.messages.push(message);
        } else {
            this.messages.splice(index < 0 ? 0 : index, 0, message);
        }
    }

    /**
     * Deletes the message at the given index. Returns the removed message, or undefined if out of bounds.
     */
    public delete(index: number): ChatHistory | undefined {
        if (index < 0 || index >= this.messages.length) {
            return undefined;
        }
        return this.messages.splice(index, 1)[0];
    }

    /**
     * Returns the role of the message at the given index, or undefined if out of bounds.
     */
    public getRole(index: number): ChatHistory["role"] | undefined {
        return this.messages[index]?.role;
    }

    /**
     * Returns the content of the message at the given index, or undefined if out of bounds.
     */
    public getContent(index: number): string | undefined {
        return this.messages[index]?.content;
    }

    /**
     * Returns the tool_calls array of an assistant message at the given index, or undefined.
     */
    public getToolCalls(index: number): ToolCall[] | undefined {
        const msg = this.messages[index];
        if (msg && msg.role === "assistant") {
            return msg.tool_calls;
        }
        return undefined;
    }

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

    // -- ToolCall accessors (by tool_call_id) --

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
                return msg;
            }
        }
        return undefined;
    }

    /**
     * Partially updates a tool call by its id.
     * Only provided fields are overwritten.
     *
     * Example: setToolCall("call_123", { function: { name: "foo", arguments: "{}" } })
     */
    public setToolCall(toolCallId: string, fields: Partial<ToolCall>): boolean {
        const tc = this.findToolCall(toolCallId);
        if (!tc) {
            return false;
        }
        if (fields.id !== undefined) {
            tc.id = fields.id;
        }
        if (fields.type !== undefined) {
            tc.type = fields.type;
        }
        if (fields.function !== undefined) {
            if (fields.function.name !== undefined) {
                tc.function.name = fields.function.name;
            }
            if (fields.function.arguments !== undefined) {
                tc.function.arguments = fields.function.arguments;
            }
        }
        return true;
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
