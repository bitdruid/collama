import { css } from "lit";
import { themeAnimations } from "../../styles";

/**
 * Shared positioning styles for bottom-center overlay components (spinner, scroll button, etc.)
 */
export const bottomOverlayStyles = css`
    :host {
        position: absolute;
        bottom: 8px;
        left: 50%;
        transform: translateX(-50%);
        z-index: 10;
        pointer-events: none;
        ${themeAnimations.fadeAnimate}
    }

    :host([visible]) {
        ${themeAnimations.fadeIn}
        pointer-events: auto;
    }
`;
