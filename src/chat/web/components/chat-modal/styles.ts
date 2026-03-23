import { css } from "lit";
import { themeColors } from "../../styles/theme-colors";

export const chatModalStyles = css`
    ${themeColors}
    .modal {
        background: var(--color-ui-background);
        border: 2px solid var(--color-ui-border);
        border-radius: 8px;
        overflow: hidden;
        animation: slideUp 0.3s ease-out;
    }

    .modal.closing {
        animation: slideDown 0.25s ease-in forwards;
    }

    .modal-content {
        position: relative;
        padding: 16px;
        max-height: 50vh;
        overflow-y: auto;
    }

    .close-btn {
        position: absolute;
        top: 8px;
        right: 12px;
        cursor: pointer;
        font-size: 18px;
        line-height: 1;
        color: var(--color-ui-border);
    }

    .close-btn:hover {
        color: var(--color-ui-font);
    }

    @keyframes slideUp {
        0% {
            opacity: 0;
            transform: translateY(100%);
        }
        60% {
            opacity: 0.6;
            transform: translateY(0);
        }
        100% {
            opacity: 1;
            transform: translateY(0);
        }
    }

    @keyframes slideDown {
        0% {
            opacity: 1;
            transform: translateY(0);
        }
        40% {
            opacity: 0.6;
            transform: translateY(0);
        }
        100% {
            opacity: 0;
            transform: translateY(100%);
        }
    }
`;
