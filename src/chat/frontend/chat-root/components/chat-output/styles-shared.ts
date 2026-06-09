import { css } from "lit";
import { codeBlockStyles, inlineCodeStyles, themeColors, themeFonts, themeStyles } from "../../../styles";

export const outputStyles = [
    ...codeBlockStyles,
    ...inlineCodeStyles,
    css`
        .message {
            margin-bottom: 0;
        }

        .message.assistant,
        .message.tool {
            padding: 0;
            margin: 0;
        }

        .message.user {
            margin: 24px 0;
        }

        .bubble-assistant,
        .bubble-tool {
            padding: 0 8px;
            margin: 0;
        }

        .bubble-user {
            ${themeStyles.border.normal}
            background: ${themeColors.uiBackground};
        }

        /* Calm heading stripe: flush to the top edge of the bubble, no background */
        .user-heading {
            display: flex;
            align-items: center;
            justify-content: space-between;
            margin: -8px -8px 4px -8px;
            padding: 2px 8px;
            border: ${themeStyles.border.normal};
        }

        .role-datetime {
            font-size: 1em;
            font-weight: ${themeFonts.weight.light};
            color: ${themeColors.uiFont};
        }

        .message-actions {
            display: flex;
            align-items: center;
            gap: 1px;
        }

        .resend-button,
        .delete-button,
        .edit-button,
        .summarize-button {
            display: inline-flex;
            align-items: center;
            justify-content: center;
            gap: 4px;
            padding: 2px;
            border: none;
            ${themeStyles.borderRadius.small}
            background: transparent;
            color: ${themeColors.uiFont};
            font-size: ${themeFonts.size.small};
            line-height: 1;
            vertical-align: middle;
            cursor: pointer;
            transition: background 0.15s;
        }

        .resend-button:hover,
        .edit-button:hover {
            background: ${themeColors.submitHover};
        }

        .delete-button:hover {
            background: ${themeColors.cancelHover};
        }

        .summarize-button:hover {
            background: ${themeColors.compressHover};
        }

        .resend-button:disabled,
        .delete-button:disabled,
        .edit-button:disabled,
        .summarize-button:disabled {
            cursor: not-allowed;
            opacity: 0.45;
        }

        .resend-button:hover:disabled,
        .delete-button:hover:disabled,
        .edit-button:hover:disabled,
        .summarize-button:hover:disabled {
            background: transparent;
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
