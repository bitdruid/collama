import { css } from "lit";
import { hljsStyles } from "../../utils";
import { themeColors } from "../../../styles";
import { bannerStyles } from "../../../template-components/banner/styles";

export const accordionStyles = [
    ...hljsStyles,
    bannerStyles,
    css`
        :host {
            display: block;
            margin: 6px 0;
            position: relative;
            z-index: 0;
        }

        .accordion {
            overflow: hidden;
            position: relative;
        }

        /* Smooth animation using CSS grid trick */
        .accordion-content-wrapper {
            display: grid;
            grid-template-rows: 0fr;
            transition: grid-template-rows 0.25s ease-out;
        }

        .accordion-content-wrapper.expanded {
            grid-template-rows: 1fr;
        }

        .accordion-content {
            overflow: hidden;
        }

        .accordion-content-inner {
            background: ${themeColors.uiBackgroundDimm};
            border-top: 1px solid ${themeColors.uiBorderDimm};
            max-height: min(300px, 40vh);
            overflow-y: scroll;
            overflow-x: auto;
        }

        /* Code accordions get their padding on <code> (rule below).
           For everything else (slot content, no <pre>), pad the inner. */
        .accordion-content-inner:not(:has(pre)) {
            padding: 8px 10px;
        }

        .accordion-content-wrapper:not(.expanded) .accordion-content-inner {
            border-top: none;
        }

        .accordion-content pre {
            margin: 0;
            min-width: max-content;
            overflow-x: auto;
        }

        .accordion-content pre code {
            padding: 8px 10px;
            white-space: pre;
            display: block;
        }

        .accordion-content pre code.hljs {
            overflow-x: visible;
        }

        /* think/summary: wrap prose, no horizontal scroll */
        .accordion.type-think .accordion-content-inner,
        .accordion.type-summary .accordion-content-inner {
            overflow-x: hidden;
        }

        .accordion.type-think .accordion-content pre,
        .accordion.type-summary .accordion-content pre {
            min-width: 0;
            white-space: pre-wrap;
            word-break: break-word;
        }

        .accordion.type-think .accordion-content pre code,
        .accordion.type-summary .accordion-content pre code {
            white-space: pre-wrap;
        }

        /* Type-specific content overrides */
        .accordion.type-tool-group .accordion-content-inner {
            max-height: min(500px, 60vh);
        }

        .accordion.type-tool-group .accordion-content-inner collama-accordion {
            margin: 0;
        }

        .accordion.type-tool-group .accordion-content-inner collama-accordion .accordion {
            border-radius: 0;
            border-left: none;
            border-right: none;
        }

        .accordion.type-tool-group .accordion-content-inner collama-accordion:first-child .accordion {
            border-top: none;
        }

        .banner-arrow {
            transition: transform 0.2s ease;
        }

        .banner-arrow.expanded {
            transform: rotate(180deg);
        }
    `,
];
