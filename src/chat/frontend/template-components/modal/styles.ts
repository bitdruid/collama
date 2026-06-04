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
        ${themeStyles.borderRadius.large}
        border: 1px solid ${themeColors.uiBorderDimm};
        background: ${themeColors.uiBackgroundDimm};
        ${themeStyles.boxShadow}
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
        color: ${themeColors.uiFont};
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
`;
