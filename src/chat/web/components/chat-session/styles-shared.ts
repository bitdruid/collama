import { css } from "lit";
import { themeColors } from "../../styles/theme-colors";

/**
 * Gemeinsame Styles für alle Chat-Components
 * Wiederverwendbare CSS-Klassen und Variablen
 */
export const commonStyles = css`
    ${themeColors}
    /* Icon Buttons */
    .icon-button {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        width: 24px;
        height: 24px;
        padding: 0;
        border: none;
        border-radius: 4px;
        background: transparent;
        color: var(--color-ui-font);
        cursor: pointer;
        font-size: 16px;
        transition: background 0.2s ease;
    }

    .icon-button:hover {
        background: var(--vscode-toolbar-hoverBackground);
    }

    .icon-button:active {
        transform: scale(0.95);
    }

    /* Action Buttons */
    .action-button {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        width: 20px;
        height: 20px;
        padding: 0;
        border: none;
        border-radius: 3px;
        background: transparent;
        cursor: pointer;
        font-size: 14px;
        transition: all 0.2s ease;
    }

    .action-button:hover {
        background: var(--vscode-toolbar-hoverBackground);
    }

    /* Primary Button */
    .primary-button {
        background-color: var(--color-submit);
        color: var(--color-ui-element-font);
        border: none;
        padding: 6px 12px;
        border-radius: 4px;
        cursor: pointer;
        font-size: 13px;
        transition: background 0.2s ease;
    }

    .primary-button:hover {
        background-color: var(--color-submit-hover);
    }

    /* Text Utilities */
    .text-muted {
        color: var(--color-ui-font-dimm);
    }

    .text-bold {
        font-weight: 600;
    }

    .text-uppercase {
        text-transform: uppercase;
    }

    /* Flex Utilities */
    .flex {
        display: flex;
    }

    .flex-center {
        display: flex;
        align-items: center;
        justify-content: center;
    }

    .flex-between {
        display: flex;
        align-items: center;
        justify-content: space-between;
    }

    /* Spacing Utilities */
    .gap-2 {
        gap: 8px;
    }
    .gap-3 {
        gap: 12px;
    }
    .gap-4 {
        gap: 16px;
    }

    /* Transitions */
    .fade-in {
        animation: fadeIn 0.3s ease;
    }

    @keyframes fadeIn {
        from {
            opacity: 0;
        }
        to {
            opacity: 1;
        }
    }

    /* Scrollbar Styling */
    .custom-scrollbar::-webkit-scrollbar {
        width: 8px;
    }

    .custom-scrollbar::-webkit-scrollbar-track {
        background: var(--vscode-scrollbarSlider-background);
    }

    .custom-scrollbar::-webkit-scrollbar-thumb {
        background: var(--vscode-scrollbarSlider-hoverBackground);
        border-radius: 4px;
    }
`;
