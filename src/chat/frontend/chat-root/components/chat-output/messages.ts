import { html, TemplateResult } from "lit";
import { unsafeHTML } from "lit/directives/unsafe-html.js";
import { ChatContext, ChatHistory, ToolMessage } from "../../../../../common/context-chat";
import { estTokens } from "../../../../../common/utils";
import { themeIcons } from "../../../styles";
import "../../../template-components/banner";
import "./edit";

// Assistant
// Assistant
// Assistant

export interface AssistantRenderOptions {
    msg: ChatHistory;
    outOfContextClass: string;
    isStreaming: boolean;
    showThinking: boolean;
    getCachedMarkdown: (content: string, isStreaming: boolean) => string;
}

export function renderAssistantMessage(opts: AssistantRenderOptions) {
    const { msg, outOfContextClass, isStreaming, showThinking } = opts;
    const thinking = msg.customKeys?.thinking;
    const renderThinking = showThinking && thinking;

    // Hide empty assistant messages (e.g. LLM returned only tool calls, or only thinking while hidden)
    if (!msg.content && !renderThinking) {
        return html``;
    }

    return html`
        <div class="message assistant ${outOfContextClass}">
            <div class="bubble-assistant ${isStreaming ? "streaming" : ""}">
                ${renderThinking
                    ? html`<collama-accordion
                          type="think"
                          label="Thinking"
                          description=${thinking ? `(~${estTokens(thinking.length).toLocaleString()} tokens)` : ""}
                          >${unsafeHTML(opts.getCachedMarkdown(thinking, isStreaming))}</collama-accordion
                      >`
                    : ""}
                ${msg.content ? unsafeHTML(opts.getCachedMarkdown(msg.content, isStreaming)) : ""}
            </div>
        </div>
    `;
}

// Tool
// Tool
// Tool

export interface ToolRenderOptions {
    msg: ToolMessage;
    outOfContextClass: string;
    warningIcon: TemplateResult | string;
    bare?: boolean;
}

export function renderToolMessage(opts: ToolRenderOptions) {
    const { msg, outOfContextClass, bare } = opts;
    const toolName = msg.customKeys?.toolName || "unknown";
    const toolTarget = msg.customKeys?.toolTarget || "";
    const toolArgs = msg.customKeys?.toolArgs || "";
    const toolStatus = msg.customKeys?.toolStatus || "";

    // Edit is the only tool with an expandable body: the diff is primary content worth opening.
    let body;
    if (toolName === "edit") {
        body = html`<collama-accordion
            type="tool"
            label="edit"
            description="${toolTarget}"
            .code="${toolArgs}"
            .copyCode="${toolArgs}"
            language="diff"
        ></collama-accordion>`;
    } else if (toolName === "shell" && toolStatus) {
        // Background shell: header is the session id (+ liveness); body is just the command,
        // slotted as plain text in a code-chip (no pre/hljs)
        body = html`<collama-accordion type="shell" label="Background" description="${toolTarget}">
            <code>${toolArgs}</code>
        </collama-accordion>`;
    } else {
        body = html`<collama-banner
            type="${toolName === "memory" ? "memory" : "tool"}"
            label="${toolName === "memory" ? "Memory" : toolName}"
            .description=${toolTarget}
        ></collama-banner>`;
    }

    if (bare) {
        return body;
    }

    return html`
        <div class="message tool ${outOfContextClass}">
            <div class="bubble-tool">${body}</div>
        </div>
    `;
}

// User
// User
// User

export interface UserMessageHost {
    editingIndex: number | null;
    requestUpdate(): void;
    dispatchEvent(event: Event): boolean;
}

export interface UserRenderOptions {
    host: UserMessageHost;
    messages: ChatHistory[];
    msg: ChatHistory;
    index: number;
    isGenerating: boolean;
    outOfContextClass: string;
    warningIcon: TemplateResult | string;
    getCachedMarkdown: (content: string, isStreaming: boolean) => string;
}

function getEditableText(msg: ChatHistory): string {
    const contexts = msg.customKeys?.contexts;
    if (!contexts?.length) {
        return msg.content;
    }
    const lastBlockEnd = msg.content.lastIndexOf("```\n\n");
    return lastBlockEnd !== -1 ? msg.content.substring(lastBlockEnd + 5) : msg.content;
}

function getTurnTokens(messages: ChatHistory[], index: number): number {
    // Temporary instance is OK for pure calculation
    // ChatContext constructor accepts optional messages parameter
    const ctx = new ChatContext(messages);
    return ctx.sumTokensInRange(index, ctx.getTurnEnd(index));
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
    const { host, messages, msg, index, isGenerating, outOfContextClass, warningIcon } = opts;
    const datetime = msg.customKeys?.datetime;
    return html`
        <div class="message user ${outOfContextClass}">
            <div class="bubble bubble-user">
                <div class="user-heading">
                    <span class="role-datetime"
                        >${warningIcon}${datetime ? new Date(datetime).toLocaleString() : ""}</span
                    >
                    <div class="message-actions">
                        <button
                            class="edit-button"
                            @click=${() => handleEdit(host, index)}
                            title="Edit and resend"
                            ?disabled=${isGenerating}
                        >
                            ${themeIcons.pencil.small}
                        </button>
                        <button
                            class="resend-button"
                            @click=${() => handleResend(host, index)}
                            title="Resend from here"
                            ?disabled=${isGenerating}
                        >
                            ${themeIcons.enter.small}
                        </button>
                        <button
                            class="summarize-button"
                            @click=${() => handleSummarize(host, index)}
                            title="Summarize this turn"
                            ?disabled=${isGenerating}
                        >
                            ${themeIcons.fileText.small}
                        </button>
                        <button
                            class="delete-button"
                            @click=${() => handleDelete(host, index)}
                            title="Delete this turn (~${getTurnTokens(messages, index)} tokens freed)"
                            ?disabled=${isGenerating}
                        >
                            ${themeIcons.trash.small}
                        </button>
                    </div>
                </div>
                <div class="user-content">
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
        </div>
    `;
}
