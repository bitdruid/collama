import { css } from "lit";
import { themeAnimations, themeColors, themeFonts, themeStyles } from "../../../../styles";
import { panelStyles } from "../../styles-shared";

export const controlPanelStyles = css`
    ${panelStyles}
    :host {
        display: block;
        overflow: visible;
    }

    textarea {
        ${themeStyles.textarea}
        resize: none;
        margin-bottom: 4px;
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
    ${themeAnimations.loadingAnimations}

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
    button-token-counter,
    button-duration-counter {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        width: 28px;
        height: 28px;
        aspect-ratio: 1 / 1;
        padding: 0;
        ${themeStyles.borderRadius.round}
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

    button-context {
        background-color: ${themeColors.context};
        position: relative;
    }
    button-context:hover {
        background-color: ${themeColors.contextHover};
    }

    .button-badge {
        position: absolute;
        top: -4px;
        right: -4px;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        width: 16px;
        height: 16px;
        ${themeStyles.borderRadius.round}
        background-color: ${themeColors.usageDanger};
        color: ${themeColors.cleanWhite};
        font-size: 10px;
        font-weight: bold;
        line-height: 1;
        box-shadow: 0 1px 3px ${themeColors.uiShadow};
    }

    button-cancel {
        ${themeAnimations.loadingPulse(themeColors.cancel)}
    }
    button-cancel:hover {
        background-color: ${themeColors.cancelHover};
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
        ${themeAnimations.loadingPulse(themeColors.autoAccept)}
    }

    button-ghost-chat {
        background-color: ${themeColors.ghostChat};
    }
    button-ghost-chat:hover {
        background-color: ${themeColors.ghostChatHover};
    }

    button-ghost-chat[active] {
        ${themeAnimations.loadingPulse(themeColors.ghostChat)}
    }

    button-clear-chat {
        background-color: ${themeColors.clearChat};
    }
    button-clear-chat:hover {
        background-color: ${themeColors.clearChatHover};
    }

    button-token-counter,
    button-duration-counter {
        background-color: ${themeColors.submit};
        width: auto;
        aspect-ratio: auto;
        padding: 0 10px;
        ${themeStyles.borderRadius.round}
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
