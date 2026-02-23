
import {css} from "lit";
import { hljsStyles } from "../../../../utils";

export const outputStyles = [
        ...hljsStyles,
        css`
            .loading {
                font-style: italic;
                opacity: 0.7;
            }

            .loading .dots::after {
                content: "";
                animation: blink 1s steps(3, end) infinite;
            }

            @keyframes blink {
                0%,
                20% {
                    content: "";
                }
                40% {
                    content: ".";
                }
                60% {
                    content: "..";
                }
                80%,
                100% {
                    content: "...";
                }
            }
        `,
        css`
            :host {
            }

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

            .message-actions {
                display: flex;
                gap: 4px;
            }

            .resend-button {
                display: inline-flex;
                align-items: center;
                justify-content: center;
                padding: 2px 6px;
                border: none;
                border-radius: 4px;
                background: transparent;
                color: #fff;
                font-size: 11px;
                cursor: pointer;
                opacity: 1;
                transition: background 0.15s;
            }

            .resend-button:hover {
                background: rgba(255, 255, 255, 0.4);
            }

            .delete-button {
                display: inline-flex;
                align-items: center;
                justify-content: center;
                padding: 2px 6px;
                border: none;
                border-radius: 4px;
                background: transparent;
                color: #fff;
                font-size: 11px;
                cursor: pointer;
                opacity: 1;
                transition: background 0.15s;
            }

            .delete-button:hover {
                background: rgba(255, 80, 80, 0.5);
            }

            .edit-button {
                display: inline-flex;
                align-items: center;
                justify-content: center;
                padding: 2px 6px;
                border: none;
                border-radius: 4px;
                background: transparent;
                color: #fff;
                font-size: 11px;
                cursor: pointer;
                opacity: 1;
                transition: background 0.15s;
            }

            .edit-button:hover {
                background: rgba(255, 255, 255, 0.4);
            }

            .role-user {
                background-color: #2277a8;
            }

            .role-assistant {
                background-color: #4aaf50;
            }

            .message {
                margin-bottom: 12px;
            }

            .bubble {
                margin: 24px 0;
                padding: 8px;
                border-radius: 8px;
            }

            .bubble-user {
                border: 1px solid var(--vscode-commandCenter-activeBorder);
                background: var(--vscode-input-background);
            }

            .bubble > p {
                margin: 0;
            }

            .bubble > pre {
                margin: 8px 0;
                white-space: pre;
            }

            /* Table styling to prevent overflow */
            .bubble {
                overflow-x: auto;
                max-width: 100%;
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

            .out-of-context .bubble.bubble-user {
                background: rgba(255, 60, 60, 0.08);
                border-color: rgba(255, 60, 60, 0.25);
            }

            .warning-icon {
                margin-right: 4px;
                font-size: 0.9em;
            }
        `,
]