import { css } from "lit";
import { themeColors } from "../../styles/theme-colors";

export const chatContainerStyles = css`
    :host {
        display: flex;
        flex-direction: column;
        height: 100%;
        overflow: hidden;
    }

    collama-chatsessions {
        flex: 0 0 auto;
        border-bottom: 2px solid ${themeColors.uiBorderDimm};
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
        overflow-y: scroll;
    }

    collama-token-counter {
        position: absolute;
        bottom: 0;
        left: 0;
        z-index: 10;
    }

    collama-chatinput {
        flex: 0 0 auto;
        display: flex;
        flex-direction: column;
        overflow: visible;
    }
`;
