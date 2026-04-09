import hljs from "highlight.js";
import hljsdarkcss from "highlight.js/styles/atom-one-dark-reasonable.min.css";
import hljslightcss from "highlight.js/styles/atom-one-light.min.css";
import { css, html, unsafeCSS } from "lit";
import { themeColors } from "./web/styles/theme-colors";
import { themeFonts } from "./web/styles/theme-fonts";

/**
 * Auto-adjusts a textarea's row count to fit its content.
 * Clears any inline height set by manual resizing so rows take effect.
 * Returns the new row count.
 */
export function adjustTextareaRows(textarea: HTMLTextAreaElement): number {
    textarea.style.height = "";
    textarea.rows = 1;
    const style = getComputedStyle(textarea);
    const lineHeight = parseFloat(style.lineHeight);
    const padding = parseFloat(style.paddingTop) + parseFloat(style.paddingBottom);
    const rows = Math.max(1, Math.round((textarea.scrollHeight - padding) / lineHeight));
    textarea.rows = rows;
    return rows;
}

export function logWebview(message: string) {
    window.vscode.postMessage({
        type: "log",
        message,
    });
}

let _toastTimer: number | null = null;

/** Displays a toast message for 2.5 s. Resets the timer if called again before it clears. */
export function showToast(message: string) {
    let el = document.getElementById("collama-toast");
    if (!el) {
        el = document.createElement("div");
        el.id = "collama-toast";
        Object.assign(el.style, {
            position: "fixed",
            bottom: "80px",
            left: "50%",
            transform: "translateX(-50%)",
            background: String(themeColors.uiBackgroundDimm),
            border: `1px solid ${themeColors.uiBorderDimm}`,
            color: String(themeColors.uiFont),
            padding: "6px 14px",
            borderRadius: "6px",
            fontSize: "12px",
            opacity: "0",
            transition: "opacity 0.3s",
            pointerEvents: "none",
            zIndex: "100",
        });
        document.body.appendChild(el);
    }
    el.textContent = message;
    el.style.opacity = "1";

    if (_toastTimer !== null) {
        window.clearTimeout(_toastTimer);
    }
    _toastTimer = window.setTimeout(() => {
        el!.style.opacity = "0";
        _toastTimer = null;
    }, 5000);
}

export function llmInfoTag(tagContent: string): string {
    return `<llm-info>${tagContent}</llm-info>`;
}

/**
 * Matches file paths in plain text (`src/foo.ts`, `./bar.js`,
 * `path/to/file.py#L42-L51`). Requires at least one `/` separator and a
 * 1-10 char extension. The lookbehind/lookahead avoid matching inside
 * URLs (`http://...`) or longer identifiers.
 */
