import { css } from "lit";
import { themeColors } from "../../../styles/theme-colors";
import { themeFonts } from "../../../styles/theme-fonts";

export const settingsModalStyles = css`
    .settings-section {
        display: flex;
        flex-direction: column;
        gap: 2px;
        padding: 8px;
        border: 1px solid ${themeColors.uiBorder};
        border-radius: 6px;
    }

    .settings-section + .settings-section {
        margin-top: 8px;
    }

    h4 {
        margin: 0 0 4px;
        color: ${themeColors.uiFont};
        font-size: ${themeFonts.medium};
        font-weight: 800;
        text-transform: uppercase;
        letter-spacing: 0.05em;
    }

    .setting-row {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 8px;
        min-height: 20px;
        color: ${themeColors.uiFont};
        font-size: ${themeFonts.medium};
    }

    .setting-row.toggle {
        cursor: pointer;
    }

    .setting-text {
        display: flex;
        align-items: center;
        gap: 6px;
        min-width: 0;
    }

    .setting-title {
        display: inline;
        line-height: 1.3;
    }

    .switch-input {
        position: absolute;
        opacity: 0;
        pointer-events: none;
    }

    .switch {
        position: relative;
        flex: 0 0 auto;
        width: 34px;
        height: 18px;
        border: 1px solid ${themeColors.uiBorder};
        border-radius: 999px;
        background: ${themeColors.uiBackground};
        transition:
            background 0.15s ease,
            border-color 0.15s ease;
    }

    .switch::after {
        content: "";
        position: absolute;
        top: 2px;
        left: 2px;
        width: 12px;
        height: 12px;
        border-radius: 50%;
        background: ${themeColors.uiFont};
        transition: transform 0.15s ease;
    }

    .switch-input:checked + .switch {
        border-color: ${themeColors.submit};
        background: ${themeColors.submit};
    }

    .switch-input:checked + .switch::after {
        transform: translateX(16px);
        background: ${themeColors.cleanWhite};
    }

    .info-row {
        font-size: ${themeFonts.medium};
    }

    .agents-md-active,
    .agents-md-create {
        display: inline-flex;
        align-items: center;
        gap: 4px;
        text-decoration: underline;
        text-underline-offset: 2px;
    }

    .agents-md-active {
        color: ${themeColors.submit};
    }

    .agents-md-create {
        color: ${themeColors.placeholder};
    }

    .agents-md-active:hover,
    .agents-md-create:hover {
        color: ${themeColors.uiFont};
    }

    .agents-md-check {
        display: inline-flex;
        align-items: center;
    }
`;
