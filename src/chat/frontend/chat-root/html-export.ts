/**
 * Serializes a live chat-output element (with its shadow DOM tree) into a
 * self-contained HTML document. Uses declarative shadow DOM templates so
 * Lit component styles (`:host`, scoped selectors) keep working in a regular
 * browser without needing the custom element classes to be defined.
 *
 * CSS variables resolved by the VS Code webview (`--vscode-*`, `--theme-*`)
 * are snapshotted into `:root` so the document looks the same when opened
 * outside the webview.
 */

const VOID_ELEMENTS = new Set([
    "area",
    "base",
    "br",
    "col",
    "embed",
    "hr",
    "img",
    "input",
    "link",
    "meta",
    "source",
    "track",
    "wbr",
]);

const SKIP_TAGS = new Set(["script", "noscript"]);

export function buildSelfContainedHtml(root: Element, title: string): string {
    const cssVars = snapshotCssVariables(root);
    const headStyles = snapshotHeadStyles();
    const bodyClass = document.body.className || "";
    const body = serializeElement(root);
    return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>${escapeText(title)}</title>
${headStyles}
<style>
:root {
${cssVars}
}
html, body {
  margin: 0;
  padding: 0;
  height: auto;
  overflow: visible;
  background: var(--vscode-sideBar-background, #1e1e1e);
  color: var(--vscode-foreground, #d4d4d4);
  font-family: var(--vscode-font-family, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif);
  font-size: var(--vscode-font-size, 13px);
}
body { padding: 16px; }
collama-chatoutput {
  display: block;
  position: static;
  overflow: visible;
  height: auto;
}
</style>
</head>
<body class="${escapeAttr(bodyClass)}">
${body}
</body>
</html>`;
}

/**
 * Copies all `<style>` blocks injected into `document.head` by VS Code's
 * webview shell. This is where `--vscode-*` design tokens live, so dumping
 * them verbatim is the most reliable way to preserve the theme.
 */
function snapshotHeadStyles(): string {
    return Array.from(document.head.querySelectorAll("style"))
        .map((s) => `<style>${s.textContent ?? ""}</style>`)
        .join("\n");
}

function snapshotCssVariables(el: Element): string {
    const collected = new Map<string, string>();
    const roots = [document.documentElement, document.body, el];
    for (const r of roots) {
        if (!r) {
            continue;
        }
        const cs = getComputedStyle(r);
        for (let i = 0; i < cs.length; i++) {
            const prop = cs[i];
            if (prop.startsWith("--vscode-") || prop.startsWith("--theme-")) {
                const value = cs.getPropertyValue(prop).trim();
                if (value && !collected.has(prop)) {
                    collected.set(prop, value);
                }
            }
        }
    }
    return Array.from(collected.entries())
        .map(([k, v]) => `  ${k}: ${v};`)
        .join("\n");
}

function serializeElement(el: Element): string {
    const tag = el.tagName.toLowerCase();
    if (SKIP_TAGS.has(tag)) {
        return "";
    }

    const attrs = Array.from(el.attributes)
        .map((a) => ` ${a.name}="${escapeAttr(a.value)}"`)
        .join("");

    if (VOID_ELEMENTS.has(tag)) {
        return `<${tag}${attrs}>`;
    }

    let inner = "";

    if (el.shadowRoot) {
        const mode = el.shadowRoot.mode;
        const adopted =
            (el.shadowRoot as ShadowRoot & { adoptedStyleSheets?: CSSStyleSheet[] }).adoptedStyleSheets ?? [];
        const adoptedCss = adopted
            .map((sheet) => {
                try {
                    return Array.from(sheet.cssRules)
                        .map((r) => r.cssText)
                        .join("\n");
                } catch {
                    return "";
                }
            })
            .filter(Boolean)
            .join("\n");

        inner += `<template shadowrootmode="${mode}">`;
        if (adoptedCss) {
            inner += `<style>${adoptedCss}</style>`;
        }
        inner += Array.from(el.shadowRoot.childNodes).map(serializeNode).join("");
        inner += `</template>`;
    }

    if (tag === "textarea") {
        // textarea content is its value; use plain text to avoid double-serialization
        inner += escapeText((el as HTMLTextAreaElement).value || el.textContent || "");
    } else {
        inner += Array.from(el.childNodes).map(serializeNode).join("");
    }

    return `<${tag}${attrs}>${inner}</${tag}>`;
}

function serializeNode(node: Node): string {
    if (node.nodeType === Node.ELEMENT_NODE) {
        return serializeElement(node as Element);
    }
    if (node.nodeType === Node.TEXT_NODE) {
        return escapeText(node.textContent ?? "");
    }
    return "";
}

function escapeText(s: string): string {
    return s.replace(/[&<>]/g, (c) => (c === "&" ? "&amp;" : c === "<" ? "&lt;" : "&gt;"));
}

function escapeAttr(s: string): string {
    return s.replace(/[&"<>]/g, (c) => (c === "&" ? "&amp;" : c === '"' ? "&quot;" : c === "<" ? "&lt;" : "&gt;"));
}
