import { css } from "lit";
import { themeColors, themeStyles } from "../../styles";

export const baseDropdownStyles = css`
    :host {
        display: block;
        width: 100%;
        box-sizing: border-box;
    }

    .dropdown-panel {
        position: absolute;
        z-index: 100;
        box-sizing: border-box;
        width: 100%;
        max-height: var(--dropdown-open-max-height, 300px);
        background: ${themeColors.uiBackground};
        border: ${themeStyles.border.normal};
        border-bottom-left-radius: ${themeStyles.borderRadius.large};
        border-bottom-right-radius: ${themeStyles.borderRadius.large};
        overflow: hidden;
        opacity: 0;
        transform: translateY(-10px);
        transition:
            opacity 0.25s ease-out,
            transform 0.25s ease-out;
    }

    .dropdown-panel.open {
        opacity: 1;
        transform: translateY(0);
    }

    .dropdown-content {
        padding: 8px 0;
    }
`;
