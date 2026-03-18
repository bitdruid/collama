import { css } from "lit";
import { themeColors } from "../../../styles/theme-colors";

export const userStyles = css`
    ${themeColors}
    .message.user {
        margin: 24px 0;
    }

    .role-user {
        background-color: var(--color-user);
    }

    .bubble-user {
        border: 2px solid var(--vscode-commandCenter-activeBorder);
        background: var(--vscode-input-background);
    }

    .out-of-context .bubble.bubble-user {
        background: rgba(255, 60, 60, 0.08);
        border-color: rgba(255, 60, 60, 0.25);
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
        color: var(--color-text-white);
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
        color: var(--color-text-white);
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
        color: var(--color-text-white);
        font-size: 11px;
        cursor: pointer;
        opacity: 1;
        transition: background 0.15s;
    }

    .edit-button:hover {
        background: rgba(255, 255, 255, 0.4);
    }
`;

export const editStyles = css`
    ${themeColors}
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
        background: var(--color-submit);
        color: var(--color-text-white);
        font-size: 12px;
        cursor: pointer;
    }

    .edit-send:hover {
        background: var(--color-submit-hover);
    }

    .edit-cancel {
        padding: 4px 12px;
        border: 1px solid var(--vscode-input-border, #3c3c3c);
        border-radius: 4px;
        background: transparent;
        color: var(--color-ui-font);
        font-size: 12px;
        cursor: pointer;
    }

    .edit-cancel:hover {
        background: rgba(255, 255, 255, 0.1);
    }
`;
