import { css } from "lit";
import { themeColors, themeFonts, themeStyles } from "../../../../../styles";

export const contextUsageBarStyles = css`
    :host {
        display: block;
    }

    .context-usage {
        display: flex;
        align-items: center;
        min-width: 80px;
        max-width: 140px;
    }

    .context-bar-container {
        flex: 1;
        min-width: 70px;
        height: 10px;
        background: ${themeColors.uiBackgroundDimm};
        border: ${themeStyles.border.normal};
        border-radius: ${themeStyles.borderRadius.medium};
        overflow: hidden;
        position: relative;
    }

    .context-bar {
        height: 100%;
        background: ${themeColors.usagePrimary};
        border-radius: ${themeStyles.borderRadius.medium};
        transition: width 0.3s ease;
        min-width: 1px;
    }

    .context-bar.danger {
        background: ${themeColors.usageDanger};
    }

    .context-bar.warning {
        background: ${themeColors.usageWarning};
    }

    .context-text {
        font-size: ${themeFonts.size.normal};
        color: ${themeColors.uiFont};
        white-space: nowrap;
        margin-left: 8px;
    }
`;
