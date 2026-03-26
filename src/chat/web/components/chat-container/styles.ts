import { css } from "lit";

export const chatContainerStyles = css`
    :host {
        display: flex;
        flex-direction: column;
        height: 100%;
        overflow: hidden;
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
    }

    collama-token-counter {
        position: absolute;
        bottom: 0;
        left: 0;
        z-index: 10;
    }

    collama-chat-modal {
        flex: 0 0 auto;
        display: flex;
    }

    collama-chatinput {
        flex: 0 0 auto;
        display: flex;
        flex-direction: column;
        overflow: visible;
    }
`;
