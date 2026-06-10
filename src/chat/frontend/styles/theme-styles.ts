import { css, unsafeCSS } from "lit";
import { themeColors } from "./theme-colors";
import { themeFonts } from "./theme-fonts";

const borderRadius = {
    small: unsafeCSS("6px"),
    medium: unsafeCSS("6px"),
    large: unsafeCSS("8px"),
    round: unsafeCSS("999px"),
} as const;

const border = {
    normal: css`1px solid ${themeColors.uiBorder}`,
    dimm: css`1px solid ${themeColors.uiBorderDimm}`,
} as const;

const focus = css`
    box-shadow: inset 0 0 0 1px ${themeColors.focus};
    outline: none;
    background: ${themeColors.uiBackgroundDimm};
`;

const hover = css`
    box-shadow: inset 0 0 0 2px ${themeColors.uiBorderHoverDimm};
`;

const boxShadow = css`
    box-shadow:
        0 1px 4px ${themeColors.uiShadow},
        0 4px 16px ${themeColors.uiShadow};
`;

const input = css`
    flex: 1;
    padding: 6px 8px;
    border: none;
    border-radius: ${borderRadius.large};
    background: ${themeColors.uiBackground};
    color: ${themeColors.uiFont};
    font-size: ${themeFonts.size.normal};
    box-sizing: border-box;
    outline: none;
`;

const textarea = css`
    flex: 1;
    width: 100%;
    padding: 8px;
    border-radius: ${borderRadius.large};
    background: ${themeColors.uiBackground};
    color: ${themeColors.uiFont};
    font-size: ${themeFonts.size.user};
    /* Line-height explicit needed for auto-grow; else is "normal"; breaks the adjustTextareaRows (parseFloat("normal") → NaN). */
    line-height: ${themeFonts.lineHeight.normal};
    border: none;
    resize: vertical;
    overflow: hidden;
    box-sizing: border-box;
`;

/**
 * Reusable CSS style fragments for consistent interactive states.
 * Usage: .my-input:focus { ${themeStyles.focus} }
 *        .my-item:hover { ${themeStyles.hover} }
 */
export const themeStyles = { borderRadius, border, focus, hover, boxShadow, input, textarea } as const;
