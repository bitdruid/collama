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
        button-submit,
        button-context,
        button-cancel,
        button-compress {
            display: inline-flex;
            align-items: center;
            justify-content: center;

            width: 28px;
            height: 28px;
            aspect-ratio: 1 / 1;

            padding: 0;
            border-radius: 50%;

            line-height: 1;

            color: #fff;
            border: none;
            cursor: pointer;
            box-sizing: border-box;
        }
        button-submit {
            background-color: #2277a8;
        }
        button-submit:hover {
            background-color: #185d86;
        }
        button-submit:disabled {
            background-color: #555;
            cursor: not-allowed;
            opacity: 0.5;
        }
        button-context {
            background-color: #2277a8;
        }
        button-context:hover {
            background-color: #185d86;
        }
        button-cancel {
            background-color: #a82222;
        }
        button-cancel:hover {
            background-color: #861818;
        }
        button-compress {
            background-color: #7a6030;
        }
        button-compress:hover {
            background-color: #5a4622;
        }
        .context-display {
            display: inline-flex;
            align-items: center;
            gap: 4px;
            padding: 4px 8px;
            border-radius: 12px;
            background-color: #2277a8;
            color: #fff;
            font-size: 12px;
            white-space: nowrap;
        }
        .context-close {
            display: inline-flex;
            align-items: center;
            justify-content: center;
            width: 14px;
            height: 14px;
            margin-left: 4px;
            border-radius: 50%;
            background: rgba(255, 255, 255, 0.2);
            border: none;
            color: #fff;
            font-size: 10px;
            line-height: 1;
            cursor: pointer;
            padding: 0;
        }
        .context-close:hover {
            background: rgba(255, 255, 255, 0.4);
        }
        .context-list {
            display: flex;
            flex-wrap: wrap;
            gap: 4px;
            align-items: center;
        }
        button-row {
            display: flex;
            justify-content: flex-end;
            margin-top: 8px;
            gap: 8px;
        }
    `;