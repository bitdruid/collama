import { css } from "lit";
import { themeColors } from "../../../styles/theme-colors";
import { themeFonts } from "../../../styles/theme-fonts";

export const settingsDropdownStyles = css`
    :host {
        --dropdown-open-max-height: min(72vh, 640px);
    }

    .dropdown-content {
        padding: 8px;
        min-width: 0;
    }

    .settings-section {
        display: flex;
        flex-direction: column;
        gap: 2px;
        padding: 8px;
    }

    .settings-section + .settings-section {
        border-top: 1px solid ${themeColors.uiBorder};
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

    .setting-title {
        display: inline;
        line-height: 1.3;
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
