import { css } from "lit";

export const agentTokenCounterStyles = css`
    :host {
        display: block;
        position: relative;
    }

    .box {
        display: none;
        flex-direction: column;
        position: absolute;
        bottom: 0;
        left: 0;
        padding: 4px 8px;
        border-radius: 8px;
        border: 2px solid var(--vscode-commandCenter-activeBorder);
        background: var(--vscode-input-background);
        width: 10ch;
        transition: opacity 0.2s;
    }

    .box.visible:hover {
        opacity: 0.2;
    }

    .box.visible {
        display: flex;
        opacity: 1;
        pointer-events: auto;
    }

    .label {
        font-size: 9px;
        color: var(--vscode-descriptionForeground);
        margin-bottom: 1px;
    }

    .value {
        font-size: inherit;
        font-weight: 600;
        color: var(--vscode-editor-foreground);
    }
`;
