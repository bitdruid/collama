import { LitElement, html } from "lit";
import MarkdownIt from "markdown-it";
import { ChatHistory } from "../../../../common/context-chat";
import { highlightAllCodeBlocks, icons } from "../../../utils-front";
import "../chat-accordion/chat-accordion";
import "../chat-session/components/popup/chat-empty-state";
import { renderAssistantMessage, renderSystemMessage } from "./message-assistant/message-assistant";
import { renderToolMessage } from "./message-tool/message-tool";
import { renderUserMessage } from "./message-user/message-user";
import { outputStyles } from "./styles-shared";

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

        let accordionType = "code";
        let expandedAttr = "expanded";

        if (lang.startsWith("Think:")) {
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
        isGenerating: { type: Boolean },
        editingIndex: { state: true },
    };

    static styles = outputStyles;

    messages: ChatHistory[] = [];
    contextStartIndex: number = 0;
    isGenerating: boolean = false;
    editingIndex: number | null = null;

    private highlightedBlocks = new WeakSet<Element>();
    private renderedMarkdownCache = new Map<string, string>();
    private highlightDebounceTimer: number | null = null;

    private _autoScroll = true;

    private _hasScrollbar(): boolean {
        return this.scrollHeight > this.clientHeight;
    }

    private _isNearBottom(): boolean {
        const threshold = 15;
        return !this._hasScrollbar() || this.scrollHeight - (this.clientHeight + this.scrollTop) < threshold;
    }

    private _getCachedMarkdown = (content: string, isStreaming: boolean): string => {
        if (isStreaming) {
            return md.render(content);
        }
        let cached = this.renderedMarkdownCache.get(content);
        if (!cached) {
            cached = md.render(content);
            this.renderedMarkdownCache.set(content, cached);
        }
        return cached;
    };

    private _scrollToBottom() {
        if (!this._autoScroll) {
            return;
        }
        this.scrollTo({ top: this.scrollHeight, behavior: "smooth" });
    }

    public scrollDown() {
        this._autoScroll = true;
        this.scrollTo({ top: this.scrollHeight, behavior: "smooth" });
    }

    firstUpdated() {
        let wasNearBottom = true;
        let showButtonTimer: number | undefined;

        this.addEventListener("wheel", (e: WheelEvent) => {
            if (e.deltaY < 0) {
                this._autoScroll = false;
            }
        });

        this.addEventListener("scroll", () => {
            const nearBottom = this._isNearBottom();
            if (nearBottom && !this._autoScroll) {
                this._autoScroll = true;
            }
            if (nearBottom !== wasNearBottom) {
                wasNearBottom = nearBottom;
                if (nearBottom) {
                    clearTimeout(showButtonTimer);
                    this.dispatchEvent(
                        new CustomEvent("near-bottom-changed", {
                            detail: { nearBottom: true },
                            bubbles: true,
                            composed: true,
                        }),
                    );
                } else if (this._hasScrollbar()) {
                    clearTimeout(showButtonTimer);
                    showButtonTimer = window.setTimeout(() => {
                        if (this._hasScrollbar() && !this._isNearBottom()) {
                            this.dispatchEvent(
                                new CustomEvent("near-bottom-changed", {
                                    detail: { nearBottom: false },
                                    bubbles: true,
                                    composed: true,
                                }),
                            );
                        }
                    }, 300);
                }
            }
        });
    }

    updated(changed: Map<string, unknown>) {
        if (changed.has("messages")) {
            if (this.highlightDebounceTimer !== null) {
                window.clearTimeout(this.highlightDebounceTimer);
            }

            this.highlightDebounceTimer = window.setTimeout(() => {
                this.highlightDebounceTimer = null;
                highlightAllCodeBlocks(this.shadowRoot, this.highlightedBlocks);
                this._scrollToBottom();
            }, 250);

            requestAnimationFrame(() => {
                this._scrollToBottom();
            });
        }
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

        let lastAssistantIndex = -1;
        for (let i = messages.length - 1; i >= 0; i--) {
            if (messages[i].role === "assistant") {
                lastAssistantIndex = i;
                break;
            }
        }

        return html`
            <div class="output-container">
                ${messages.map((msg, index) => {
                    const isOutOfContext = this.contextStartIndex > 0 && index < this.contextStartIndex;
                    const outOfContextClass = isOutOfContext ? "out-of-context" : "";
                    const warningIcon = isOutOfContext
                        ? html`<span class="warning-icon" title="Not in context">${icons.alertTriangle}</span>`
                        : "";

                    if (msg.role === "tool") {
                        return renderToolMessage({ msg, outOfContextClass, warningIcon });
                    }

                    if (msg.role === "user") {
                        return renderUserMessage({
                            host: this,
                            messages,
                            msg,
                            index,
                            outOfContextClass,
                            warningIcon,
                            getCachedMarkdown: this._getCachedMarkdown,
                        });
                    }

                    if (msg.role === "assistant") {
                        const isGeneratingThis = this.isGenerating && index === lastAssistantIndex;
                        return renderAssistantMessage({
                            msg,
                            outOfContextClass,
                            warningIcon,
                            isLoading: isGeneratingThis && !msg.content,
                            isStreaming: isGeneratingThis && !!msg.content,
                            getCachedMarkdown: this._getCachedMarkdown,
                        });
                    }

                    return renderSystemMessage({
                        msg,
                        outOfContextClass,
                        warningIcon,
                        getCachedMarkdown: this._getCachedMarkdown,
                    });
                })}
            </div>
        `;
    }
}

customElements.define("collama-chatoutput", ChatOutput);
