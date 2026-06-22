import { css } from "lit";
import { themeColors, themeFonts, themeStyles } from "../../../../styles";

export const acquireModalStyles = css`
    .acquire-content {
        display: flex;
        flex-direction: column;
        gap: 12px;
    }

    .acquire-summary {
        display: flex;
        align-items: center;
        gap: 8px;
    }

    .acquire-description {
        flex: 1;
        min-width: 0;
        padding: 6px 8px;
        border: ${themeStyles.border.normal};
        border-radius: ${themeStyles.borderRadius.small};
        background: ${themeColors.uiBackground};
        color: ${themeColors.uiFont};
        font-size: ${themeFonts.size.normal};
    }
`;
