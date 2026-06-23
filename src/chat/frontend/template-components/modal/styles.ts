import { css } from "lit";
import { themeAnimations, themeColors, themeFonts, themeStyles } from "../../styles";

export const baseModalStyles = css`
    :host {
        display: block;
        width: 100%;
        box-sizing: border-box;
    }

    .modal-content {
        position: relative;
        box-sizing: border-box;
        width: 100%;
        padding: 16px;
        margin-bottom: 8px;
        overflow: auto;
        border-radius: ${themeStyles.borderRadius.large};
        border: ${themeStyles.border.normal};
        background: ${themeColors.uiBackground};
        ${themeAnimations.fadeAnimate}
    }

    .modal-content.fade-in {
        ${themeAnimations.fadeIn}
    }

    .modal-content.fade-out {
        ${themeAnimations.fadeOut}
    }

    .modal-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        margin-bottom: 12px;
        color: ${themeColors.uiFont};
    }

    .modal-header h3 {
        margin: 0;
        font-size: ${themeFonts.size.large};
        color: ${themeColors.uiFont};
    }

    .modal-title {
        display: flex;
        align-items: center;
        gap: 8px;
    }

    .close-btn {
        cursor: pointer;
        line-height: 1;
        color: ${themeColors.uiFont};
    }

    .close-btn:hover {
        color: ${themeColors.uiFont};
    }

    .modal-body {
        /* Placeholder for body styles */
    }

    /* When a footer button row is present, separate it from the body and let it
       hug the bottom border a bit closer than the title hugs the top. */
    .modal-body collama-button-row {
        display: block;
        margin-top: 12px;
        margin-bottom: -6px;
    }
`;
