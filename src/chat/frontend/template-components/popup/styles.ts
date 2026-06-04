import { css } from "lit";
import { themeAnimations, themeColors, themeStyles } from "../../styles";

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
        ${themeStyles.border.dimm}
        ${themeStyles.borderRadius.large}
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
