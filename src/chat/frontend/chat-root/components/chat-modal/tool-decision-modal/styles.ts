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
`;
