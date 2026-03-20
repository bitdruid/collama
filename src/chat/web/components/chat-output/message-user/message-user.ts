import { html, TemplateResult } from "lit";
import { unsafeHTML } from "lit/directives/unsafe-html.js";
import { ChatContext, ChatHistory } from "../../../../../common/context-chat";
import { estimateTokens } from "../../../../utils-front";
import "./edit";

export interface UserMessageHost {
    editingIndex: number | null;
    requestUpdate(): void;
    dispatchEvent(event: Event): boolean;
}

function getEditableText(msg: ChatHistory): string {
    const contexts = (msg as { contexts?: unknown[] }).contexts;
    if (!contexts?.length) {
        return msg.content;
    }
    const lastBlockEnd = msg.content.lastIndexOf("```\n\n");
    return lastBlockEnd !== -1 ? msg.content.substring(lastBlockEnd + 5) : msg.content;
}

export interface UserRenderOptions {
    host: UserMessageHost;
    messages: ChatHistory[];
    msg: ChatHistory;
    index: number;
    outOfContextClass: string;
    warningIcon: TemplateResult | string;
    getCachedMarkdown: (content: string, isStreaming: boolean) => string;
}

function getTurnTokens(messages: ChatHistory[], index: number): number {
    const ctx = new ChatContext();
    ctx.setMessages(messages);
    const end = ctx.getTurnEnd(index);
    return estimateTokens(messages.slice(index, end));
}

function handleResend(host: UserMessageHost, index: number) {
    host.dispatchEvent(
        new CustomEvent("resend-message", {
            detail: { messageIndex: index },
            bubbles: true,
            composed: true,
        }),
    );
}

function handleDelete(host: UserMessageHost, index: number) {
    host.dispatchEvent(
        new CustomEvent("delete-message", {
            detail: { messageIndex: index },
            bubbles: true,
            composed: true,
        }),
    );
}

function handleSummarize(host: UserMessageHost, index: number) {
    host.dispatchEvent(
        new CustomEvent("summarize-turn", {
            detail: { messageIndex: index },
            bubbles: true,
            composed: true,
        }),
    );
}

function handleEdit(host: UserMessageHost, index: number) {
    host.editingIndex = index;
    host.requestUpdate();
}

function handleEditCancel(host: UserMessageHost) {
    host.editingIndex = null;
    host.requestUpdate();
}

function handleEditSend(host: UserMessageHost, e: CustomEvent) {
    host.editingIndex = null;
    host.requestUpdate();
    host.dispatchEvent(
        new CustomEvent("edit-message", {
            detail: e.detail,
            bubbles: true,
            composed: true,
        }),
    );
}

export function renderUserMessage(opts: UserRenderOptions) {
    const { host, messages, msg, index, outOfContextClass, warningIcon } = opts;
    return html`
        <div class="message user ${outOfContextClass}">
            <div class="bubble bubble-user">
                <div class="role-header role-user">
                    <span class="role-label">${warningIcon}User</span>
                    <div class="message-actions">
                        <button
                            class="summarize-button"
                            @click=${() => handleSummarize(host, index)}
                            title="Summarize this turn"
                        >
                            ⊟ Summarize
                        </button>
                        <button class="edit-button" @click=${() => handleEdit(host, index)} title="Edit and resend">
                            ✎ Edit
                        </button>
                        <button
                            class="resend-button"
                            @click=${() => handleResend(host, index)}
                            title="Resend from here"
                        >
                            ↻ Resend
                        </button>
                        <button
                            class="delete-button"
                            @click=${() => handleDelete(host, index)}
                            title="Delete this turn (~${getTurnTokens(messages, index)} tokens freed)"
                        >
                            ✕ Delete
                        </button>
                    </div>
                </div>
                ${host.editingIndex === index
                    ? html`
                          <collama-chatedit
                              .content=${getEditableText(msg)}
                              .messageIndex=${index}
                              @edit-send=${(e: CustomEvent) => handleEditSend(host, e)}
                              @edit-cancel=${() => handleEditCancel(host)}
                          ></collama-chatedit>
                      `
                    : unsafeHTML(opts.getCachedMarkdown(msg.content, false))}
            </div>
        </div>
    `;
}
