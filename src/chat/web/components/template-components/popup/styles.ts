import { css } from "lit";
import { themeAnimations } from "../../../styles/theme-animations";
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
        ${themeAnimations.fadeAnimate}
    }

    .popup-content.fade-in {
        ${themeAnimations.fadeIn}
    }

    .popup-content.fade-out {
        ${themeAnimations.fadeOut}
    }
`;
