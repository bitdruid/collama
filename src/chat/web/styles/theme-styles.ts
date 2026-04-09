import { css } from "lit";
import { themeColors } from "./theme-colors";
import { themeFonts } from "./theme-fonts";

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
} as const;
