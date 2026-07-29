import { css } from "lit";
import { themeColors, themeFonts, themeStyles } from "../../../styles";

export const activeShellsStyles = css`
    :host {
        display: block;
    }

    .dot {
        ${themeStyles.dot}
        background: ${themeColors.usagePrimary};
    }

    .count {
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
`;
