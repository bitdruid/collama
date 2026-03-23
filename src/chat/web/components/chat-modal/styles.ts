import { css } from "lit";
import { themeColors } from "../../styles/theme-colors";

export const chatModalStyles = css`
    ${themeColors}
    :host {
        display: block;
    }

    .modal {
        background: var(--color-ui-background);
        border-radius: 8px;
    }

    .modal.closing {
        opacity: 0;
        transition: opacity 0.2s ease-in;
    }

    .modal-content {
        position: relative;
        padding: 16px;
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
`;
