import { css } from "lit";



export const chatInputStyles  = css`
        :host {
            border-radius: 8px;
            border: 2px solid var(--vscode-commandCenter-activeBorder);
            background: var(--vscode-input-background);
        }
        textarea {
            flex: 1;
            width: 100%;
            font-size: 14px;
            padding: 8px;
            border-radius: 8px;
            border: none;
            color: var(--vscode-editor-foreground);
            background: transparent;
            resize: none;
            overflow: hidden;
            line-height: 1.2em;
            box-sizing: border-box;
        }
        button-row {
            display: flex;
            justify-content: flex-end;
            margin-top: 8px;
            gap: 8px;
        }
    `;