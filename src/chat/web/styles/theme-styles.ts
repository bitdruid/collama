import { css } from "lit";
import { themeColors } from "./theme-colors";

/**
 * Reusable CSS style fragments for consistent interactive states.
 * Usage: .my-input:focus { ${themeStyles.focus} }
 *        .my-item:hover { ${themeStyles.hover} }
 */
export const themeStyles = {
    focus: css`
        box-shadow: inset 0 0 0 1px ${themeColors.focus};
        outline: none;
    `,
    hover: css`
        box-shadow: inset 0 0 0 2px ${themeColors.uiBorderHoverDimm};
    `,
} as const;
