import { css } from "lit";

export const chatContainerStyles = css`
    :host {
        display: flex;
        flex-direction: column;
        height: 100%;
    }

    collama-chatsessions {
        flex: 0 0 auto;
    }

    .chat-area {
        flex: 1 1 auto;
        display: flex;
        flex-direction: column;
        min-height: 0;
    }

    .output-wrapper {
        flex: 1 1 auto;
        position: relative;
        min-height: 0;
    }

    collama-chatoutput {
        position: absolute;
        inset: 0;
        overflow-y: auto;
        margin-top: 12px;
    }

    collama-token-counter {
        position: absolute;
        bottom: 0;
        left: 0;
        z-index: 10;
    }

    collama-scroll-down {
        position: absolute;
        bottom: 0;
        left: 50%;
        transform: translateX(-50%);
        z-index: 10;
        pointer-events: none;
    }

    collama-chatinput {
        flex: 0 0 auto;
        display: flex;
        flex-direction: column;
        margin-top: 12px;
        padding: 8px;
    }

    .toast {
        position: fixed;
        bottom: 80px;
        left: 50%;
        transform: translateX(-50%);
        background: var(--vscode-editorWidget-background, #1e1e1e);
        border: 1px solid var(--vscode-editorWidget-border, #454545);
        color: var(--vscode-editorWidget-foreground, #ccc);
        padding: 6px 14px;
        border-radius: 6px;
        font-size: 12px;
        opacity: 0;
        transition: opacity 0.3s;
        pointer-events: none;
        z-index: 100;
    }

    .toast.visible {
        opacity: 1;
    }
`;
