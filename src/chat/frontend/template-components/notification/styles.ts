import { css } from "lit";
import { themeAnimations, themeColors, themeFonts, themeStyles } from "../../styles";

export const baseNotificationStyles = css`
    :host {
        position: absolute;
        top: 28px;
        left: 50%;
        z-index: 250;
        display: block;
        width: fit-content;
        max-width: calc(100% - 32px);
        box-sizing: border-box;
        transform: translateX(-50%);
        pointer-events: none;
    }

    .notification-content {
        box-sizing: border-box;
        width: fit-content;
        max-width: 100%;
        padding: 10px 12px;
        ${themeStyles.border.normal}
        ${themeStyles.borderRadius.large}
        background: ${themeColors.uiBackground};
        ${themeStyles.boxShadow}
        color: ${themeColors.uiFont};
        font-family: ${themeFonts.familyMono};
        font-size: ${themeFonts.size.small};
        text-align: center;
        ${themeAnimations.fadeAnimate}
        pointer-events: auto;
    }

    .notification-content.fade-in {
        ${themeAnimations.fadeIn}
    }

    .notification-content.fade-out {
        ${themeAnimations.fadeOut}
    }

    .notification-heading {
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 4px;
        margin: 0;
        color: ${themeColors.uiFont};
        font-size: ${themeFonts.size.small};
        font-weight: ${themeFonts.weight.bold};
        text-align: center;
    }

    .notification-heading .notify-danger {
        display: inline-flex;
        align-items: center;
        flex: 0 0 auto;
        color: ${themeColors.usageDanger};
    }

    .notification-heading .notify-danger svg {
        display: block;
    }

    .notification-text {
        margin: 8px 0 0;
        color: ${themeColors.uiFont};
        text-align: center;
        overflow-wrap: anywhere;
    }
`;
