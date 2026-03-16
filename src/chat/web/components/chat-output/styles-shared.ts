import { css } from "lit";
import { hljsStyles } from "../../../utils-front";
import { assistantStyles } from "./message-assistant/styles";
import { toolStyles } from "./message-tool/styles";
import { userStyles } from "./message-user/styles";

export const outputStyles = [
    ...hljsStyles,
    assistantStyles,
    userStyles,
    toolStyles,
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
            color: #fff;
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
            border: 1px solid var(--vscode-editorWidget-border, #444);
            padding: 6px 10px;
            text-align: left;
        }

        th {
            background: var(--vscode-editorWidget-background);
            font-weight: bold;
        }

        tr:nth-child(even) {
            background: var(--vscode-editor-background);
        }

        tr:hover {
            background: var(--vscode-list-hoverBackground);
        }

        .out-of-context .bubble {
            background: rgba(255, 60, 60, 0.08);
            border-color: rgba(255, 60, 60, 0.25);
        }

        .output-container {
            overflow-y: auto;
            scroll-behavior: smooth;
        }

        .warning-icon {
            margin-right: 4px;
            font-size: 0.9em;
        }
    `,
];
