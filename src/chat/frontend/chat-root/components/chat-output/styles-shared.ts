import { css } from "lit";
import { codeBlockStyles, inlineCodeStyles, themeColors, themeFonts, themeStyles } from "../../../styles";
import { assistantStyles } from "./message-assistant/styles";
import { toolStyles } from "./message-tool/styles";
import { userStyles } from "./message-user/styles";

export const outputStyles = [
    ...codeBlockStyles,
    ...inlineCodeStyles,
    assistantStyles,
    userStyles,
    toolStyles,
    css`
        .role-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            font-weight: ${themeFonts.weight.bold};
            font-size: 1em;
            line-height: 1;
            text-box: trim-both cap alphabetic;
            margin-bottom: 6px;
            padding: 4px 10px;
            ${themeStyles.borderRadius.small}
            color: ${themeColors.cleanWhite};
        }

        .role-label {
            flex: 1;
        }

        .role-datetime {
            font-size: 0.85em;
            font-weight: ${themeFonts.weight.light};
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
            ${themeStyles.border.normal}
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
    `,
];
