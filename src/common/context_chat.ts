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
}
