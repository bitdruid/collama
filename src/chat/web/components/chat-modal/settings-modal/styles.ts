import { css } from "lit";
import { themeColors } from "../../../styles/theme-colors";
import { themeFonts } from "../../../styles/theme-fonts";

export const settingsModalStyles = css`
    .settings-section {
        display: flex;
        flex-direction: column;
        gap: 4px;
        padding: 12px;
        border: 1px solid ${themeColors.uiBorderDimm};
        border-radius: 6px;
    }

    .settings-section + .settings-section {
        margin-top: 12px;
    }

    h4 {
        margin: 0 0 8px;
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
        gap: 12px;
        min-height: 24px;
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

    .setting-danger {
        display: inline-flex;
        align-items: center;
        color: ${themeColors.usageDanger};
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
        border: 1px solid ${themeColors.uiBorderDimm};
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

    .slider-row {
        align-items: flex-start;
        flex-direction: column;
        gap: 8px;
    }

    .slider-heading {
        display: flex;
        justify-content: space-between;
        width: 100%;
        gap: 16px;
    }

    .setting-value {
        flex: 0 0 auto;
        text-transform: capitalize;
        color: ${themeColors.placeholder};
    }

    input[type="range"] {
        width: 100%;
        accent-color: ${themeColors.submit};
    }

    .slider-labels {
        display: grid;
        grid-template-columns: repeat(3, minmax(0, 1fr));
        width: 100%;
        color: ${themeColors.placeholder};
        font-size: ${themeFonts.small};
    }

    .slider-labels span:nth-child(2) {
        text-align: center;
    }

    .slider-labels span:nth-child(3) {
        text-align: right;
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
