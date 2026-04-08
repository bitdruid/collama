import { css } from "lit";
import { themeColors } from "../../styles/theme-colors";
import { themeFonts } from "../../styles/theme-fonts";

export const commonStyles = css`
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
        color: ${themeColors.uiFont};
        cursor: pointer;
        font-size: ${themeFonts.large};
        transition: background 0.2s ease;
    }

    .icon-button:hover {
        background: ${themeColors.uiBackgroundHoverDimm};
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
        font-size: ${themeFonts.medium};
        transition: all 0.2s ease;
    }

    .action-button:hover {
        background: ${themeColors.uiBackgroundHoverDimm};
    }

    /* Primary Button */
    .primary-button {
        background-color: ${themeColors.submit};
        color: ${themeColors.cleanWhite};
        border: none;
        padding: 6px 12px;
        border-radius: 4px;
        cursor: pointer;
        font-size: ${themeFonts.medium};
        transition: background 0.2s ease;
    }

    .primary-button:hover {
        background-color: ${themeColors.submitHover};
    }

    /* Text Utilities */
    .text-muted {
        color: ${themeColors.uiFont};
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
        background: ${themeColors.scrollBar};
    }

    .custom-scrollbar::-webkit-scrollbar-thumb {
        background: ${themeColors.scrollBarHover};
        border-radius: 4px;
    }
`;
