export interface ChatHistory {
    role: "system" | "user" | "assistant" | "tool";
    content: string;
    tool_calls?: Array<{ function: { name: string; arguments: Record<string, any> } }>;
}

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
