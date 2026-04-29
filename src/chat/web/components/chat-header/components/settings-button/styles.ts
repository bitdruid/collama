import { css } from "lit";
import { themeColors } from "../../../../styles/theme-colors";

export const settingsButtonStyles = css`
    .settings-button {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        gap: 2px;
        min-width: 40px;
        height: 28px;
        padding: 0 4px;
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

    .settings-icon svg {
        width: 18px;
        height: 18px;
    }

    .toggle-icon {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        color: ${themeColors.uiFont};
        opacity: 0.6;
        transition: transform 0.2s ease;
    }

    .toggle-icon svg {
        display: block;
        width: 14px;
        height: 14px;
    }

    .settings-button.expanded .toggle-icon {
        transform: rotate(180deg);
    }

    .button-badge {
        position: absolute;
        top: 1px;
        right: 12px;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        width: 14px;
        height: 14px;
        border-radius: 50%;
        background-color: ${themeColors.usageDanger};
        color: ${themeColors.cleanWhite};
        font-size: 9px;
        font-weight: bold;
        line-height: 1;
        box-shadow: 0 1px 3px ${themeColors.uiShadow};
    }
`;
