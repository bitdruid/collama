import { css } from "lit";

export const chatInputStyles = css`
    :host {
        position: relative;
        overflow: visible;
        border-radius: 8px;
        border: 2px solid var(--color-ui-border);
        background: var(--color-ui-background);
    }

    collama-prompt-gallery,
    collama-tool-confirm {
        position: absolute;
        bottom: 100%;
        left: -2px;
        right: -2px;
        margin-bottom: 8px;
    }
    textarea {
        flex: 1;
        width: 100%;
        font-size: 14px;
        padding: 8px;
        border-radius: 8px;
        border: none;
        color: var(--color-ui-font);
        background: transparent;
        resize: none;
        overflow: hidden;
        line-height: 1.2em;
        box-sizing: border-box;
    }
    button-row {
        display: flex;
        justify-content: flex-end;
        margin-top: 8px;
        gap: 8px;
    }
`;
