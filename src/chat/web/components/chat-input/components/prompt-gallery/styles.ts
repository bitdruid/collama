import { css } from "lit";
import { themeColors } from "../../../../styles/theme-colors";

export const galleryStyles = css`
    ${themeColors}

    :host {
        display: block;
    }

    .prompt-item {
        display: flex;
        justify-content: space-between;
        align-items: center;
        gap: 12px;
        padding: 10px 12px;
        cursor: pointer;
        border-radius: 8px;

        border: 1px solid var(--color-ui-border);
        background: rgba(255, 255, 255, 0.03);

        transition:
            border 0.2s ease,
            background 0.2s ease;
    }

    .prompt-item:hover {
        border: 1px solid var(--vscode-focusBorder);
        background: rgba(255, 255, 255, 0.06);
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
        background: var(--color-ui-background);
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
        color: var(--color-ui-element-font);
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
