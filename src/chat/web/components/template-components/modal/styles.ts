import { css } from "lit";
import { themeAnimations } from "../../../styles/theme-animations";
import { themeColors } from "../../../styles/theme-colors";
import { themeFonts } from "../../../styles/theme-fonts";

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
        border-radius: 8px;
        border: 2px solid ${themeColors.uiBorderDimm};
        background: ${themeColors.uiBackgroundDimm};
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
        font-size: ${themeFonts.giant};
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
