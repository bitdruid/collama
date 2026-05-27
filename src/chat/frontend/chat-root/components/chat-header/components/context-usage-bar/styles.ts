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
        border: 1px solid ${themeColors.uiBorder};
        ${themeStyles.borderRadius.medium}
        overflow: hidden;
        position: relative;
    }

    .context-bar {
        height: 100%;
        background: ${themeColors.usagePrimary};
        ${themeStyles.borderRadius.small}
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
        font-size: ${themeFonts.medium};
        color: ${themeColors.uiFont};
        white-space: nowrap;
        margin-left: 8px;
    }
`;
