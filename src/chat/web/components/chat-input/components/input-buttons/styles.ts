// src/chat/web/components/chat_input/components/input_buttons/styles.ts
import { css } from "lit";
import { themeColors } from "../../../../styles/theme-colors";

export const inputButtonsStyles = css`
    ${themeColors}
    button-submit,
    button-context,
    button-cancel,
    button-compress,
    button-gallery,
    button-auto-accept,
    button-token-counter {
        display: inline-flex;
        align-items: center;
        justify-content: center;

        width: 28px;
        height: 28px;
        aspect-ratio: 1 / 1;

        padding: 0;
        border-radius: 50%;

        line-height: 1;

        color: var(--color-text-white);
        border: none;
        cursor: pointer;
        box-sizing: border-box;
    }
    button-submit {
        background-color: var(--color-submit);
    }
    button-submit:hover {
        background-color: var(--color-submit-hover);
    }
    button-submit:disabled {
        background-color: var(--color-disabled);
        cursor: not-allowed;
        opacity: 0.5;
    }
    button-context {
        background-color: var(--color-context);
    }
    button-context:hover {
        background-color: var(--color-context-hover);
    }
    button-cancel {
        background-color: var(--color-cancel);
        box-shadow:
            0 0 0 2px var(--color-text-white),
            0 0 0 4px var(--color-cancel);
        animation: cancel-spin 2s infinite;
    }
    button-cancel:hover {
        background-color: var(--color-cancel-hover);
    }
    @keyframes cancel-spin {
        0%,
        100% {
            box-shadow:
                0 0 0 2px var(--color-text-white),
                0 0 0 4px var(--color-cancel);
        }
        50% {
            box-shadow:
                0 0 0 2px var(--color-text-white),
                0 0 0 8px var(--color-cancel),
                0 0 15px rgba(168, 34, 34, 0.5);
        }
    }
    button-compress {
        background-color: var(--color-compress);
    }
    button-compress:hover {
        background-color: var(--color-compress-hover);
    }
    button-gallery {
        background-color: var(--color-gallery);
    }
    button-gallery:hover {
        background-color: var(--color-gallery-hover);
    }
    button-auto-accept {
        background-color: var(--color-auto-accept);
    }
    button-auto-accept:hover {
        background-color: var(--color-auto-accept-hover);
    }
    button-token-counter {
        background-color: var(--color-submit);
        width: auto;
        aspect-ratio: auto;
        padding: 0 10px;
        border-radius: 14px;
        font-size: 12px;
        font-weight: 600;
        cursor: default;
    }
    button-auto-accept[active] {
        background-color: var(--color-auto-accept-active);
        box-shadow:
            0 0 0 2px var(--color-text-white),
            0 0 0 4px var(--color-auto-accept-active);
        animation: pulse 2s infinite;
    }

    @keyframes pulse {
        0%,
        100% {
            box-shadow:
                0 0 0 2px var(--color-text-white),
                0 0 0 4px var(--color-auto-accept-active);
        }
        50% {
            box-shadow:
                0 0 0 2px var(--color-text-white),
                0 0 0 8px var(--color-auto-accept-active),
                0 0 15px rgba(255, 107, 107, 0.5);
        }
    }
    .context-display {
        display: inline-flex;
        align-items: center;
        gap: 4px;
        padding: 4px 8px;
        border-radius: 12px;
        background-color: var(--color-context);
        color: var(--color-text-white);
        font-size: 12px;
        white-space: nowrap;
    }
    .context-close {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        width: 14px;
        height: 14px;
        margin-left: 4px;
        border-radius: 50%;
        background: rgba(255, 255, 255, 0.2);
        border: none;
        color: var(--color-text-white);
        font-size: 10px;
        line-height: 1;
        cursor: pointer;
        padding: 0;
    }
    .context-close:hover {
        background: rgba(255, 255, 255, 0.4);
    }
    .context-list {
        display: flex;
        flex-wrap: wrap;
        gap: 4px;
        align-items: center;
    }
    button-row {
        display: flex;
        justify-content: flex-end;
        margin-top: 8px;
        gap: 8px;
    }
`;
