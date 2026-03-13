import { css } from "lit";

export const scrollDownButtonStyles = css`
    .scroll-btn {
        display: none;
        align-items: center;
        justify-content: center;
        width: 32px;
        height: 32px;
        border-radius: 50%;
        border: 1px solid var(--vscode-editorWidget-border, #454545);
        background: var(--vscode-editorWidget-background, #252526);
        color: var(--vscode-editorWidget-foreground, #ccc);
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
        background: var(--vscode-list-hoverBackground, #2a2d2e);
    }
`;
