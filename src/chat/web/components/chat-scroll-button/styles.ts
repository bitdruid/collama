import { css } from "lit";

export const scrollDownButtonStyles = css`
    :host {
        position: absolute;
        bottom: 8px;
        left: 50%;
        transform: translateX(-50%);
        z-index: 10;
        pointer-events: none;
    }

    .scroll-btn {
        display: none;
        align-items: center;
        justify-content: center;
        width: 32px;
        height: 32px;
        border-radius: 50%;
        border: 1px solid var(--vscode-editorWidget-border);
        background: var(--vscode-editorWidget-background);
        color: var(--vscode-editorWidget-foreground);
        cursor: pointer;
        pointer-events: auto;
        opacity: 0;
        transition: opacity 0.2s;
    }

    .scroll-btn.visible {
        display: flex;
        opacity: 1;
    }

    .scroll-btn:hover {
        background: var(--vscode-list-hoverBackground);
    }
`;
