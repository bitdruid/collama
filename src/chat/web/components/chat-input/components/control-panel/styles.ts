import { css } from "lit";
import { themeColors } from "../../../../styles/theme-colors";
import { themeFonts } from "../../../../styles/theme-fonts";
import { themeStyles } from "../../../../styles/theme-styles";
import { panelStyles } from "../../styles-shared";

export const controlPanelStyles = css`
    ${panelStyles}
    :host {
        display: block;
        overflow: visible;
    }

    textarea {
        flex: 1;
        width: 100%;
        font-size: ${themeFonts.user};
        margin-bottom: 4px;
        padding: 8px;
        border-radius: 8px;
        border: none;
        color: ${themeColors.uiFont};
        background: ${themeColors.uiBackground};
        resize: none;
        overflow: hidden;
        line-height: 1.2em;
        box-sizing: border-box;
    }

    textarea:focus {
        ${themeStyles.focus}
    }

    textarea::placeholder {
        color: ${themeColors.placeholder};
    }

    textarea:disabled {
        opacity: 0.6;
        cursor: not-allowed;
    }
`;

export const controlPanelButtonStyles = css`
    :host {
        display: block;
        overflow: visible;
    }

    button-submit,
    button-context,
    button-cancel,
    button-compress,
    button-gallery,
    button-auto-accept,
    button-ghost-chat,
    button-clear-chat,
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
        color: ${themeColors.cleanWhite};
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
    button-submit:active {
        background-color: ${themeColors.submitActive};
    }

    button-context {
        background-color: ${themeColors.context};
        position: relative;
    }
    button-context:hover {
        background-color: ${themeColors.contextHover};
    }
    button-context:active {
        background-color: ${themeColors.contextActive};
    }

    .context-badge {
        position: absolute;
        top: -4px;
        right: -4px;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        width: 16px;
        height: 16px;
        border-radius: 50%;
        background-color: ${themeColors.usageDanger};
        color: ${themeColors.cleanWhite};
        font-size: 10px;
        font-weight: bold;
        line-height: 1;
        box-shadow: 0 1px 3px ${themeColors.shadowLight};
    }

    button-cancel {
        background-color: ${themeColors.cancel};
        box-shadow:
            0 0 0 2px ${themeColors.cleanWhite},
            0 0 0 4px ${themeColors.cancel};
        animation: cancel-pulse 2s infinite;
    }
    button-cancel:hover {
        background-color: ${themeColors.cancelHover};
    }
    button-cancel:active {
        background-color: ${themeColors.cancelActive};
    }

    @keyframes cancel-pulse {
        0%,
        100% {
            box-shadow:
                0 0 0 2px ${themeColors.cleanWhite},
                0 0 0 4px ${themeColors.cancel};
        }
        50% {
            box-shadow:
                0 0 0 2px ${themeColors.cleanWhite},
                0 0 0 8px ${themeColors.cancel};
        }
    }

    button-compress {
        background-color: ${themeColors.compress};
    }
    button-compress:hover {
        background-color: ${themeColors.compressHover};
    }
    button-compress:active {
        background-color: ${themeColors.compressActive};
    }

    button-gallery {
        background-color: ${themeColors.gallery};
    }
    button-gallery:hover {
        background-color: ${themeColors.galleryHover};
    }
    button-gallery:active {
        background-color: ${themeColors.galleryActive};
    }

    button-auto-accept {
        background-color: ${themeColors.autoAccept};
    }
    button-auto-accept:hover {
        background-color: ${themeColors.autoAcceptHover};
    }
    button-auto-accept:active {
        background-color: ${themeColors.autoAcceptActive};
    }

    button-auto-accept[active] {
        background-color: ${themeColors.autoAcceptActive};
        box-shadow:
            0 0 0 2px ${themeColors.cleanWhite},
            0 0 0 4px ${themeColors.autoAcceptActive};
        animation: auto-accept-pulse 2s infinite;
    }

    @keyframes auto-accept-pulse {
        0%,
        100% {
            box-shadow:
                0 0 0 2px ${themeColors.cleanWhite},
                0 0 0 4px ${themeColors.autoAcceptActive};
        }
        50% {
            box-shadow:
                0 0 0 2px ${themeColors.cleanWhite},
                0 0 0 8px ${themeColors.autoAcceptActive};
        }
    }

    button-ghost-chat {
        background-color: ${themeColors.ghostChat};
    }
    button-ghost-chat:hover {
        background-color: ${themeColors.ghostChatHover};
    }
    button-ghost-chat:active {
        background-color: ${themeColors.ghostChatActive};
    }

    button-ghost-chat[active] {
        background-color: ${themeColors.ghostChatActive};
        box-shadow:
            0 0 0 2px ${themeColors.cleanWhite},
            0 0 0 4px ${themeColors.ghostChatActive};
        animation: ghost-chat-pulse 2s infinite;
    }

    @keyframes ghost-chat-pulse {
        0%,
        100% {
            box-shadow:
                0 0 0 2px ${themeColors.cleanWhite},
                0 0 0 4px ${themeColors.ghostChatActive};
        }
        50% {
            box-shadow:
                0 0 0 2px ${themeColors.cleanWhite},
                0 0 0 8px ${themeColors.ghostChatActive};
        }
    }

    button-clear-chat {
        background-color: ${themeColors.clearChat};
    }
    button-clear-chat:hover {
        background-color: ${themeColors.clearChatHover};
    }
    button-clear-chat:active {
        background-color: ${themeColors.clearChatActive};
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

    button-row {
        display: flex;
        gap: 8px;
        position: relative;
    }

    .spacer {
        flex: 1;
    }

    .context-wrapper {
        position: relative;
    }
`;
