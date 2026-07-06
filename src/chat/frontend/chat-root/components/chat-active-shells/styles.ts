import { css } from "lit";
import { themeColors, themeFonts, themeStyles } from "../../../styles";

export const activeShellsStyles = css`
    :host {
        display: block;
    }

    .banner {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        margin: 0 8px 6px;
        padding: 5px 8px;
        border: 1px solid ${themeColors.usagePrimary};
        border-radius: ${themeStyles.borderRadius.medium};
        background: color-mix(in srgb, ${themeColors.uiBackground} 85%, ${themeColors.usagePrimary});
        pointer-events: auto;
    }

    .banner-dot {
        width: 8px;
        height: 8px;
        border-radius: ${themeStyles.borderRadius.round};
        background: ${themeColors.usagePrimary};
        flex-shrink: 0;
    }

    .banner-label {
        flex-shrink: 0;
        font-size: ${themeFonts.size.small};
        font-weight: ${themeFonts.weight.bold};
        text-transform: uppercase;
        letter-spacing: 0.03em;
        color: ${themeColors.usagePrimary};
    }

    .banner-count {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        min-width: 16px;
        height: 16px;
        padding: 0 4px;
        border-radius: ${themeStyles.borderRadius.round};
        background: ${themeColors.usagePrimary};
        color: ${themeColors.cleanWhite};
        font-size: ${themeFonts.size.small};
        font-weight: ${themeFonts.weight.bold};
        font-variant-numeric: tabular-nums;
        flex-shrink: 0;
    }

    .banner-text {
        flex: 1;
        min-width: 0;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
        font-size: ${themeFonts.size.normal};
        color: ${themeColors.uiFont};
    }
`;
