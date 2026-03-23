import { css } from "lit";
import { themeColors } from "../../../../styles/theme-colors";

export const toolConfirmStyles = css`
    ${themeColors}

    .confirm-header {
        display: flex;
        align-items: center;
        gap: 8px;
        margin-bottom: 12px;
    }

    .confirm-header h3 {
        margin: 0;
    }

    .confirm-action {
        font-size: 12px;
        padding: 2px 8px;
        border-radius: 4px;
        background: var(--color-submit);
        color: var(--color-ui-element-font);
        text-transform: capitalize;
    }

    .confirm-filepath {
        font-family: var(--vscode-editor-font-family), monospace;
        font-size: 13px;
        color: var(--color-ui-font);
        padding: 8px 12px;
        border-radius: 6px;
        background: rgba(255, 255, 255, 0.03);
        border: 1px solid var(--color-ui-border);
        word-break: break-all;
    }

    .confirm-buttons {
        display: flex;
        gap: 8px;
        margin-top: 12px;
    }

    .confirm-btn {
        display: inline-flex;
        align-items: center;
        gap: 4px;
        padding: 6px 12px;
        cursor: pointer;
        border: none;
        border-radius: 4px;
        font-size: 13px;
        color: var(--color-ui-element-font);
    }

    .btn-accept {
        background: var(--color-submit);
    }

    .btn-accept:hover {
        background: var(--color-submit-hover);
    }

    .btn-accept-all {
        background: var(--color-context);
    }

    .btn-accept-all:hover {
        background: var(--color-context-hover);
    }

    .btn-cancel {
        background: var(--color-cancel);
    }

    .btn-cancel:hover {
        background: var(--color-cancel-hover);
    }

    .cancel-input-row {
        display: flex;
        gap: 8px;
        margin-top: 8px;
        animation: fadeIn 0.15s ease-out;
    }

    .cancel-input {
        flex: 1;
        padding: 6px 10px;
        border-radius: 6px;
        border: 1px solid var(--color-ui-border);
        background: var(--color-ui-background);
        color: var(--vscode-input-foreground);
        font-family: var(--vscode-editor-font-family);
        font-size: 13px;
        outline: none;
    }

    .cancel-input:focus {
        border-color: var(--vscode-focusBorder);
    }

    .cancel-input::placeholder {
        color: var(--color-disabled);
    }

    .btn-send {
        background: var(--color-cancel);
        padding: 6px 12px;
        cursor: pointer;
        border: none;
        border-radius: 4px;
        font-size: 13px;
        color: var(--color-ui-element-font);
    }

    .btn-send:hover {
        background: var(--color-cancel-hover);
    }

    @keyframes fadeIn {
        from {
            opacity: 0;
        }
        to {
            opacity: 1;
        }
    }
`;
