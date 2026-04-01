import { css } from "lit";
import { themeColors } from "../../../../styles/theme-colors";
import { themeFonts } from "../../../../styles/theme-fonts";
import { panelStyles } from "../../styles-shared";

export const galleryStyles = css`
    ${panelStyles}
    .popup-content {
        width: 400px;
        max-height: 50vh;
        display: flex;
        flex-direction: column;
        padding: 8px;
    }

    .prompt-item {
        display: flex;
        justify-content: space-between;
        align-items: center;
        gap: 12px;
        padding: 8px;
        cursor: pointer;
        border-radius: 4px;
        border: 1px solid ${themeColors.uiBorder};
        background: ${themeColors.uiBackground};
        color: ${themeColors.uiFont};
        font-size: ${themeFonts.medium};
        line-height: 1.4;
    }

    .prompt-item:hover {
        box-shadow: inset 0 0 0 2px ${themeColors.uiBorderHover};
    }

    .prompt-list {
        display: flex;
        flex-direction: column;
        gap: 10px;
        max-height: 50vh;
        overflow-y: auto;
    }

    .prompt-text {
        flex: 1;
        word-break: break-word;
    }

    .prompt-actions {
        display: flex;
        gap: 6px;
        flex-shrink: 0;
    }

    .prompt-add-section {
        margin-top: 14px;
    }

    .custom-prompt-input {
        width: 100%;
        padding: 8px;
        border: 1px solid ${themeColors.uiBorder};
        border-radius: 4px;
        background: ${themeColors.uiBackground};
        color: ${themeColors.uiFont};
        font-family: inherit;
        font-size: ${themeFonts.medium};
        line-height: 1.4;
        resize: vertical;
        box-sizing: border-box;
    }

    .custom-prompt-input:focus {
        box-shadow: inset 0 0 0 2px ${themeColors.uiBorderFocus};
        outline: none;
    }
`;

export const galleryButtonStyles = css`
    .button-container {
        display: flex;
        gap: 8px;
        margin-top: 6px;
    }

    .gallery-btn {
        display: inline-flex;
        padding: 4px 8px;
        cursor: pointer;
        border: none;
        border-radius: 4px;
        align-items: center;
        justify-content: center;
        color: ${themeColors.textWhite};
    }

    .edit-btn,
    .delete-btn {
        width: 28px;
        height: 28px;
    }

    .prompt-btn,
    .edit-btn {
        background: ${themeColors.submit};
    }
    .prompt-btn:hover,
    .edit-btn:hover {
        background: ${themeColors.submitHover};
    }

    .delete-btn,
    .cancel-btn {
        background: ${themeColors.cancel};
    }
    .delete-btn:hover,
    .cancel-btn:hover {
        background: ${themeColors.cancelHover};
    }
`;
