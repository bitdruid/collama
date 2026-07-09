import { css } from "lit";
import { themeColors, themeFonts, themeStyles } from "../../../../styles";

export const acquireModalStyles = css`
    /* slim recommendation modal: tighter padding and a compact header */
    .modal-content {
        padding: 10px 12px;
    }

    .modal-header {
        margin-bottom: 8px;
    }

    .acquire-content {
        display: flex;
        align-items: center;
        gap: 10px;
    }

    .acquire-description {
        flex: 1;
        min-width: 0;
        color: ${themeColors.uiFont};
        font-size: ${themeFonts.size.normal};
    }

    .acquire-actions {
        display: flex;
        align-items: center;
        gap: 6px;
    }

    /* keep the readout hint style available if a boxed description is wanted */
    .acquire-description.boxed {
        padding: 6px 8px;
        border: ${themeStyles.border.normal};
        border-radius: ${themeStyles.borderRadius.small};
        background: ${themeColors.uiBackground};
    }
`;
