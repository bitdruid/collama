import { css } from "lit";
import { themeColors, themeStyles } from "../../../styles";
import { bottomOverlayStyles } from "../../../template-components/overlay/bottom-overlay";

export const scrollDownButtonStyles = css`
    ${bottomOverlayStyles}

    .scroll-wrap {
        position: relative;
        width: 32px;
        height: 32px;
    }

    .scroll-btn {
        display: flex;
        align-items: center;
        justify-content: center;
        width: 32px;
        height: 32px;
        border-radius: ${themeStyles.borderRadius.round};
        border: ${themeStyles.border.normal};
        background: ${themeColors.uiBackground};
        color: ${themeColors.uiFont};
        cursor: pointer;
    }

    .scroll-btn:hover {
        background: ${themeColors.uiBackgroundHover};
    }

    .ring {
        position: absolute;
        top: 50%;
        left: 50%;
        width: 40px;
        height: 40px;
        transform: translate(-50%, -50%);
        pointer-events: none;
        animation: scroll-ring-spin 1s linear infinite;
    }

    .ring circle {
        fill: none;
        stroke: ${themeColors.submit};
        stroke-width: 2.5;
        stroke-linecap: round;
        /* ~25% arc, rest gap (circumference ≈ 113). */
        stroke-dasharray: 28 200;
    }

    @keyframes scroll-ring-spin {
        to {
            transform: translate(-50%, -50%) rotate(360deg);
        }
    }
`;
