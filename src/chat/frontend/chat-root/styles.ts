import { css } from "lit";
import { themeColors, themeFonts } from "../styles";

export const ChatRootStyles = css`
    :host {
        --scrollbar-w: 10px;
        display: flex;
        flex-direction: column;
        height: 100%;
        overflow: hidden;
        font-family: ${themeFonts.family};
        font-size: ${themeFonts.size.normal};
        font-weight: ${themeFonts.weight.normal};
        line-height: ${themeFonts.lineHeight.normal};
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
        /* Always reserve the gutter so content never shifts left when the scrollbar appears. */
        scrollbar-gutter: stable;
    }

    /* Custom classic scrollbar at a known fixed width, themed to match the editor. */
    collama-chatoutput::-webkit-scrollbar {
        width: var(--scrollbar-w);
    }

    collama-chatoutput::-webkit-scrollbar-thumb {
        background: ${themeColors.scrollBar};
    }

    collama-chatoutput::-webkit-scrollbar-thumb:hover {
        background: ${themeColors.scrollBarHover};
    }

    collama-token-counter {
        position: absolute;
        bottom: 0;
        left: 0;
        z-index: 10;
    }

    /* float over the bottom of the output so the dots/banner never resize the scroll area */
    .bottom-overlay {
        position: absolute;
        left: 0;
        /* inset the right edge by the reserved scrollbar gutter so it aligns with content */
        right: var(--scrollbar-w);
        bottom: 0;
        z-index: 10;
        display: flex;
        flex-direction: column;
        pointer-events: none;
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
