import { css } from "lit";

export const agentTokenCounterStyles = css`
    :host {
        display: block;
    }

    .box {
        display: none;
        flex-direction: column;
        padding: 4px 8px;
        border-radius: 8px;
        border: 2px solid var(--vscode-commandCenter-activeBorder);
        background: var(--vscode-input-background);
        width: 13ch;
        margin-bottom: -2px;
    }

    .box.visible {
        display: flex;
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
