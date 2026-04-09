import { css } from "lit";
import { hljsStyles } from "../../../utils-front";
import { themeColors } from "../../styles/theme-colors";
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
            font-weight: bold;
            font-size: 1em;
            margin-bottom: 6px;
            padding: 2px 6px;
            border-radius: 4px;
            color: ${themeColors.cleanWhite};
        }

        .role-label {
            flex: 1;
        }

        .message {
            margin-bottom: 0;
        }

        .bubble {
            padding: 8px;
            border-radius: 8px;
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
            font-weight: bold;
        }

        tr:hover {
            background: ${themeColors.uiBackgroundHover};
        }

        .out-of-context .bubble {
            background: ${themeColors.outOfContextBackground};
            border-color: ${themeColors.outOfContextBorder};
        }

        .output-container {
            overflow-y: auto;
            scroll-behavior: smooth;
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

        .search-highlight {
            background: ${themeColors.searchHighlight};
            border-radius: 2px;
        }

        .search-highlight.active {
            background: ${themeColors.searchHighlightActive};
            border-radius: 2px;
        }
    `,
];
