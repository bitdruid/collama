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
        border: 2px solid var(--color-ui-border);
        background: var(--color-ui-background);
    }

    .out-of-context .bubble.bubble-user {
        background: rgba(255, 60, 60, 0.08);
        border-color: rgba(255, 60, 60, 0.25);
    }

    .message-actions {
        display: flex;
        align-items: center;
        gap: 4px;
    }

    .resend-button,
    .delete-button,
    .edit-button,
    .summarize-button {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        padding: 2px 6px;
        border: none;
        border-radius: 4px;
        background: transparent;
        color: var(--color-ui-element-font);
        font-size: 11px;
        cursor: pointer;
        opacity: 1;
        transition: background 0.15s;
    }

    .resend-button:hover,
    .edit-button:hover {
        background: var(--color-submit-hover);
    }

    .delete-button:hover {
        background: var(--color-cancel-hover);
    }

    .summarize-button:hover {
        background: var(--color-compress-hover);
    }
`;

export const editStyles = css`
    ${themeColors}
    :host {
        display: block;
    }

    .edit-textarea {
        width: 100%;
        min-height: auto;
        padding: 8px;
        margin-top: 4px;
        border: 1px solid var(--color-ui-border);
        border-radius: 4px;
        background: var(--color-ui-background);
        color: var(--color-ui-font);
        font-family: inherit;
        font-size: 13px;
        resize: vertical;
        box-sizing: border-box;
        line-height: 1.4;
    }

    .edit-textarea:focus {
        outline: 1px solid var(--color-ui-border);
    }

    .edit-actions {
        display: flex;
        gap: 6px;
        margin-top: 6px;
        justify-content: flex-end;
    }

    .edit-send,
    .edit-cancel {
        padding: 4px 12px;
        border: none;
        border-radius: 4px;
        font-size: 12px;
        cursor: pointer;
        color: var(--color-ui-element-font);
    }

    .edit-send {
        background: var(--color-submit);
    }

    .edit-send:hover {
        background: var(--color-submit-hover);
    }

    .edit-cancel {
        background: var(--color-cancel);
    }

    .edit-cancel:hover {
        background: var(--color-cancel-hover);
    }
`;
