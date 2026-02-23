
import {css} from "lit";
import { hljsStyles } from "../../../../utils";

export const editStyles  =  css`
        :host {
            display: block;
        }

        .edit-textarea {
            width: 100%;
            min-height: 60px;
            padding: 8px;
            margin-top: 4px;
            border: 1px solid var(--vscode-input-border, #3c3c3c);
            border-radius: 4px;
            background: var(--vscode-input-background, #1e1e1e);
            color: var(--vscode-input-foreground, #ccc);
            font-family: inherit;
            font-size: 13px;
            resize: vertical;
            box-sizing: border-box;
        }

        .edit-textarea:focus {
            outline: 1px solid var(--vscode-focusBorder, #007fd4);
        }

        .edit-actions {
            display: flex;
            gap: 6px;
            margin-top: 6px;
            justify-content: flex-end;
        }

        .edit-send {
            padding: 4px 12px;
            border: none;
            border-radius: 4px;
            background: #2277a8;
            color: #fff;
            font-size: 12px;
            cursor: pointer;
        }

        .edit-send:hover {
            background: #1b6090;
        }

        .edit-cancel {
            padding: 4px 12px;
            border: 1px solid var(--vscode-input-border, #3c3c3c);
            border-radius: 4px;
            background: transparent;
            color: var(--vscode-foreground, #ccc);
            font-size: 12px;
            cursor: pointer;
        }

        .edit-cancel:hover {
            background: rgba(255, 255, 255, 0.1);
        }
    `;