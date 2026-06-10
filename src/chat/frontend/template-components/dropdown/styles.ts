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
        background: ${themeColors.uiBackgroundDimm};
        border: ${themeStyles.border.dimm};
        border-bottom-left-radius: ${themeStyles.borderRadius.large};
        border-bottom-right-radius: ${themeStyles.borderRadius.large};
        ${themeStyles.boxShadow}
        overflow: hidden;
        clip-path: inset(0 0 100% 0);
        opacity: 0;
        transform: translateY(-10px);
        transition:
            clip-path 0.25s ease-out,
            opacity 0.25s ease-out,
            transform 0.25s ease-out;
    }

    .dropdown-panel.open {
        clip-path: inset(0 0 0 0);
        opacity: 1;
        transform: translateY(0);
    }

    .dropdown-content {
        padding: 8px 0;
    }
`;
