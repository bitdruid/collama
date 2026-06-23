import { css } from "lit";
import { themeColors, themeFonts, themeStyles } from "../../../../../styles";
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
        padding: 8px 10px;
        cursor: pointer;
        border: ${themeStyles.border.dimm};
        border-radius: ${themeStyles.borderRadius.small};
        background: ${themeColors.uiBackgroundDimm};
        color: ${themeColors.uiFont};
        font-size: ${themeFonts.size.normal};
        overflow: hidden;
    }

    .prompt-item:hover {
        background: ${themeColors.uiBackgroundHoverDimm};
    }

    .prompt-list {
        display: flex;
        flex-direction: column;
        gap: 6px;
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
        padding: 0 8px;
        pointer-events: none;
        opacity: 0;
        transform: translateX(6px);
        transition:
            opacity 0.15s ease-out,
            transform 0.15s ease-out;
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
        border: ${themeStyles.border.normal};
        border-radius: ${themeStyles.borderRadius.small};
        background: ${themeColors.uiBackground};
        color: ${themeColors.uiFont};
        font-family: ${themeFonts.familyMono};
        font-size: ${themeFonts.size.normal};
        resize: vertical;
        box-sizing: border-box;
    }

    .custom-prompt-input:focus {
        ${themeStyles.focus}
    }
`;

export const galleryButtonStyles = css`
    .prompt-action {
        display: inline-flex;
        cursor: pointer;
        padding: 4px;
        border-radius: ${themeStyles.borderRadius.small};
        color: ${themeColors.uiFont};
        background: ${themeColors.uiBackground};
    }

    .prompt-edit:hover {
        background: ${themeColors.submitHover};
        color: ${themeColors.cleanWhite};
    }

    .prompt-delete:hover {
        background: ${themeColors.cancelHover};
        color: ${themeColors.cleanWhite};
    }
`;
