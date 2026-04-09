import { html, TemplateResult } from "lit";
import { unsafeHTML } from "lit/directives/unsafe-html.js";
import { ChatHistory } from "../../../../../common/context-chat";

export interface AssistantRenderOptions {
    msg: ChatHistory;
    outOfContextClass: string;
    warningIcon: TemplateResult | string;
    isStreaming: boolean;
    isLoading: boolean;
    getCachedMarkdown: (content: string, isStreaming: boolean) => string;
}

export function renderAssistantMessage(opts: AssistantRenderOptions) {
    const { msg, outOfContextClass, warningIcon, isStreaming, isLoading } = opts;

    // Hide empty assistant messages (e.g. LLM returned only tool calls)
    if (!msg.content && !isLoading && !isStreaming) {
        return html``;
    }

    return html`
        <div class="message assistant ${outOfContextClass}">
            <div class="bubble-assistant">
                <!-- <div class="role-header role-assistant">
                    <span class="role-label">${warningIcon}Assistant</span>
                </div> -->
                ${isLoading
                    ? html`<span class="loading">Generating response<span class="dots"></span>&nbsp</span>`
                    : unsafeHTML(opts.getCachedMarkdown(msg.content, isStreaming))}
            </div>
        </div>
    `;
}

export function renderSystemMessage(opts: {
    msg: ChatHistory;
    outOfContextClass: string;
    warningIcon: TemplateResult | string;
    getCachedMarkdown: (content: string, isStreaming: boolean) => string;
}) {
    const { msg, outOfContextClass, warningIcon } = opts;
    return html`
        <div class="message system ${outOfContextClass}">
            <div class="bubble">
                <div class="role-header role-system">
                    <span class="role-label">${warningIcon}System</span>
                </div>
                ${unsafeHTML(opts.getCachedMarkdown(msg.content, false))}
            </div>
        </div>
    `;
}
