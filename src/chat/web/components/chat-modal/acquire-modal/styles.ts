import { css } from "lit";
import { themeColors } from "../../../styles/theme-colors";
import { themeFonts } from "../../../styles/theme-fonts";

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
        border: 1px solid ${themeColors.uiBorderDimm};
        border-radius: 4px;
        background: ${themeColors.uiBackgroundDimm};
        color: ${themeColors.uiFont};
        font-size: ${themeFonts.medium};
    }
`;
