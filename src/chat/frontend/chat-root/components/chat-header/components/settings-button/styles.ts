import { css } from "lit";
import { themeColors, themeFonts, themeStyles } from "../../../../../styles";

export const settingsButtonStyles = css`
    .settings-button {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        min-width: 28px;
        height: 28px;
        padding: 0;
        border: none;
        background: transparent;
        color: ${themeColors.uiFont};
        cursor: pointer;
        font: inherit;
        position: relative;
    }

    .settings-button:hover:not(:disabled) {
        opacity: 0.8;
    }

    .settings-button:disabled {
        cursor: not-allowed;
        opacity: 0.45;
    }

    .settings-icon {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        min-width: 18px;
    }

    .button-badge {
        position: absolute;
        top: 3px;
        right: 3px;
        width: ${themeFonts.small};
        height: ${themeFonts.small};
        ${themeStyles.borderRadius.round}
        background-color: ${themeColors.usageDanger};
        box-shadow: 0 1px 3px ${themeColors.uiShadow};
    }
`;
