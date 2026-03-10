import { css } from "lit";

export const scrollToBottomButtonStyles = css`
    :host {
        display: block;
        position: relative;
    }

    .scroll-button {
        display: none;

        position: absolute;
        bottom: 0;
        left: 50%;
        transform: translateX(-50%);

        width: 24px;
        height: 24px;
        border-radius: 8px;
        border: 2px solid var(--vscode-commandCenter-activeBorder);
        background: var(--vscode-input-background);
        color: var(--vscode-editor-foreground);
        cursor: pointer;
        align-items: center;
        justify-content: center;
        padding: 0;
        transition: all 0.2s ease;
    }

    .scroll-button.visible {
        display: flex;
    }

    .scroll-button:hover {
        background: var(--vscode-toolbar-hoverBackground);
        border-color: var(--vscode-focusBorder);
        transform: translateX(-50%) scale(1.05);
    }

    .scroll-button:active {
        transform: translateX(-50%) scale(0.95);
    }

    .scroll-button svg {
        pointer-events: none;
    }
`;
