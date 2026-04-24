import { css } from "lit";
import { themeColors } from "../../../styles/theme-colors";
import { themeStyles } from "../../../styles/theme-styles";

export const basePopupStyles = css`
    :host {
        display: block;
        position: absolute;
        bottom: 100%;
        right: 0;
        max-width: 100%;
        z-index: 200;
    }

    .popup-content {
        max-width: 100%;
        box-sizing: border-box;
        background: ${themeColors.uiBackgroundDimm};
        border: 2px solid ${themeColors.uiBorderDimm};
        border-radius: 8px;
        ${themeStyles.boxShadow}
        overflow: hidden;
        opacity: 0;
        transition: opacity 0.2s ease-in-out;
    }

    .popup-content.fade-in {
        opacity: 1;
    }

    .popup-content.fade-out {
        opacity: 0;
    }
`;
