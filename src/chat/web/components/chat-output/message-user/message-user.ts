import { html, TemplateResult } from "lit";
import { unsafeHTML } from "lit/directives/unsafe-html.js";
import { estimateTokenCount } from "../../../../utils-web";
import { ChatContext, ChatMessage } from "../../chat-container/chat-container";
import "./edit";

export interface UserMessageHost {
    editingIndex: number | null;
    requestUpdate(): void;
    dispatchEvent(event: Event): boolean;
}

export interface UserRenderOptions {
    host: UserMessageHost;
    messages: ChatMessage[];
    msg: ChatMessage;
    index: number;
    outOfContextClass: string;
    warningIcon: TemplateResult | string;
    getCachedMarkdown: (content: string, isStreaming: boolean) => string;
}

function getContextLabel(context: ChatContext): string {
    return context.hasSelection
        ? `${context.fileName} (${context.startLine}-${context.endLine})`
        : context.fileName;
}

function renderContexts(contexts: ChatContext[]) {
    return contexts.map((context) => {
        const label = getContextLabel(context);
        const escapedCode = context.content.replace(/"/g, "&quot;").replace(/'/g, "&#39;");
        return html`
            <collama-accordion
                type="code"
                label="${label}"
                .code="${context.content}"
                copyCode="${escapedCode}"
            ></collama-accordion>
        `;
    });
}

function getMessageWithoutContext(msg: ChatMessage): string {
    if (msg.contexts && msg.contexts.length > 0) {
        const content = msg.content;
        const codeBlockEnd = content.lastIndexOf("```\n\n");
        if (codeBlockEnd !== -1) {
            return content.substring(codeBlockEnd + 5);
        }
    }
    return msg.content;
}

function findTurnEnd(messages: ChatMessage[], index: number): number {
    let end = index + 1;
    while (end < messages.length && messages[end].role !== "user") {
        end++;
    }
    return end;
}

function estimateTokensFreed(messages: ChatMessage[], index: number): number {
    const end = findTurnEnd(messages, index);
    const content = messages
        .slice(index, end)
        .map((m) => m.content)
        .join("");
    return estimateTokenCount(content);
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
    const displayContent = getMessageWithoutContext(msg);
    return html`
        <div class="message user ${outOfContextClass}">
            <div class="bubble bubble-user">
                <div class="role-header role-user">
                    <span class="role-label">${warningIcon}User</span>
                    <div class="message-actions">
                        <button
                            class="edit-button"
                            @click=${() => handleEdit(host, index)}
                            title="Edit and resend"
                        >
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
                            title="Delete this message pair (~${estimateTokensFreed(messages, index)} tokens freed)"
                        >
                            ✕ Delete
                        </button>
                    </div>
                </div>
                ${msg.contexts && msg.contexts.length > 0 ? renderContexts(msg.contexts) : ""}
                ${host.editingIndex === index
                    ? html`
                          <collama-chatedit
                              .content=${displayContent}
                              .messageIndex=${index}
                              @edit-send=${(e: CustomEvent) => handleEditSend(host, e)}
                              @edit-cancel=${() => handleEditCancel(host)}
                          ></collama-chatedit>
                      `
                    : unsafeHTML(opts.getCachedMarkdown(displayContent, false))}
            </div>
        </div>
    `;
}
