import { css } from "lit";
import { themeColors } from "../../../styles/theme-colors";

export const baseDropdownStyles = css`
    :host {
        display: block;
        position: relative;
    }

    .dropdown-overlay {
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        z-index: 1000;
        background: transparent;
        opacity: 0;
        pointer-events: none;
        transition: opacity 0.2s ease-out;
    }

    .dropdown-overlay.open {
        opacity: 1;
        pointer-events: auto;
    }

    .dropdown-panel {
        position: absolute;
        top: 100%;
        left: 0;
        right: 0;
        z-index: 1001;
        background: ${themeColors.uiBackgroundDimm};
        border: 1px solid ${themeColors.uiBorderDimm};
        border-radius: 4px;
        max-height: 0;
        overflow: hidden;
        opacity: 0;
        transform: translateY(-10px);
        transition: max-height 0.25s ease-out, opacity 0.2s ease-out, transform 0.25s ease-out;
    }

    .dropdown-panel.open {
        max-height: 300px;
        overflow-y: auto;
        opacity: 1;
        transform: translateY(0);
    }

    .dropdown-content {
        padding: 8px 0;
    }
`;