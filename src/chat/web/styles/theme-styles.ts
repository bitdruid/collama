import { css, unsafeCSS } from "lit";
import { themeColors } from "./theme-colors";
import { themeFonts } from "./theme-fonts";

type CssColor = { cssText: string } | string;
const cssColor = (color: CssColor) => unsafeCSS(typeof color === "string" ? color : color.cssText);

/**
 * Reusable CSS style fragments for consistent interactive states.
 * Usage: .my-input:focus { ${themeStyles.focus} }
 *        .my-item:hover { ${themeStyles.hover} }
 */
export const themeStyles = {
    focus: css`
        box-shadow: inset 0 0 0 1px ${themeColors.focus};
        outline: none;
        background: ${themeColors.uiBackgroundDimm};
    `,
    hover: css`
        box-shadow: inset 0 0 0 2px ${themeColors.uiBorderHoverDimm};
    `,
    boxShadow: css`
        box-shadow: 0 4px 20px ${themeColors.uiShadow};
    `,
    input: css`
        flex: 1;
        padding: 6px 8px;
        border: none;
        border-radius: 8px;
        background: ${themeColors.uiBackground};
        color: ${themeColors.uiFont};
        font-size: ${themeFonts.medium};
        box-sizing: border-box;
        outline: none;
    `,
    textarea: css`
        flex: 1;
        width: 100%;
        padding: 8px;
        border-radius: 8px;
        background: ${themeColors.uiBackground};
        color: ${themeColors.uiFont};
        font-size: ${themeFonts.user};
        border: none;
        resize: vertical;
        overflow: hidden;
        line-height: 1.2em;
        box-sizing: border-box;
    `,
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
} as const;