export const FILE_PATH_RE =
    /(?<![`:/\w.])((?:\.{1,2}\/)?(?:[\w.-]+\/)+[\w.-]+\.\w{1,10})(?:#(L\d+(?:-L\d+)?))?(?![\w/:])/g;

/**
 * Builds a `command:collama.openFile?...` URI for the given file path.
 * Relative path resolution is handled host-side by the command itself.
 */
export function buildOpenFileCommandUri(filePath: string, lineAnchor?: string): string {
    let line: number | undefined;
    if (lineAnchor) {
        const m = lineAnchor.match(/^L(\d+)/);
        if (m) {
            line = Math.max(0, parseInt(m[1], 10) - 1);
        }
    }

    const args = line !== undefined ? [filePath, line] : [filePath];
    return `command:collama.openFile?${encodeURIComponent(JSON.stringify(args))}`;
}

/** Escape a string for safe use inside HTML attributes. */
export function escapeAttr(s: string): string {
    return s
        .replace(/&/g, "&amp;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;");
}

/**
 * Shared hljs CSS styles for code blocks.
 * Import and spread into your component's static styles array.
 */
export const hljsStyles = [
    css`
        :host-context(body.vscode-light),
        :host-context(body.vscode-high-contrast-light) {
            ${unsafeCSS(hljslightcss)}
        }
        :host-context(body:not(.vscode-light):not(.vscode-high-contrast-light)) {
            ${unsafeCSS(hljsdarkcss)}
        }
    `,
    css`
        pre code.hljs {
            display: block;
            padding: 8px;
            border-radius: 0px;
            background: ${themeColors.uiBackgroundDimm} !important;
            overflow-x: auto;
        }

        pre {
            margin: 0;
            background: ${themeColors.uiBackgroundDimm} !important;
        }

        pre code {
            font-family: ${themeFonts.family}, monospace;
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
        const highlighted = language ? hljs.highlight(code, { language }) : hljs.highlightAuto(code);
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
 * Feather Icons https://feathericons.com/ - MIT
 * Lucide - https://lucide.dev/ - ISC
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
        stroke-width="3"
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

    /** Message circle dashed - used for ghost chat button */
    ghostChat: html`<svg
        width="14"
        height="14"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
        stroke-linecap="round"
        stroke-linejoin="round"
    >
        <path d="M10.1 2.182a10 10 0 0 1 3.8 0"></path>
        <path d="M13.9 21.818a10 10 0 0 1-3.8 0"></path>
        <path d="M17.609 3.72a10 10 0 0 1 2.69 2.7"></path>
        <path d="M2.182 13.9a10 10 0 0 1 0-3.8"></path>
        <path d="M20.28 17.61a10 10 0 0 1-2.7 2.69"></path>
        <path d="M21.818 10.1a10 10 0 0 1 0 3.8"></path>
        <path d="M3.721 6.391a10 10 0 0 1 2.7-2.69"></path>
        <path d="m6.163 21.117-2.906.85a1 1 0 0 1-1.236-1.169l.965-2.98"></path>
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

    /** Folder - used for folder search results */
    folder: html`<svg
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
            d="M20 20a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.69-.9l-.81-1.2A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2Z"
        ></path>
    </svg>`,

    /** File text - used for summarize turn action */
    fileText: html`<svg
        width="14"
        height="14"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
        stroke-linecap="round"
        stroke-linejoin="round"
    >
        <path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7z"></path>
        <path d="M14 2v4a2 2 0 0 0 2 2h4"></path>
        <path d="M10 9H8"></path>
        <path d="M16 13H8"></path>
        <path d="M16 17H8"></path>
    </svg>`,

    pencil: html`<svg
        width="14"
        height="14"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
        stroke-linecap="round"
        stroke-linejoin="round"
    >
        <path d="M12 20h9" />
        <!-- Bodenlinie -->
        <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
        <!-- Bleistift -->
    </svg>`,

    /** Trash-2 - used for delete button */
    trash: html`<svg
        width="14"
        height="14"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
        stroke-linecap="round"
        stroke-linejoin="round"
    >
        <polyline points="3 6 5 6 21 6"></polyline>
        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
        <line x1="10" y1="11" x2="10" y2="17"></line>
        <line x1="14" y1="11" x2="14" y2="17"></line>
    </svg>`,

    /** Plus - used for add actions */
    plus: html`<svg
        width="14"
        height="14"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
        stroke-linecap="round"
        stroke-linejoin="round"
    >
        <line x1="12" y1="5" x2="12" y2="19"></line>
        <line x1="5" y1="12" x2="19" y2="12"></line>
    </svg>`,

    /** X - used for dismiss/cancel actions */
    x: html`<svg
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

    /** Search - used for chat search button */
    search: html`<svg
        width="14"
        height="14"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
        stroke-linecap="round"
        stroke-linejoin="round"
    >
        <circle cx="11" cy="11" r="8"></circle>
        <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
    </svg>`,

    /** Chevron up - used for search navigation */
    chevronUp: html`<svg
        width="12"
        height="12"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="3"
        stroke-linecap="round"
        stroke-linejoin="round"
    >
        <polyline points="18 15 12 9 6 15"></polyline>
    </svg>`,

    /** Check - used for confirm actions */
    check: html`<svg
        width="14"
        height="14"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
        stroke-linecap="round"
        stroke-linejoin="round"
    >
        <polyline points="20 6 9 17 4 12"></polyline>
    </svg>`,
};
