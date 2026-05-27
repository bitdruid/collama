import { css } from "lit";
import { hljsStyles } from "../../utils";
import { themeColors, themeFonts, themeStyles } from "../../../styles";
import { assistantStyles } from "./message-assistant/styles";
import { toolStyles } from "./message-tool/styles";
import { userStyles } from "./message-user/styles";

export const outputStyles = [
    ...hljsStyles,
    assistantStyles,
    userStyles,
    toolStyles,
    css`
        llm-info {
            display: none;
        }
    `,
    css`
        .role-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            font-weight: ${themeFonts.weight.bold};
            font-size: 1em;
            margin-bottom: 6px;
            padding: 2px 10px;
            ${themeStyles.borderRadius.small}
            color: ${themeColors.cleanWhite};
        }

        .role-label {
            flex: 1;
        }

        .role-datetime {
            font-size: 0.85em;
            font-weight: ${themeFonts.weight.normal};
            opacity: 0.8;
            margin-left: 8px;
            margin-right: 8px;
        }

        .message {
            margin-bottom: 0;
        }

        .bubble {
            padding: 8px;
            ${themeStyles.borderRadius.large}
            overflow-x: auto;
            max-width: 100%;
        }

        .bubble > p {
            margin: 0;
        }

        .bubble > pre {
            margin: 8px 0;
            white-space: pre;
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
            border: 1px solid ${themeColors.uiBorder};
            padding: 6px 10px;
            text-align: left;
        }

        th {
            background: ${themeColors.uiBackgroundDimm};
            font-weight: ${themeFonts.weight.bold};
        }

        tr:hover {
            background: ${themeColors.uiBackgroundHover};
        }

        .out-of-context .bubble {
            background: ${themeColors.outOfContextBackground};
            border-color: ${themeColors.outOfContextBorder};
        }

        .output-container {
            scroll-behavior: smooth;
        }

        collama-loading-dots {
            display: block;
            margin: 24px 0 24px 8px;
        }

        .warning-icon {
            margin-right: 4px;
            font-size: 0.9em;
        }

        a {
            color: ${themeColors.hyperlink};
            text-decoration: none;
        }

        a:hover {
            color: ${themeColors.hyperlinkHover};
            text-decoration: underline;
        }

        /* Style for backtick text by css rule prefered over native code parsing */

        :not(pre) > code {
            color: ${themeColors.uiFontHighlight};
            background: ${themeColors.uiFontHighlightBackground};
            ${themeStyles.borderRadius.medium}
            padding: 0.08em 0.4em;
            font-size: 0.9em;
            font-family: ${themeFonts.familyMono};
            font-weight: ${themeFonts.weight.thin};
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
