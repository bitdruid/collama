import { css, unsafeCSS } from "lit";
import { themeColors } from "./theme-colors";

type CssColor = { cssText: string } | string;
const cssColor = (color: CssColor) => unsafeCSS(typeof color === "string" ? color : color.cssText);

/**
 * Reusable CSS animation keyframes and animation utilities.
 * Usage: .my-element { ${themeAnimations.loadingPulse(themeColors.primary)} }
 */
export const themeAnimations = {
    loadingAnimations: css`
        @keyframes loading-pulse {
            0%,
            100% {
                box-shadow:
                    0 0 0 1px ${themeColors.cleanWhite},
                    0 0 0 2px var(--loading-pulse-color, currentColor);
                filter: brightness(1);
            }

            50% {
                box-shadow:
                    0 0 0 1px ${themeColors.cleanWhite},
                    0 0 0 4px var(--loading-pulse-color, currentColor);
                filter: brightness(1.25);
            }
        }
    `,
    loadingPulse: (color: CssColor) => {
        const buttonColor = cssColor(color);

        return css`
            background: ${buttonColor};
            --loading-pulse-color: ${buttonColor};
            box-shadow:
                0 0 0 1px ${themeColors.cleanWhite},
                0 0 0 2px ${buttonColor};
            animation: loading-pulse 2s infinite;
        `;
    },
    loadingSpinnerSym: (color1: CssColor, color2: CssColor) => {
        const c1 = cssColor(color1);
        const c2 = cssColor(color2);
        return css`
            .loadingSpinnerSym {
                width: 48px;
                height: 48px;
                border-radius: 50%;
                position: relative;
                animation: rotate 1s linear infinite
            }
            .loadingSpinnerSym::before , .loadingSpinnerSym::after {
                content: "";
                box-sizing: border-box;
                position: absolute;
                inset: 0px;
                border-radius: 50%;
                border: 5px solid ${c1};
                filter: brightness(1.25);
                animation: prixClipFix 2s linear infinite ;
            }
            .loadingSpinnerSym::after{
                transform: rotate3d(90, 90, 0, 180deg );
                border-color: ${c2};
                filter: brightness(0.75);
            }

            @keyframes rotate {
                0%   {transform: rotate(0deg)}
                100%   {transform: rotate(360deg)}
            }

            @keyframes prixClipFix {
                0%   {clip-path:polygon(50% 50%,0 0,0 0,0 0,0 0,0 0)}
                50%  {clip-path:polygon(50% 50%,0 0,100% 0,100% 0,100% 0,100% 0)}
                75%, 100%  {clip-path:polygon(50% 50%,0 0,100% 0,100% 100%,100% 100%,100% 100%)}
            }
        }`;
    },
    loadingSpinnerAsym: (color1: CssColor, color2: CssColor) => {
        const c1 = cssColor(color1);
        const c2 = cssColor(color2);
        return css`
            .loadingSpinnerAsym {
                width: 48px;
                height: 48px;
                border-radius: 50%;
                position: relative;
                animation: rotate 1s linear infinite;
            }
            .loadingSpinnerAsym::before,
            .loadingSpinnerAsym::after {
                content: "";
                box-sizing: border-box;
                position: absolute;
                inset: 0px;
                border-radius: 50%;
                border: 5px solid ${c1};
                filter: brightness(1.25);
                animation: prixClipFix 2s linear infinite;
            }
            .loadingSpinnerAsym::after {
                border-color: ${c2};
                filter: brightness(0.75);
                animation:
                    prixClipFix 2s linear infinite,
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
    },
    loadingSpinner: (color: CssColor) => {
        const c = cssColor(color);
        return css`
            .loadingSpinner {
                width: 48px;
                height: 48px;
                border-radius: 50%;
                position: relative;
                animation: rotate 1s linear infinite;
            }
            .loadingSpinner::before {
                content: "";
                box-sizing: border-box;
                position: absolute;
                inset: 0px;
                border-radius: 50%;
                border: 5px solid ${c}
                animation: prixClipFix 2s linear infinite;
            }

            @keyframes rotate {
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
    },
    fadeAnimate: css`
        opacity: 0;
        transition: opacity 0.2s ease-in-out;
    `,
    fadeIn: css`
        opacity: 1;
    `,
    fadeOut: css`
        opacity: 0;
    `,
} as const;