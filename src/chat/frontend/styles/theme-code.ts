import hljsdarkcss from "highlight.js/styles/atom-one-dark-reasonable.min.css";
import hljslightcss from "highlight.js/styles/atom-one-light.min.css";
import { css, unsafeCSS } from "lit";

import { themeColors } from "./theme-colors";
import { themeFonts } from "./theme-fonts";
import { themeStyles } from "./theme-styles";

/**
 * hljs theme + block-level code styling (`pre`, `pre code`).
 * Spread into a component's static styles array. Shared by chat-output and chat-accordion.
 */
export const codeBlockStyles = [
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
            border-radius: 0px;
            background: ${themeColors.uiBackgroundDimm} !important;
            overflow-x: auto;
        }

        pre {
            margin: 0;
            background: ${themeColors.uiBackgroundDimm} !important;
        }

        pre code {
            padding: 8px 10px !important;
            font-family: ${themeFonts.familyMono};
            font-weight: ${themeFonts.weight.light} !important;
            font-size: 0.95em;
        }

        pre code.hljs .hljs-addition {
            display: inline-block;
            width: 100%;
            background: rgba(63, 185, 80, 0.15);
        }

        pre code.hljs .hljs-deletion {
            display: inline-block;
            width: 100%;
            background: rgba(248, 81, 73, 0.15);
        }
    `,
];

/**
 * Inline (non-`pre`) code styling: backtick text and file-link code.
 * Used by chat-output. Prefer this CSS rule over native code parsing.
 */
export const inlineCodeStyles = [
    css`
        :not(pre) > code {
            color: ${themeColors.uiFontHighlight};
            background: ${themeColors.uiFontHighlightBackground};
            border-radius: ${themeStyles.borderRadius.medium};
            padding: 0.08em 0.4em;
            font-size: 0.9em;
            font-family: ${themeFonts.familyMono};
            font-weight: ${themeFonts.weight.light};
            white-space: break-spaces;
        }

        a.file-link > code {
            color: inherit;
            background: none;
            padding: 0;
            font-size: inherit;
            font-family: ${themeFonts.family};
            font-weight: ${themeFonts.weight.normal};
        }
    `,
];
