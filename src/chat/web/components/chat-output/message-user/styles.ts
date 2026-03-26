import { css } from "lit";
import { themeColors } from "../../../styles/theme-colors";
import { themeFonts } from "../../../styles/theme-fonts";
import { themeStyles } from "../../../styles/theme-styles";

export const userStyles = css`
    .message.user {
        margin: 24px 0;
    }

    .role-user {
        background-color: ${themeColors.user};
    }

    .bubble-user {
        border: 2px solid ${themeColors.uiBorder};
        background: ${themeColors.uiBackground};
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
        color: ${themeColors.textWhite};
        font-size: ${themeFonts.small};
        line-height: 1;
        vertical-align: middle;
        cursor: pointer;
        opacity: 1;
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
`;

export const editStyles = css`
    :host {
        display: block;
    }

    .edit-textarea {
        width: 100%;
        min-height: auto;
        padding: 8px;
        margin-top: 4px;
        border: 1px solid ${themeColors.uiBorder};
        border-radius: 8px;
        background: ${themeColors.uiBackground};
        color: ${themeColors.uiFont};
        font-family: inherit;
        font-size: ${themeFonts.user};
        resize: vertical;
        box-sizing: border-box;
        line-height: 1.4;
    }

    .edit-textarea:focus {
        ${themeStyles.focus}
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
        font-size: ${themeFonts.medium};
        cursor: pointer;
        color: ${themeColors.textWhite};
    }

    .edit-send {
        background: ${themeColors.submit};
    }

    .edit-send:hover {
        background: ${themeColors.submitHover};
    }

    .edit-cancel {
        background: ${themeColors.cancel};
    }

    .edit-cancel:hover {
        background: ${themeColors.cancelHover};
    }
`;
