import { LitElement, html } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import { repeat } from "lit/directives/repeat.js";
import MarkdownIt from "markdown-it";
import { ChatHistory, ToolMessage } from "../../../../common/context-chat";
import { escapeAttr, /* highlightAllCodeBlocks, */ icons } from "../../../utils-front";
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
        linkify: false,
        breaks: true,
    });

    md.block.ruler.before("html_block", "llm_info", (state, startLine, _endLine, silent) => {
        const line = state.src.slice(state.bMarks[startLine], state.eMarks[startLine]);
        if (!line.startsWith("<llm-info>") || !line.endsWith("</llm-info>")) {
            return false;
        }
        if (silent) {
            return true;
        }
        const token = state.push("llm_info", "", 0);
        token.content = line;
        state.line = startLine + 1;
        return true;
    });

    md.renderer.rules["llm_info"] = (tokens, idx) => `${tokens[idx].content}\n`;

    md.renderer.rules.fence = (tokens, idx) => {
        const token = tokens[idx];
        const lang = token.info.trim() || "code";
        const code = token.content;
        const escapedCode = escapeAttr(code);

        let accordionType = "code";
        let expandedAttr = "expanded";
        let languageAttr = "";

        let label = lang;
        let description = "";

        if (lang.startsWith("Think:")) {
            accordionType = "think";
            expandedAttr = "";
        } else if (lang.startsWith("Summary:")) {
            accordionType = "summary";
            expandedAttr = "";
            languageAttr = 'language="markdown"';
        } else if (lang.startsWith("Context:")) {
            accordionType = "context";
            expandedAttr = "";
        }

        if (accordionType !== "code") {
            const [prefix, ...rest] = lang.split(":");
            label = prefix + ":";
            description = rest.join(":").trim();
        }

        return `<collama-accordion type="${accordionType}" label="${label}" description="${escapeAttr(description)}" code="${escapedCode}" copyCode="${escapedCode}" ${languageAttr} ${expandedAttr}></collama-accordion>`;
    };

    return md;
}

const md = createMarkdownWithCodeHeader();

type MessageGroup =
    | { type: "tool-group"; tools: ToolMessage[]; startIndex: number }
    | { type: "single"; msg: ChatHistory; index: number };

/**
 * Groups consecutive tool messages (and intermediate assistant messages that
 * only contain tool_calls) into a single tool-group for accordion rendering.
 * Assistant messages that bridge two tool calls are absorbed into the group
 * so the UI shows one "Tools used: N" accordion per uninterrupted tool chain.
 */
function groupMessages(messages: ChatHistory[]): MessageGroup[] {
    const groups: MessageGroup[] = [];
    let toolBuffer: ToolMessage[] = [];
    let toolStartIndex = 0;

    const flushTools = () => {
        if (toolBuffer.length > 0) {
            groups.push({ type: "tool-group", tools: toolBuffer, startIndex: toolStartIndex });
            toolBuffer = [];
        }
    };

    for (const [i, msg] of messages.entries()) {
        const isToolBridge =
            msg.role === "assistant" &&
            !msg.content &&
            ((msg.tool_calls?.length ?? 0) > 0 || messages[i + 1]?.role === "tool");

        if (msg.role === "tool" || isToolBridge) {
            if (toolBuffer.length === 0) {
                toolStartIndex = i;
            }
            if (msg.role === "tool") {
                toolBuffer.push(msg);
            }
            continue;
        }

        flushTools();
        groups.push({ type: "single", msg, index: i });
    }

    flushTools();
    return groups;
}

@customElement("collama-chatoutput")
export class ChatOutput extends LitElement {
    static styles = outputStyles;

    @property({ type: Array }) messages: ChatHistory[] = [];
    @property({ type: Number }) contextStartIndex: number = 0;
    @property({ type: Boolean }) isGenerating: boolean = false;
    @state() editingIndex: number | null = null;

    // private highlightedBlocks = new WeakSet<Element>();
    private renderedMarkdownCache = new Map<string, string>();
    // private highlightDebounceTimer: number | null = null;

