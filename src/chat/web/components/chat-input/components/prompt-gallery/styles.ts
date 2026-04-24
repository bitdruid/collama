import { css } from "lit";
import { themeColors } from "../../../../styles/theme-colors";
import { themeFonts } from "../../../../styles/theme-fonts";
import { themeStyles } from "../../../../styles/theme-styles";
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
        position: relative;
        display: flex;
        align-items: center;
        padding: 6px 8px;
        cursor: pointer;
        border-radius: 4px;
        border-bottom: 1px solid ${themeColors.uiBorderDimm};
        color: ${themeColors.uiFont};
        font-size: ${themeFonts.medium};
        line-height: 1.4;
    }

    .prompt-item:last-child {
        border-bottom: none;
    }

    .prompt-item:hover {
        background: ${themeColors.uiBackgroundHoverDimm};
    }

    .prompt-list {
        display: flex;
        flex-direction: column;
        gap: 2px;
        max-height: 50vh;
        overflow-y: auto;
        overflow-x: hidden;
    }

    .prompt-text {
        flex: 1;
        word-break: break-word;
        display: -webkit-box;
        -webkit-line-clamp: 2;
        -webkit-box-orient: vertical;
        overflow: hidden;
    }

    .prompt-actions {
        position: absolute;
        top: 0;
        right: 0;
        bottom: 0;
        display: flex;
        align-items: center;
        padding: 0 8px 0 24px;
        pointer-events: none;
        opacity: 0;
        transform: translateX(6px);
        transition:
            opacity 0.15s ease-out,
            transform 0.15s ease-out;
        background: linear-gradient(
            to right,
            transparent 0%,
            ${themeColors.uiBackgroundHoverDimm} 40%,
            ${themeColors.uiBackgroundHoverDimm} 100%
        );
        border-radius: 4px;
    }

    .prompt-item:hover .prompt-actions,
    .prompt-item:focus-within .prompt-actions {
        opacity: 1;
        transform: translateX(0);
        pointer-events: auto;
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
        ${themeStyles.focus}
    }
`;

export const galleryButtonStyles = css`
    .button-container {
        display: flex;
        gap: 8px;
        margin-top: 6px;
    }

    .row-actions {
        display: flex;
        gap: 2px;
    }

    .gallery-btn {
        display: inline-flex;
        padding: 4px 8px;
        cursor: pointer;
        border: none;
        border-radius: 4px;
        align-items: center;
        justify-content: center;
        color: ${themeColors.cleanWhite};
    }

    .row-actions .gallery-btn {
        width: 22px;
        height: 22px;
        padding: 0;
        background: transparent;
        color: ${themeColors.uiFont};
    }

    .row-actions .edit-btn:hover {
        background: ${themeColors.submitHover};
        color: ${themeColors.cleanWhite};
    }

    .row-actions .delete-btn:hover {
        background: ${themeColors.cancelHover};
        color: ${themeColors.cleanWhite};
    }

    .prompt-btn {
        background: ${themeColors.submit};
    }
    .prompt-btn:hover {
        background: ${themeColors.submitHover};
    }
    .prompt-btn:active {
        background: ${themeColors.submit};
    }

    .cancel-btn {
        background: ${themeColors.cancel};
    }
    .cancel-btn:hover {
        background: ${themeColors.cancelHover};
    }
    .cancel-btn:active {
        background: ${themeColors.cancel};
    }
`;
