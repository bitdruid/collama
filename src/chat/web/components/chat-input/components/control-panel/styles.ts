import { css } from "lit";
import { themeColors } from "../../../../styles/theme-colors";
import { themeFonts } from "../../../../styles/theme-fonts";
import { themeStyles } from "../../../../styles/theme-styles";

export const controlPanelStyles = css`
    :host {
        display: block;
    }

    textarea {
        flex: 1;
        width: 100%;
        font-size: ${themeFonts.user};
        padding: 8px;
        border-radius: 8px;
        border: none;
        color: ${themeColors.uiFont};
        background: transparent;
        resize: none;
        overflow: hidden;
        line-height: 1.2em;
        box-sizing: border-box;
    }

    textarea:focus {
        ${themeStyles.focus}
    }

    textarea::placeholder {
        color: var(--vscode-commandCenter-activeBorder);
    }

    textarea:disabled {
        opacity: 0.6;
        cursor: not-allowed;
    }
`;

export const controlPanelButtonStyles = css`
    :host {
        display: block;
    }

    button-submit,
    button-context,
    button-cancel,
    button-compress,
    button-gallery,
    button-auto-accept,
    button-token-counter {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        width: 28px;
        height: 28px;
        aspect-ratio: 1 / 1;
        padding: 0;
        border-radius: 50%;
        line-height: 1;
        color: ${themeColors.textWhite};
        border: none;
        cursor: pointer;
        box-sizing: border-box;
    }

    button-submit {
        background-color: ${themeColors.submit};
    }
    button-submit:hover {
        background-color: ${themeColors.submitHover};
    }
    button-submit:disabled {
        background-color: ${themeColors.disabled};
        cursor: not-allowed;
        opacity: 0.5;
    }

    button-context {
        background-color: ${themeColors.context};
    }
    button-context:hover {
        background-color: ${themeColors.contextHover};
    }

    button-cancel {
        background-color: ${themeColors.cancel};
        box-shadow:
            0 0 0 2px ${themeColors.textWhite},
            0 0 0 4px ${themeColors.cancel};
        animation: cancel-spin 2s infinite;
    }
    button-cancel:hover {
        background-color: ${themeColors.cancelHover};
    }

    @keyframes cancel-spin {
        0%,
        100% {
            box-shadow:
                0 0 0 2px ${themeColors.textWhite},
                0 0 0 4px ${themeColors.cancel};
        }
        50% {
            box-shadow:
                0 0 0 2px ${themeColors.textWhite},
                0 0 0 8px ${themeColors.cancel},
                0 0 15px rgba(168, 34, 34, 0.5);
        }
    }

    button-compress {
        background-color: ${themeColors.compress};
    }
    button-compress:hover {
        background-color: ${themeColors.compressHover};
    }

    button-gallery {
        background-color: ${themeColors.gallery};
    }
    button-gallery:hover {
        background-color: ${themeColors.galleryHover};
    }

    button-auto-accept {
        background-color: ${themeColors.autoAccept};
    }
    button-auto-accept:hover {
        background-color: ${themeColors.autoAcceptHover};
    }

    button-auto-accept[active] {
        background-color: ${themeColors.autoAcceptActive};
        box-shadow:
            0 0 0 2px ${themeColors.textWhite},
            0 0 0 4px ${themeColors.autoAcceptActive};
        animation: pulse 2s infinite;
    }

    @keyframes pulse {
        0%,
        100% {
            box-shadow:
                0 0 0 2px ${themeColors.textWhite},
                0 0 0 4px ${themeColors.autoAcceptActive};
        }
        50% {
            box-shadow:
                0 0 0 2px ${themeColors.textWhite},
                0 0 0 8px ${themeColors.autoAcceptActive},
                0 0 15px rgba(255, 107, 107, 0.5);
        }
    }

    button-token-counter {
        background-color: ${themeColors.submit};
        width: auto;
        aspect-ratio: auto;
        padding: 0 10px;
        border-radius: 14px;
        font-size: ${themeFonts.medium};
        font-weight: 600;
        cursor: default;
    }

    .context-display {
        display: inline-flex;
        align-items: center;
        gap: 4px;
        padding: 4px 8px;
        border-radius: 12px;
        background-color: ${themeColors.context};
        color: ${themeColors.textWhite};
        font-size: ${themeFonts.medium};
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
        color: ${themeColors.textWhite};
        font-size: ${themeFonts.small};
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
        gap: 8px;
    }
`;
