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
