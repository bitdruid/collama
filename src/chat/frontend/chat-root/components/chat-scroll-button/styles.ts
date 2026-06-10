import { css } from "lit";
import { themeColors, themeStyles } from "../../../styles";
import { bottomOverlayStyles } from "../../../template-components/overlay/bottom-overlay";

export const scrollDownButtonStyles = css`
    ${bottomOverlayStyles}

    .scroll-btn {
        display: flex;
        align-items: center;
        justify-content: center;
        width: 32px;
        height: 32px;
        border-radius: ${themeStyles.borderRadius.round};
        border: ${themeStyles.border.dimm};
        background: ${themeColors.uiBackgroundDimm};
        color: ${themeColors.uiFont};
        cursor: pointer;
    }

    .scroll-btn:hover {
        background: ${themeColors.uiBackgroundHoverDimm};
    }
`;
