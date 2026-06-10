import { css } from "lit";
import { themeColors, themeFonts, themeStyles } from "../../../../styles";

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
        border-top: 1px solid ${themeColors.uiBorderDimm};
    }

    .settings-header {
        margin: 0 0 4px;
        color: ${themeColors.uiFont};
        font-size: ${themeFonts.size.normal};
        font-weight: ${themeFonts.weight.bold};
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
        font-size: ${themeFonts.size.normal};
    }

    .setting-title {
        display: inline;
    }

    .info-row {
        font-size: ${themeFonts.size.normal};
    }

    .agents-md-active,
    .agents-md-create {
        display: inline-flex;
        align-items: center;
        gap: 4px;
        padding: 2px 8px;
        border-radius: 999px;
        background: ${themeColors.uiBackground};
        border: ${themeStyles.border.normal};
        text-decoration: none;
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
