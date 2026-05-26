import hljs from "highlight.js";
import hljsdarkcss from "highlight.js/styles/atom-one-dark-reasonable.min.css";
import hljslightcss from "highlight.js/styles/atom-one-light.min.css";
import { css, unsafeCSS } from "lit";
import { AttachedContext } from "../../../common/context-chat";
import { themeColors, themeFonts } from "../styles";

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

/** Builds a command URI for opening an unsaved workspace-root AGENTS.md draft. */
export function buildCreateAgentsMdDraftCommandUri(): string {
    return "command:collama.createAgentsMdDraft";
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

/** Builds user content with embedded contexts. */
export function buildUserContent(contexts: AttachedContext[], text: string): string {
    if (contexts.length === 0) {
        return text;
    }
    const blocks = contexts
        .map((ctx) => {
            const label = ctx.hasSelection ? `${ctx.fileName} (${ctx.startLine}-${ctx.endLine})` : ctx.fileName;
            const startLine = ctx.hasSelection ? ctx.startLine : 1;
            const content = ctx.isFolder
                ? ctx.content
                : ctx.content
                      .split("\n")
                      .map((line, i) => `${startLine + i}\t${line}`)
                      .join("\n");
            return `${llmInfoTag(`filepath: ${ctx.relativePath}`)}\n\`\`\`Context: ${label}\n${content}\n\`\`\``;
        })
        .join("\n\n");
    return `${blocks}\n\n${text}`;
}

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
            font-family: ${themeFonts.familyMono};
            font-weight: ${themeFonts.weight.thin} !important;
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