    private _stickyScroll = true;

    // Memoized event handlers for cleanup
    private handleWheel = (e: WheelEvent) => {
        if (e.deltaY < 0) {
            this._stickyScroll = false;
        }
    };

    private handleScroll = () => {
        const nearBottom = this._isNearBottom();
        if (nearBottom && !this._stickyScroll) {
            this._stickyScroll = true;
        }
        if (nearBottom !== this._wasNearBottom) {
            this._wasNearBottom = nearBottom;
            if (nearBottom) {
                this._clearShowButtonTimer();
                this.dispatchEvent(
                    new CustomEvent("near-bottom-changed", {
                        detail: { nearBottom: true },
                        bubbles: true,
                        composed: true,
                    }),
                );
            } else if (this._hasScrollbar()) {
                this._clearShowButtonTimer();
                this._showButtonTimer = window.setTimeout(() => {
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
    };

    private _wasNearBottom = true;
    private _showButtonTimer: number | undefined;

    private _clearShowButtonTimer() {
        if (this._showButtonTimer !== undefined) {
            clearTimeout(this._showButtonTimer);
            this._showButtonTimer = undefined;
        }
    }

    private _hasScrollbar(): boolean {
        return this.scrollHeight > this.clientHeight;
    }

    private _isNearBottom(): boolean {
        const threshold = 5;
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

    /** Scrolls to bottom and activates sticky scroll. Used by: submit, scroll button, tool-confirm, session switch. */
    public scrollToBottom() {
        this._stickyScroll = true;
        this.scrollTo({ top: this.scrollHeight, behavior: "smooth" });
    }

    firstUpdated() {
        this.addEventListener("wheel", this.handleWheel);
        this.addEventListener("scroll", this.handleScroll);
    }

    disconnectedCallback() {
        this.removeEventListener("wheel", this.handleWheel);
        this.removeEventListener("scroll", this.handleScroll);
        this._clearShowButtonTimer();
        super.disconnectedCallback();
    }

    updated(changed: Map<string, unknown>) {
        if (changed.has("messages") && this._stickyScroll) {
            requestAnimationFrame(() => {
                this.scrollTo({ top: this.scrollHeight, behavior: "smooth" });
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

        const groups = groupMessages(messages);

        return html`
            <div class="output-container">
                ${repeat(
                    groups,
                    (group: MessageGroup) => {
                        if (group.type === "tool-group") {
                            return `tool-group-${group.tools[0].customKeys!.id!}`;
                        }
                        return group.msg.customKeys!.id!;
                    },
                    (group: MessageGroup) => {
                        if (group.type === "tool-group") {
                            const isOutOfContext =
                                this.contextStartIndex > 0 && group.startIndex < this.contextStartIndex;
                            const outOfContextClass = isOutOfContext ? "out-of-context" : "";
                            const label = `Tools used: ${group.tools.length}`;

                            return html`
                                <div class="message tool ${outOfContextClass}">
                                    <div class="bubble-tool">
                                        <collama-accordion type="tool-group" label="${label}">
                                            ${repeat(
                                                group.tools,
                                                (tool: ToolMessage) => tool.customKeys!.id!,
                                                (tool: ToolMessage) =>
                                                    renderToolMessage({
                                                        msg: tool,
                                                        outOfContextClass: "",
                                                        warningIcon: "",
                                                        bare: true,
                                                    }),
                                            )}
                                        </collama-accordion>
                                    </div>
                                </div>
                            `;
                        }

                        const { msg, index } = group;
                        const isOutOfContext = this.contextStartIndex > 0 && index < this.contextStartIndex;
                        const outOfContextClass = isOutOfContext ? "out-of-context" : "";
                        const warningIcon = isOutOfContext
                            ? html`<span class="warning-icon" title="Not in context">${icons.alertTriangle}</span>`
                            : "";

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
                    },
                )}
            </div>
        `;
    }
}
