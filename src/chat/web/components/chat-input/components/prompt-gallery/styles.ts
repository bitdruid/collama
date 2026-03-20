import { css } from "lit";
import { themeColors } from "../../../../styles/theme-colors";

export const galleryStyles = css`
    ${themeColors}
    .modal {
        position: fixed;
        inset: 0;
        background: rgba(0, 0, 0, 0.5);
        display: flex;
        align-items: center;
        justify-content: center;
        animation: fadeIn 0.18s ease-out;
    }

    .modal-content {
        background: var(--vscode-editor-background);
        padding: 16px;
        border-radius: 8px;
        max-width: 400px;
        width: 90%;
        max-height: 80%;
        overflow-y: auto;

        border: 1px solid rgba(101, 141, 187, 0.6);
        box-shadow: 0 0 8px rgba(255, 255, 255, 0.2);

        animation: scaleIn 0.18s ease-out;
    }

    @keyframes fadeIn {
        from {
            opacity: 0;
        }
        to {
            opacity: 1;
        }
    }

    @keyframes scaleIn {
        from {
            opacity: 0;
            transform: scale(0.95) translateY(8px);
        }
        to {
            opacity: 1;
            transform: scale(1) translateY(0);
        }
    }

    .prompt-item {
        display: flex;
        justify-content: space-between;
        align-items: center;
        gap: 12px;
        padding: 10px 12px;
        cursor: pointer;
        border-radius: 8px;

        border: 1px solid rgba(101, 141, 187, 0.6);
        background: rgba(255, 255, 255, 0.03);

        transition:
            border 0.2s ease,
            box-shadow 0.2s ease,
            background 0.2s ease,
            transform 0.15s ease;
    }

    .prompt-item:hover {
        border: 1px solid rgba(255, 255, 255, 0.6);
        background: rgba(255, 255, 255, 0.06);
        box-shadow: 0 0 10px rgba(255, 255, 255, 0.25);
        transform: translateY(-1px);
    }

    .prompt-list {
        display: flex;
        flex-direction: column;
        gap: 10px;
    }

    .prompt-text {
        flex: 1;
        word-break: break-word;
    }

    .prompt-actions {
        display: flex;
        gap: 6px;
        flex-shrink: 0;
    }

    .prompt-add-section {
        margin-top: 14px;
    }

    .custom-prompt-input {
        width: 95%;
        padding: 8px 12px;
        border-radius: 6px;
        border: 1px solid var(--vscode-editorLineHighlightBorder);
        background: var(--vscode-input-background);
        color: var(--vscode-input-foreground);
        font-family: var(--vscode-editor-font-family);
        font-size: 13px;
        resize: vertical;
        outline: none;
        box-shadow: inset 0 0 0 1px var(--vscode-editorLineHighlightBorder);
        transition:
            border-color 0.2s,
            box-shadow 0.2s;
    }

    .custom-prompt-input:focus {
        border-color: var(--vscode-focusBorder);
        box-shadow: 0 0 0 2px var(--vscode-focusBorder) inset;
    }
`;

export const galleryButtonStyles = css`
    ${themeColors}
    .button-container {
        display: flex;
        gap: 8px;
        margin-top: 6px;
    }

    .gallery-btn {
        display: inline-flex;
        padding: 4px 8px;
        cursor: pointer;
        border: none;
        border-radius: 4px;
        align-items: center;
        justify-content: center;
        color: var(--color-text-white);
    }

    .edit-btn,
    .delete-btn {
        width: 28px;
        height: 28px;
    }

    .prompt-btn,
    .edit-btn {
        background: var(--color-submit);
    }

    .prompt-btn:hover,
    .edit-btn:hover {
        background: var(--color-submit-hover);
    }

    .delete-btn,
    .cancel-btn {
        background: var(--color-cancel);
    }

    .delete-btn:hover,
    .cancel-btn:hover {
        background: var(--color-cancel-hover);
    }
`;
