import { css } from "lit";
import { themeColors, themeFonts } from "../styles";

export const ChatRootStyles = css`
    :host {
        display: flex;
        flex-direction: column;
        height: 100%;
        overflow: hidden;
        font-family: ${themeFonts.family};
        font-size: ${themeFonts.size.normal};
        font-weight: ${themeFonts.weight.normal};
        line-height: ${themeFonts.lineHeight};
    }

    collama-chatheader {
        flex: 0 0 auto;
        border-bottom: 1px solid ${themeColors.uiBorderDimm};
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
        overflow-x: hidden;
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

    collama-chatinput[inert] {
        pointer-events: none;
        user-select: none;
    }
`;
