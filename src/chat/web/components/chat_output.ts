import hljs from "highlight.js";
// import hljscss from "highlight.js/styles/atom-one-dark.min.css";
// import hljscss from "highlight.js/styles/monokai.min.css";
// import hljscss from "highlight.js/styles/monokai-sublime.min.css";
// import hljscss from "highlight.js/styles/panda-syntax-dark.min.css;
// import hljscss from "highlight.js/styles/panda-syntax-light.min.css;
import hljscss from "highlight.js/styles/atom-one-dark-reasonable.min.css";
// import hljscss from "highlight.js/styles/an-old-hope.min.css";
// import hljscss from "highlight.js/styles/arta.min.css";
// import hljscss from "highlight.js/styles/devibeans.min.css";
import { LitElement, html, css, unsafeCSS } from "lit";
import { unsafeHTML } from "lit/directives/unsafe-html.js";
import MarkdownIt from "markdown-it";
import { ChatMessage } from "./chat_container";

const md = new MarkdownIt({
    html: false,
    linkify: true,
    breaks: true,
});

// custom renderer for code blocks to add language header with copy button
const defaultFence = md.renderer.rules.fence!;
md.renderer.rules.fence = (tokens, idx, options, env, self) => {
    const token = tokens[idx];
    const lang = token.info.trim() || "code";
    const code = token.content;
    const escapedCode = code.replace(/"/g, "&quot;").replace(/'/g, "&#39;");
    const defaultOutput = defaultFence(tokens, idx, options, env, self);
    return `<div class="code-block-wrapper">
        <div class="code-lang-header">
            <span class="code-lang-label">${lang}</span>
            <button class="code-copy-btn" data-code="${escapedCode}" title="Copy code">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                </svg>
                <span class="copy-text">Copy</span>
            </button>
        </div>
        ${defaultOutput}
    </div>`;
};

export class ChatOutput extends LitElement {
    static properties = {
        messages: { state: true },
    };

    static styles = [
        css`
            ${unsafeCSS(hljscss)}
        `,
        // override of hljs background
        css`
            pre code.hljs {
                display: block;
                overflow-x: auto;
                padding: 8px;
                border: 1px solid var(--vscode-commandCenter-activeBorder);
                border-top: none;
                border-radius: 0px;
                background: var(--vscode-editor-background);
            }
        `,
        css`
            .loading {
                font-style: italic;
                opacity: 0.7;
            }

            .loading .dots::after {
                content: "";
                animation: blink 1s steps(3, end) infinite;
            }

            @keyframes blink {
                0%,
                20% {
                    content: "";
                }
                40% {
                    content: ".";
                }
                60% {
                    content: "..";
                }
                80%,
                100% {
                    content: "...";
                }
            }
        `,
        css`
            :host {
            }

            .role-header {
                display: flex;
                font-weight: bold;
                font-size: 0.85em;
                margin-bottom: 6px;
                padding: 2px 6px;
                border-radius: 6px;
                color: #fff;
            }

            .role-user {
                background-color: #2277a8;
            }

            .role-assistant {
                background-color: #4aaf50;
            }

            .message {
                margin-bottom: 12px;
            }

            .bubble {
                margin: 20px 0;
                padding: 8px;
                border-radius: 8px;
            }

            .bubble-user {
                border: 1px solid var(--vscode-commandCenter-activeBorder);
                background: var(--vscode-input-background);
            }

            .bubble > p {
                margin: 0;
            }

            .bubble > pre {
                margin: 8px 0;
                white-space: pre;
            }

            .code-block-wrapper {
                margin: 4px 0;
            }

            .code-lang-header {
                display: flex;
                justify-content: space-between;
                align-items: center;
                //font-weight: bold;
                font-size: 1em;
                padding: 2px 8px;
                border: 1px solid var(--vscode-commandCenter-activeBorder);
                border-bottom: none;
                border-radius: 6px 6px 0 0;
                //background: #af4a4a;
                background: var(--vscode-textCodeBlock-background);
                color: var(--vscode-descriptionForeground);
            }

            .code-lang-label {
                text-transform: lowercase;
            }

            .code-copy-btn {
                display: flex;
                align-items: center;
                gap: 4px;
                background: transparent;
                border: none;
                color: var(--vscode-descriptionForeground);
                cursor: pointer;
                padding: 2px 6px;
                border-radius: 4px;
                font-size: 0.9em;
                transition:
                    background 0.15s,
                    color 0.15s;
            }

            .code-copy-btn:hover {
                background: var(--vscode-toolbar-hoverBackground);
                color: var(--vscode-foreground);
            }

            .code-copy-btn:active {
                background: var(--vscode-toolbar-activeBackground);
            }

            .code-copy-btn svg {
                flex-shrink: 0;
            }

            .code-block-wrapper pre {
                margin: 0;
            }

            /* Table styling to prevent overflow */
            .bubble {
                overflow-x: auto;
                max-width: 100%;
            }

            table {
                border-collapse: collapse;
                margin: 8px 0;
                font-size: 0.9em;
                min-width: 100%;
                max-width: 100%;
                display: block;
                overflow-x: auto;
            }

            th,
            td {
                border: 1px solid var(--vscode-editorWidget-border, #444);
                padding: 6px 10px;
                text-align: left;
            }

            th {
                background: var(--vscode-editorWidget-background);
                font-weight: bold;
            }

            tr:nth-child(even) {
                background: var(--vscode-editor-background);
            }

            tr:hover {
                background: var(--vscode-list-hoverBackground);
            }
        `,
    ];

    messages: ChatMessage[] = [];
    private loadingTimeouts = new Map<ChatMessage, number>();
    private highlightedBlocks = new WeakSet<Element>();

    updated(changed: Map<string, unknown>) {
        if (changed.has("messages")) {
            // only highlight code blocks that haven't been highlighted yet
            // to improve performance on large chat histories (massive re-renders)
            this.shadowRoot?.querySelectorAll("pre code").forEach((block) => {
                if (!this.highlightedBlocks.has(block)) {
                    hljs.highlightElement(block as HTMLElement);
                    this.highlightedBlocks.add(block);
                }
            });

            // copy button handlers
            this.shadowRoot?.querySelectorAll(".code-copy-btn").forEach((btn) => {
                if (!btn.hasAttribute("data-listener")) {
                    btn.setAttribute("data-listener", "true");
                    btn.addEventListener("click", async (e) => {
                        const button = e.currentTarget as HTMLElement;
                        const code = button.getAttribute("data-code") || "";
                        const decodedCode = code.replace(/&quot;/g, '"').replace(/&#39;/g, "'");
                        try {
                            await navigator.clipboard.writeText(decodedCode);
                            const textSpan = button.querySelector(".copy-text");
                            if (textSpan) {
                                const originalText = textSpan.textContent;
                                textSpan.textContent = "Copied!";
                                setTimeout(() => {
                                    textSpan.textContent = originalText;
                                }, 1500);
                            }
                        } catch (err) {
                            console.error("Failed to copy code:", err);
                        }
                    });
                }
            });

            this.scrollTop = this.scrollHeight;

            this.messages.forEach((msg) => {
                if (msg.loading && !this.loadingTimeouts.has(msg)) {
                    const timeout = window.setTimeout(() => {
                        msg.loading = false;
                        msg.content = msg.content || "No response received.";
                        this.loadingTimeouts.delete(msg);
                        this.requestUpdate();
                    }, 30000); // 20s timeout
                    this.loadingTimeouts.set(msg, timeout);
                }
            });
        }
    }

    render() {
        return html`
            ${this.messages.map(
                (msg) => html`
                    <div class="message ${msg.role}">
                        <div class="bubble ${msg.role === "user" ? "bubble-user" : ""}">
                            <div class="role-header ${msg.role === "user" ? "role-user" : "role-assistant"}">
                                ${msg.role === "user" ? "User" : "Assistant"}
                            </div>
                            ${msg.loading
                                ? html`<span class="loading">Generating response<span class="dots">...</span></span>`
                                : unsafeHTML(md.render(msg.content))}
                        </div>
                    </div>
                `,
            )}
        `;
    }
}

customElements.define("collama-chatoutput", ChatOutput);
