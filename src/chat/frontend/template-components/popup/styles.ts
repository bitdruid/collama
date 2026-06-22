import { css } from "lit";
import { themeAnimations, themeColors, themeStyles } from "../../styles";

export const basePopupStyles = css`
    :host {
        display: block;
        position: absolute;
        bottom: calc(100% + 6px);
        right: 0;
        max-width: 100%;
        z-index: 200;
    }

    .popup-content {
        max-width: 100%;
        box-sizing: border-box;
        background: ${themeColors.uiBackground};
        border: ${themeStyles.border.normal};
        border-radius: ${themeStyles.borderRadius.large};
        box-shadow: ${themeStyles.boxShadow};
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
