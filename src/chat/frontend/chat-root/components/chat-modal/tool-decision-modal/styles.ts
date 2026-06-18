import { css } from "lit";
import { themeColors, themeFonts, themeStyles } from "../../../../styles";

export const toolDecisionStyles = css`
    .decision-content {
        display: flex;
        flex-direction: column;
        gap: 12px;
    }

    .decision-options {
        display: flex;
        flex-direction: column;
        gap: 6px;
    }

    .decision-option {
        text-align: left;
        padding: 8px 12px;
        cursor: pointer;
        border: ${themeStyles.border.dimm};
        background: ${themeColors.uiBackgroundDimm};
        color: ${themeColors.uiFont};
        font-size: ${themeFonts.size.normal};
        border-radius: ${themeStyles.borderRadius.small};
    }

    .decision-option:hover {
        background: ${themeColors.uiBackground};
        border-color: ${themeColors.uiBorder};
    }

    .decision-option:focus {
        ${themeStyles.focus}
    }

    .decision-option.hidden {
        display: none;
    }

    .custom-input-area {
        display: none;
        flex-direction: column;
        gap: 8px;
    }

    .custom-input-area.visible {
        display: flex;
    }

    .custom-input-row {
        display: flex;
        flex-direction: row;
        align-items: center;
        gap: 6px;
    }

    .custom-input-row .custom-textarea {
        flex: 1;
        min-width: 0;
    }

    .custom-input-row collama-accept-button {
        flex: 0 0 auto;
    }

    .custom-textarea {
        box-sizing: border-box;
        resize: none;
        padding: 8px 12px;
        border: ${themeStyles.border.dimm};
        border-radius: ${themeStyles.borderRadius.small};
        background: ${themeColors.uiBackgroundDimm};
        color: ${themeColors.uiFont};
        font-size: ${themeFonts.size.normal};
        font-family: inherit;
        line-height: 1.4;
        outline: none;
    }

    .custom-textarea:focus {
        border-color: ${themeColors.uiBorder};
        ${themeStyles.focus}
    }
`;
