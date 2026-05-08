import { css } from "lit";
import { themeColors } from "./theme-colors";
import { themeFonts } from "./theme-fonts";

const borderRadius = {
    small: css`
        border-radius: 4px;
    `,
    medium: css`
        border-radius: 6px;
    `,
    large: css`
        border-radius: 8px;
    `,
    round: css`
        border-radius: 999px;
    `,
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
        0 2px 8px ${themeColors.uiShadow},
        0 8px 32px ${themeColors.uiShadow},
        0 0 48px ${themeColors.uiShadow};
`;

const input = css`
    flex: 1;
    padding: 6px 8px;
    border: none;
    ${borderRadius.large}
    background: ${themeColors.uiBackground};
    color: ${themeColors.uiFont};
    font-size: ${themeFonts.medium};
    box-sizing: border-box;
    outline: none;
`;

const textarea = css`
    flex: 1;
    width: 100%;
    padding: 8px;
    ${borderRadius.large}
    background: ${themeColors.uiBackground};
    color: ${themeColors.uiFont};
    font-size: ${themeFonts.user};
    border: none;
    resize: vertical;
    overflow: hidden;
    line-height: 1.2em;
    box-sizing: border-box;
`;

/**
 * Reusable CSS style fragments for consistent interactive states.
 * Usage: .my-input:focus { ${themeStyles.focus} }
 *        .my-item:hover { ${themeStyles.hover} }
 */
export const themeStyles = { borderRadius, focus, hover, boxShadow, input, textarea } as const;
