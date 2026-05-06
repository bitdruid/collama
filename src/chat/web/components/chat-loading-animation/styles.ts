import { css } from "lit";
import { themeColors, themeStyles } from "../../styles";

export const loadingAnimationStyles = css`
    .generating {
        display: block;
        width: 48px;
        height: 48px;
        ${themeStyles.borderRadius.round}
        position: relative;
        margin: 15px auto;
        animation: rotate 1s linear infinite;
    }

    .generating::before,
    .generating::after {
        content: "";
        box-sizing: border-box;
        position: absolute;
        inset: 0px;
        ${themeStyles.borderRadius.round}
        border: 5px solid ${themeColors.cleanWhite};
        animation: prixClipFix 2s linear infinite alternate;
    }

    .generating::after {
        border-color: ${themeColors.submit};
        animation:
            prixClipFix 2s linear infinite alternate,
            rotate 0.5s linear infinite reverse;
        inset: 6px;
    }

    @keyframes rotate {
        0% {
            transform: rotate(0deg);
        }
        100% {
            transform: rotate(360deg);
        }
    }

    @keyframes prixClipFix {
        0% {
            clip-path: polygon(50% 50%, 0 0, 0 0, 0 0, 0 0, 0 0);
        }
        25% {
            clip-path: polygon(50% 50%, 0 0, 100% 0, 100% 0, 100% 0, 100% 0);
        }
        50% {
            clip-path: polygon(50% 50%, 0 0, 100% 0, 100% 100%, 100% 100%, 100% 100%);
        }
        75% {
            clip-path: polygon(50% 50%, 0 0, 100% 0, 100% 100%, 0 100%, 0 100%);
        }
        100% {
            clip-path: polygon(50% 50%, 0 0, 100% 0, 100% 100%, 0 100%, 0 0);
        }
    }
`;
