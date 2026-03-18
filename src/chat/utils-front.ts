import hljs from "highlight.js";
import hljscss from "highlight.js/styles/atom-one-dark-reasonable.min.css";
import { css, html, unsafeCSS } from "lit";
import { ChatHistory } from "../common/context-chat";

/**
 * Estimate token count for an array of messages using ~4 chars per token.
 * Serializes full message objects to account for tool args, tool_calls, etc.
 */
export function estimateTokens(messages: ChatHistory[]): number {
    const len = messages.reduce((sum, m) => sum + JSON.stringify(m).length, 0);
    return Math.round(len / 4);
}

export function logWebview(message: string) {
    window.vscode.postMessage({
        type: "log",
        message,
    });
}

export function llmInfoTag(tagContent: string): string {
    return `<llm-info>${tagContent}</llm-info>`;
}

/** Escape a string for safe use inside HTML attributes. */
export function escapeAttr(s: string): string {
    return s.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/'/g, "&#39;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/**
 * Shared hljs CSS styles for code blocks.
 * Import and spread into your component's static styles array.
 */
export const hljsStyles = [
    css`
        ${unsafeCSS(hljscss)}
    `,
    css`
        pre code.hljs {
            display: block;
            padding: 8px;
            border-radius: 0px;
            background: var(--vscode-editor-background);
            overflow-x: auto;
        }

        pre {
            margin: 0;
            background: var(--vscode-editor-background);
        }

        pre code {
            font-family: var(--vscode-editor-font-family), monospace;
            font-size: 0.95em;
            line-height: 1.4;
        }
    `,
];

/**
 * Highlight a code element using hljs auto-detection.
 * Returns true if highlighting was applied, false if element not found.
 */
export function highlightCodeBlock(container: ShadowRoot | null, selector = "pre code", language?: string): boolean {
    if (!container) {
        return false;
    }
    const codeBlock = container.querySelector(selector) as HTMLElement | null;
    if (codeBlock) {
        const code = codeBlock.textContent || "";
        const highlighted = language
            ? hljs.highlight(code, { language })
            : hljs.highlightAuto(code);
        codeBlock.innerHTML = highlighted.value;
        codeBlock.className = `hljs ${highlighted.language || language || ""}`;
        return true;
    }
    return false;
}

/**
 * Highlight all code blocks in a container that haven't been highlighted yet.
 * Uses a WeakSet to track which elements have been processed.
 * Uses hljs auto-detection for language identification.
 */
export function highlightAllCodeBlocks(
    container: ShadowRoot | null,
    highlightedSet: WeakSet<Element>,
    selector = "pre code",
): void {
    if (!container) {
        return;
    }
    container.querySelectorAll(selector).forEach((block) => {
        if (!highlightedSet.has(block)) {
            const codeBlock = block as HTMLElement;
            const code = codeBlock.textContent || "";
            const highlighted = hljs.highlightAuto(code);
            codeBlock.innerHTML = highlighted.value;
            codeBlock.className = `hljs ${highlighted.language || ""}`;
            highlightedSet.add(block);
        }
    });
}

/**
 * Feather Icons (https://feathericons.com/) - MIT License
 * Centralized SVG icons for consistent use across components.
 * Returns Lit TemplateResult objects for direct use in templates.
 */
export const icons = {
    /** Paperclip - used for context/attachment button */
    paperclip: html`<svg
        width="14"
        height="14"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
        stroke-linecap="round"
        stroke-linejoin="round"
    >
        <path
            d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"
        ></path>
    </svg>`,

    /** Corner down left - used for enter/submit button */
    enter: html`<svg
        width="14"
        height="14"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
        stroke-linecap="round"
        stroke-linejoin="round"
    >
        <polyline points="9 10 4 15 9 20"></polyline>
        <path d="M20 4v7a4 4 0 0 1-4 4H4"></path>
    </svg>`,

    /** Copy/clipboard - used for copy code button */
    copy: html`<svg
        width="14"
        height="14"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
        stroke-linecap="round"
        stroke-linejoin="round"
    >
        <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
        <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
    </svg>`,

    /** Code brackets - used for code accordion */
    code: html`<svg
        width="14"
        height="14"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
        stroke-linecap="round"
        stroke-linejoin="round"
    >
        <polyline points="16 18 22 12 16 6"></polyline>
        <polyline points="8 6 2 12 8 18"></polyline>
    </svg>`,

    /** Help circle - used for thinking accordion */
    thinking: html`<svg
        width="14"
        height="14"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
        stroke-linecap="round"
        stroke-linejoin="round"
    >
        <circle cx="12" cy="12" r="10"></circle>
        <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"></path>
        <line x1="12" y1="17" x2="12.01" y2="17"></line>
    </svg>`,

    /** Align justify - used for summary accordion */
    summary: html`<svg
        width="14"
        height="14"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
        stroke-linecap="round"
        stroke-linejoin="round"
    >
        <line x1="21" y1="10" x2="3" y2="10"></line>
        <line x1="21" y1="6" x2="3" y2="6"></line>
        <line x1="21" y1="14" x2="3" y2="14"></line>
        <line x1="21" y1="18" x2="3" y2="18"></line>
    </svg>`,

    /** Alert triangle - used for out-of-context warning */
    alertTriangle: html`<svg
        width="14"
        height="14"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
        stroke-linecap="round"
        stroke-linejoin="round"
    >
        <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path>
        <line x1="12" y1="9" x2="12" y2="13"></line>
        <line x1="12" y1="17" x2="12.01" y2="17"></line>
    </svg>`,

    /** Chevron down - used for accordion expand arrow */
    chevronDown: html`<svg
        width="12"
        height="12"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
        stroke-linecap="round"
        stroke-linejoin="round"
    >
        <polyline points="6 9 12 15 18 9"></polyline>
    </svg>`,

    /** Tool/wrench - used for tool accordion */
    tool: html`<svg
        width="14"
        height="14"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
        stroke-linecap="round"
        stroke-linejoin="round"
    >
        <path
            d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"
        ></path>
    </svg>`,

    /** X - used for cancel button */
    cancel: html`<svg
        width="14"
        height="14"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
        stroke-linecap="round"
        stroke-linejoin="round"
    >
        <line x1="18" y1="6" x2="6" y2="18"></line>
        <line x1="6" y1="6" x2="18" y2="18"></line>
    </svg>`,

    /** Minimize-2 (inward arrows) - used for compress button */
    compress: html`<svg
        width="14"
        height="14"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
        stroke-linecap="round"
        stroke-linejoin="round"
    >
        <polyline points="4 14 10 14 10 20"></polyline>
        <polyline points="20 10 14 10 14 4"></polyline>
        <line x1="10" y1="14" x2="3" y2="21"></line>
        <line x1="21" y1="3" x2="14" y2="10"></line>
    </svg>`,

    gallery: html`<svg
        width="14"
        height="14"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
        stroke-linecap="round"
        stroke-linejoin="round"
    >
        <rect x="3" y="3" width="7" height="7" rx="1" />
        <rect x="14" y="3" width="7" height="7" rx="1" />
        <rect x="3" y="14" width="7" height="7" rx="1" />
        <rect x="14" y="14" width="7" height="7" rx="1" />
    </svg>`,

    /** Check circle - used for auto accept button */
    checkCircle: html`<svg
        width="14"
        height="14"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
        stroke-linecap="round"
        stroke-linejoin="round"
    >
        <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
        <polyline points="22 4 12 14.01 9 11.01"></polyline>
    </svg>`,

    pencil: html`<svg
        width="14"
        height="14"
        viewBox="0 0 24 24"
        fill="none"
        stroke="white"
        stroke-width="2"
        stroke-linecap="round"
        stroke-linejoin="round"
    >
        <path d="M12 20h9" />
        <!-- Bodenlinie -->
        <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
        <!-- Bleistift -->
    </svg>`,
};
