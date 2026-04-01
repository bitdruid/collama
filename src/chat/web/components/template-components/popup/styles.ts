import { css } from "lit";
import { themeColors } from "../../../styles/theme-colors";

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
        border: 2px solid ${themeColors.uiBorder};
        border-radius: 8px;
        box-shadow: 0 4px 16px ${themeColors.shadow};
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
