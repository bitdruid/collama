import { LitElement, css, html } from "lit";
import { unsafeHTML } from "lit/directives/unsafe-html.js";
import MarkdownIt from "markdown-it";

import { estimateTokenCount, highlightAllCodeBlocks, hljsStyles, icons } from "../../../utils";
import "../chat_accordion/chat_accordion";

import "./edit";
import { ChatContext, ChatMessage } from "../chat_container/chat_container";
import { outputStyles } from "./styles/output_styles";
import "../chat_session/components/popup/chat_empty_state";


/**
 * Create a MarkdownIt instance configured with code-fence headers and copy buttons.
 */
function createMarkdownWithCodeHeader(): MarkdownIt {
    const md = new MarkdownIt({
        html: false,
        linkify: true,
        breaks: true,
    });

    md.renderer.rules.fence = (tokens, idx) => {
        const token = tokens[idx];
        const lang = token.info.trim() || "code";
        const code = token.content;
        const escapedCode = code.replace(/"/g, "&quot;").replace(/'/g, "&#39;");

        // defines accordion type
        let accordionType = "code";
        let expandedAttr = "expanded";

        if (lang.startsWith("Tool:")) {
            accordionType = "tool";
            expandedAttr = "";
        } else if (lang.startsWith("Think:")) {
            accordionType = "think";
            expandedAttr = "";
        } else if (lang.startsWith("Summary:")) {
            accordionType = "summary";
            expandedAttr = "";
        }

        return `<collama-accordion type="${accordionType}" label="${lang}" code="${escapedCode}" copyCode="${escapedCode}" ${expandedAttr}></collama-accordion>`;
    };

    return md;
}

const md = createMarkdownWithCodeHeader();

export class ChatOutput extends LitElement {
    static properties = {
        messages: { state: true },
        contextStartIndex: { type: Number },
        editingIndex: { state: true },
    };

    static styles = outputStyles;

    messages: ChatMessage[] = [];
    contextStartIndex: number = 0;
    editingIndex: number | null = null;
    private loadingTimeouts = new Map<ChatMessage, number>();
    private highlightedBlocks = new WeakSet<Element>();
    private renderedMarkdownCache = new Map<string, string>();
    private highlightDebounceTimer: number | null = null;

    private _getCachedMarkdown(content: string, isStreaming: boolean): string {
        // Don't cache streaming content as it changes frequently
        if (isStreaming) {
            return md.render(content);
        }
        // Use cached version for completed messages
        let cached = this.renderedMarkdownCache.get(content);
        if (!cached) {
            cached = md.render(content);
            this.renderedMarkdownCache.set(content, cached);
        }
        return cached;
    }

    updated(changed: Map<string, unknown>) {
        if (changed.has("messages")) {
            // Debounce highlighting - will run 250ms after last update
            // This ensures it runs after streaming completes
            if (this.highlightDebounceTimer !== null) {
                window.clearTimeout(this.highlightDebounceTimer);
            }
            this.highlightDebounceTimer = window.setTimeout(() => {
                this.highlightDebounceTimer = null;
                highlightAllCodeBlocks(this.shadowRoot, this.highlightedBlocks);
            }, 250);

            this.scrollTop = this.scrollHeight;

            this.messages.forEach((msg) => {
                if (msg.loading && !this.loadingTimeouts.has(msg)) {
                    const timeout = window.setTimeout(() => {
                        msg.loading = false;
                        msg.content = msg.content || "No response received.";
                        this.loadingTimeouts.delete(msg);
                        this.requestUpdate();
                    }, 60000); // 60s timeout
                    this.loadingTimeouts.set(msg, timeout);
                }
            });
        }
    }

    private _getContextLabel(context: ChatContext): string {
        return context.hasSelection
            ? `${context.fileName} (${context.startLine}-${context.endLine})`
            : context.fileName;
    }

    private _handleResend(index: number) {
        this.dispatchEvent(
            new CustomEvent("resend-message", {
                detail: { messageIndex: index },
                bubbles: true,
                composed: true,
            }),
        );
    }

    private _estimateTokensFreed(index: number): number {
        const content = [this.messages[index], this.messages[index + 1]]
            .filter(Boolean)
            .map((m) => m.content)
            .join("");
        return estimateTokenCount(content);
    }

    private _handleDelete(index: number) {
        this.dispatchEvent(
            new CustomEvent("delete-message", {
                detail: { messageIndex: index },
                bubbles: true,
                composed: true,
            }),
        );
    }

    private _handleEdit(index: number) {
        this.editingIndex = index;
    }

    private _handleEditCancel() {
        this.editingIndex = null;
    }

    private _handleEditSend(e: CustomEvent) {
        this.editingIndex = null;
        this.dispatchEvent(
            new CustomEvent("edit-message", {
                detail: e.detail,
                bubbles: true,
                composed: true,
            }),
        );
    }

    private _getMessageWithoutContext(msg: ChatMessage): string {
        // If message has contexts, extract just the user's text (after all code blocks)
        if (msg.contexts && msg.contexts.length > 0) {
            const content = msg.content;
            // Find the end of the last context block (``` followed by newlines and actual message)
            const codeBlockEnd = content.lastIndexOf("```\n\n");
            if (codeBlockEnd !== -1) {
                return content.substring(codeBlockEnd + 5);
            }
        }
        return msg.content;
    }

    private _renderContexts(contexts: ChatContext[]) {
        return contexts.map((context) => {
            const label = this._getContextLabel(context);
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

    render() {
        const messages = this.messages;


        if (!messages || messages.length === 0) {
            return html`
                <div class="output-container">
                    <collama-empty-state></collama-empty-state>
                </div>
                `;
        }
        const lastIndex = this.messages.length - 1;
         return html`
            <div class="output-container">
            ${this.messages.map((msg, index) => {
            const isStreamingMessage = index === lastIndex && msg.role === "assistant" && !msg.loading;
            const displayContent = this._getMessageWithoutContext(msg);
            const isOutOfContext = this.contextStartIndex > 0 && index < this.contextStartIndex;
            return html`
                    <div class="message ${msg.role} ${isOutOfContext ? "out-of-context" : ""}">
                        <div class="bubble ${msg.role === "user" ? "bubble-user" : ""}">
                            <div class="role-header ${msg.role === "user" ? "role-user" : "role-assistant"}">
                                <span class="role-label"
                                    >${isOutOfContext
                    ? html`<span class="warning-icon" title="Not in context"
                                              >${icons.alertTriangle}</span
                                          >`
                    : ""}${msg.role === "user" ? "User" : "Assistant"}</span
                                >
                                ${msg.role === "user"
                    ? html`
                                          <div class="message-actions">
                                              <button
                                                  class="edit-button"
                                                  @click=${() => this._handleEdit(index)}
                                                  title="Edit and resend"
                                              >
                                                  ✎ Edit
                                              </button>
                                              <button
                                                  class="resend-button"
                                                  @click=${() => this._handleResend(index)}
                                                  title="Resend from here"
                                              >
                                                  ↻ Resend
                                              </button>
                                              <button
                                                  class="delete-button"
                                                  @click=${() => this._handleDelete(index)}
                                                  title="Delete this message pair (~${this._estimateTokensFreed(
                        index,
                    )} tokens freed)"
                                              >
                                                  ✕ Delete
                                              </button>
                                          </div>
                                      `
                    : ""}
                            </div>
                            ${msg.contexts && msg.contexts.length > 0 ? this._renderContexts(msg.contexts) : ""}
                            ${this.editingIndex === index
                    ? html`
                                      <collama-chatedit
                                          .content=${displayContent}
                                          .messageIndex=${index}
                                          @edit-send=${(e: CustomEvent) => this._handleEditSend(e)}
                                          @edit-cancel=${() => this._handleEditCancel()}
                                      ></collama-chatedit>
                                  `
                    : msg.loading
                        ? html`<span class="loading">Generating response<span class="dots">...</span></span>`
                        : unsafeHTML(this._getCachedMarkdown(displayContent, isStreamingMessage))}
                        </div>
                    </div>
                `;
        })}
        </div>
        `;
    }
}

customElements.define("collama-chatoutput", ChatOutput);
