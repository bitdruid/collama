import { html, TemplateResult } from "lit";
import { unsafeHTML } from "lit/directives/unsafe-html.js";
import { ChatMessage } from "../../chat-container/chat-container";

export interface AssistantRenderOptions {
    msg: ChatMessage;
    outOfContextClass: string;
    warningIcon: TemplateResult | string;
    isStreaming: boolean;
    getCachedMarkdown: (content: string, isStreaming: boolean) => string;
}

export function renderAssistantMessage(opts: AssistantRenderOptions) {
    const { msg, outOfContextClass, warningIcon, isStreaming } = opts;

    // Hide empty assistant messages (e.g. LLM returned only tool calls)
    if (!msg.content && !msg.loading && !isStreaming) {
        return html``;
    }

    return html`
        <div class="message assistant ${outOfContextClass}">
            <div class="bubble-assistant">
                <!-- <div class="role-header role-assistant">
                    <span class="role-label">${warningIcon}Assistant</span>
                </div> -->
                ${msg.loading
                    ? html`<span class="loading">Generating response<span class="dots">...</span></span>`
                    : unsafeHTML(opts.getCachedMarkdown(msg.content, isStreaming))}
            </div>
        </div>
    `;
}

export function renderSystemMessage(opts: {
    msg: ChatMessage;
    outOfContextClass: string;
    warningIcon: TemplateResult | string;
    getCachedMarkdown: (content: string, isStreaming: boolean) => string;
}) {
    const { msg, outOfContextClass, warningIcon } = opts;
    return html`
        <div class="message system ${outOfContextClass}">
            <div class="bubble">
                <div class="role-header role-assistant">
                    <span class="role-label">${warningIcon}System</span>
                </div>
                ${unsafeHTML(opts.getCachedMarkdown(msg.content, false))}
            </div>
        </div>
    `;
}
