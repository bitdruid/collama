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
    normalHover: css`1px solid ${themeColors.uiBorderHover}`,
    dimmHover: css`1px solid ${themeColors.uiBorderHoverDimm}`,
} as const;

const focus = css`
    box-shadow: inset 0 0 0 1px ${themeColors.focus};
    outline: none;
    background: ${themeColors.uiBackgroundDimm};
`;

const hover = css`
    box-shadow: inset 0 0 0 2px ${themeColors.uiBorderHoverDimm};
`;

const boxShadow = unsafeCSS(`0px 0px 4px 2px ${themeColors.uiShadow}`);

const placeholder = css`
    font-family: ${themeFonts.familyMono};
    color: ${themeColors.placeholder};
`;

const input = css`
    flex: 1;
    padding: 6px 8px;
    border: ${border.normal};
    border-radius: ${borderRadius.medium};
    background: ${themeColors.uiBackground};
    color: ${themeColors.uiFont};
    font-size: ${themeFonts.size.normal};
    box-sizing: border-box;
    outline: none;
`;

const textarea = css`
    flex: 1;
    display: block;
    width: 100%;
    padding: 8px 12px;
    border: 1px solid transparent;
    border-radius: ${borderRadius.medium};
    background: ${themeColors.uiBackground};
    color: ${themeColors.uiFont};
    font-size: ${themeFonts.size.normal};
    /* Line-height explicit needed for auto-grow; else is "normal"; breaks the adjustTextareaRows (parseFloat("normal") → NaN). */
    line-height: ${themeFonts.lineHeight.normal};
    resize: none;
    overflow: hidden;
    box-sizing: border-box;
`;

/**
 * Reusable CSS style fragments for consistent interactive states.
 * Usage: .my-input:focus { ${themeStyles.focus} }
 *        .my-item:hover { ${themeStyles.hover} }
 */
export const themeStyles = { borderRadius, border, focus, hover, boxShadow, placeholder, input, textarea } as const;
