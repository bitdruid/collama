import MarkdownIt from "markdown-it";
import type StateCore from "markdown-it/lib/rules_core/state_core.mjs";
import Token from "markdown-it/lib/token.mjs";
import { buildOpenFileCommandUri, escapeAttr, FILE_PATH_RE } from "../../../utils-front";

const TABLE_CELL_LINE_BREAK_RE = /<br\s*\/?>/gi;

function splitTextTokenOnLineBreaks(token: Token): Token[] {
    const children: Token[] = [];
    const text = token.content;
    let lastIndex = 0;
    let match: RegExpExecArray | null;

    TABLE_CELL_LINE_BREAK_RE.lastIndex = 0;
    while ((match = TABLE_CELL_LINE_BREAK_RE.exec(text)) !== null) {
        if (match.index > lastIndex) {
            const before = new Token("text", "", 0);
            before.content = text.slice(lastIndex, match.index);
            children.push(before);
        }

        children.push(new Token("hardbreak", "br", 0));
        lastIndex = match.index + match[0].length;
    }

    if (children.length === 0) {
        return [token];
    }

    if (lastIndex < text.length) {
        const after = new Token("text", "", 0);
        after.content = text.slice(lastIndex);
        children.push(after);
    }

    return children;
}

function renderTableCellLineBreaks(state: StateCore) {
    let inTableCell = false;

    for (const block of state.tokens) {
        if (block.type === "td_open" || block.type === "th_open") {
            inTableCell = true;
            continue;
        }

        if (block.type === "td_close" || block.type === "th_close") {
            inTableCell = false;
            continue;
        }

        if (!inTableCell || block.type !== "inline" || !block.children) {
            continue;
        }

        const newChildren: Token[] = [];
        for (const child of block.children) {
            if (child.type === "text") {
                newChildren.push(...splitTextTokenOnLineBreaks(child));
            } else {
                newChildren.push(child);
            }
        }
        block.children = newChildren;
    }
}

function renderFilePathLinks(state: StateCore) {
    for (const block of state.tokens) {
        if (block.type !== "inline" || !block.children) {
            continue;
        }

        const newChildren: Token[] = [];
        for (const child of block.children) {
            if (child.type !== "text") {
                newChildren.push(child);
                continue;
            }

            const text = child.content;
            FILE_PATH_RE.lastIndex = 0;
            let lastIndex = 0;
            let match: RegExpExecArray | null;
            let matched = false;

            while ((match = FILE_PATH_RE.exec(text)) !== null) {
                const [full, filePath, lineAnchor] = match;
                const href = buildOpenFileCommandUri(filePath, lineAnchor);
                matched = true;

                if (match.index > lastIndex) {
                    const pre = new Token("text", "", 0);
                    pre.content = text.slice(lastIndex, match.index);
                    newChildren.push(pre);
                }

                const open = new Token("link_open", "a", 1);
                open.attrSet("href", href);
                open.attrSet("class", "file-link");
                newChildren.push(open);

                const inner = new Token("text", "", 0);
                inner.content = full;
                newChildren.push(inner);

                newChildren.push(new Token("link_close", "a", -1));

                lastIndex = match.index + full.length;
            }

            if (!matched) {
                newChildren.push(child);
                continue;
            }

            if (lastIndex < text.length) {
                const tail = new Token("text", "", 0);
                tail.content = text.slice(lastIndex);
                newChildren.push(tail);
            }
        }
        block.children = newChildren;
    }
}

/**
 * Create a MarkdownIt instance configured with chat-specific rules:
 * code-fence accordions, hidden llm-info blocks, table cell breaks, and file links.
 */
function createChatMarkdown(): MarkdownIt {
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

    md.core.ruler.push("table_cell_line_breaks", renderTableCellLineBreaks);
    md.core.ruler.push("file_path_links", renderFilePathLinks);

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

export const chatMarkdown = createChatMarkdown();
