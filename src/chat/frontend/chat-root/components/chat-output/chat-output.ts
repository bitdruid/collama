import { html, LitElement } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import { repeat } from "lit/directives/repeat.js";
import { ChatHistory, ToolMessage } from "../../../../../common/context-chat";
import { themeIcons } from "../../../styles";

import "../chat-loading-animation/dots";
import { CharReveal } from "./char-reveal";
import "./empty-state";
import { chatMarkdown } from "./markdown";
import { renderAssistantMessage, renderToolMessage, renderUserMessage } from "./messages";
import { outputStyles } from "./styles-shared";
import { TypingFx, typingFxStyles } from "./typing-fx";

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
    let toolStartIndex: number | null = null;

    const flushTools = () => {
        if (toolBuffer.length > 0) {
            groups.push({ type: "tool-group", tools: toolBuffer, startIndex: toolStartIndex ?? 0 });
            toolBuffer = [];
            toolStartIndex = null;
        }
    };

    for (const [i, msg] of messages.entries()) {
        const isToolBridge =
            msg.role === "assistant" &&
            !msg.content.trim() &&
            ((msg.tool_calls?.length ?? 0) > 0 || messages[i + 1]?.role === "tool");

        if (msg.role === "tool" || isToolBridge) {
            // Skip failed tool calls — hide them from the webview entirely
            if (msg.role === "tool" && msg.customKeys?.toolMeta && !msg.customKeys.toolMeta.toolSuccess) {
                continue;
            }
            // Memory, decision, notepad, and background-shell tools are standalone
            // (own banner/accordion, not grouped into a tool-group).
            const ck = msg.customKeys;
            const isStandalone =
                msg.role === "tool" &&
                (ck?.toolMeta?.toolName === "memory" ||
                    ck?.toolMeta?.toolName === "decision" ||
                    ck?.toolMeta?.toolName === "notepad" ||
                    (ck?.toolMeta?.toolName === "shell" && !!ck?.toolMeta?.toolStatus));
            if (isStandalone) {
                flushTools();
                groups.push({ type: "single", msg, index: i });
                continue;
            }
            if (msg.role === "tool" && toolBuffer.length === 0) {
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
    static styles = [outputStyles, typingFxStyles];

    @property({ type: Array }) messages: ChatHistory[] = [];
    @property({ type: Number }) contextStartIndex: number = 0;
    @property({ type: Boolean }) isGenerating: boolean = false;
    @property({ type: Boolean }) showLoadingDots: boolean = false;
    @property({ type: Boolean }) showThinking: boolean = true;
    @property({ type: Boolean, reflect: true }) fancyTyping: boolean = false;
    @state() editingIndex: number | null = null;

    /** Display-only char-by-char reveal of the streaming message (fancy typing). */
    private _charReveal = new CharReveal(
        () => this._streamingMessage(),
        () => this.requestUpdate(),
    );

    /** "Blast-in" particle effect for streaming text (fancy typing only). */
    private _typingFx = new TypingFx(
        () => (this.shadowRoot?.getElementById("collama-fx-layer") as HTMLElement) ?? null,
        () => (this.shadowRoot?.querySelector(".bubble-assistant.streaming") as HTMLElement) ?? null,
    );

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
            return chatMarkdown.render(content);
        }
        let cached = this.renderedMarkdownCache.get(content);
        if (!cached) {
            cached = chatMarkdown.render(content);
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
        this._charReveal.stop();
        super.disconnectedCallback();
    }

    updated(changed: Map<string, unknown>) {
        const revealing = this.fancyTyping && this.isGenerating;
        // While revealing, the text grows every frame (via requestUpdate) with no
        // property change, so keep the view pinned on each of those renders too.
        const grew = changed.has("messages") || changed.has("isGenerating") || revealing;
        if (grew && this._stickyScroll) {
            // Instant scroll while streaming; Smooth only when idle.
            const behavior = this.isGenerating ? "auto" : "smooth";
            requestAnimationFrame(() => {
                this.scrollTo({ top: this.scrollHeight, behavior });
            });
        }
        if ((changed.has("messages") || changed.has("isGenerating")) && !this.isGenerating) {
            this._highlightAllAccordions();
        }

        // Sync reveal index, then feed typing-fx the revealed prefix so glyphs
        // stay in lockstep with the text.
        this._charReveal.sync(revealing);
        const content = this._streamingMessage().content;
        const capped = revealing ? this._charReveal.cap(content) : content;

        // Accordions paint one microtask after update(); measuring now would
        // read zero height and anchor following text inside the block. Wait
        // for them to render, then measure. Nodes survive until next frame.
        const pending = this.shadowRoot?.querySelectorAll<HTMLElement & { updateComplete?: Promise<unknown> }>(
            ".bubble-assistant.streaming collama-accordion",
        );
        if (pending && pending.length) {
            Promise.all([...pending].map((a) => a.updateComplete)).then(() => this._typingFx.update(revealing, capped));
        } else {
            this._typingFx.update(revealing, capped);
        }
    }

    /** The in-flight assistant message's content and id, or empty. */
    private _streamingMessage(): { content: string; id: string | null } {
        for (let i = this.messages.length - 1; i >= 0; i--) {
            if (this.messages[i].role === "assistant") {
                const m = this.messages[i];
                return { content: m.content ?? "", id: m.customKeys?.id ?? null };
            }
        }
        return { content: "", id: null };
    }

    private _highlightAllAccordions() {
        const accordions = this.shadowRoot?.querySelectorAll("collama-accordion");
        accordions?.forEach((el) => {
            (el as HTMLElement & { highlight?: () => void }).highlight?.();
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
                            ? html`<span class="warning-icon" title="Not in context"
                                  >${themeIcons.alertTriangle.medium}</span
                              >`
                            : "";

                        if (msg.role === "user") {
                            return renderUserMessage({
                                host: this,
                                messages,
                                msg,
                                index,
                                isGenerating: this.isGenerating,
                                outOfContextClass,
                                warningIcon,
                                getCachedMarkdown: this._getCachedMarkdown,
                            });
                        }

                        if (msg.role === "tool") {
                            return renderToolMessage({
                                msg: msg as ToolMessage,
                                outOfContextClass,
                                warningIcon,
                            });
                        }

                        const isStreaming = this.isGenerating && index === lastAssistantIndex && !!msg.content;
                        // Cap the in-flight message to the revealed prefix so the
                        // text streams in char by char (fancy typing only).
                        const revealMsg =
                            isStreaming && this.fancyTyping
                                ? { ...msg, content: this._charReveal.cap(msg.content) }
                                : msg;

                        return renderAssistantMessage({
                            msg: revealMsg,
                            outOfContextClass,
                            isStreaming,
                            showThinking: this.showThinking,
                            getCachedMarkdown: this._getCachedMarkdown,
                        });
                    },
                )}
                ${this.showLoadingDots ? html`<collama-loading-dots visible></collama-loading-dots>` : ""}
            </div>
            ${this.fancyTyping ? html`<div class="fx-layer" id="collama-fx-layer"></div>` : ""}
        `;
    }
}
