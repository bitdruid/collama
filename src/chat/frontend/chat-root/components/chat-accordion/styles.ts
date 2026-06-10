import { css } from "lit";
import { codeBlockStyles, themeColors, themeFonts, themeStyles } from "../../../styles";
import { bannerStyles } from "../../../template-components/banner/styles";

export const accordionStyles = [
    ...codeBlockStyles,
    bannerStyles,
    css`
        :host {
            font-familiy: ${themeFonts.familyMono};
            display: block;
            max-width: 750px;
            margin: 0px 0px;
            position: relative;
            z-index: 0;
        }

        .accordion {
            overflow: hidden;
            position: relative;
        }

        /* Smooth animation using CSS grid trick */
        .accordion-body {
            display: grid;
            grid-template-rows: 0fr;
            transition: grid-template-rows 0.25s ease-out;
        }

        .accordion-body.expanded {
            grid-template-rows: 1fr;
        }

        /* Clip-layer to round the scrollbar of the child-element */
        .accordion-body-clip {
            overflow: hidden;
            border-radius: ${themeStyles.borderRadius.large};
        }

        /* Border collapses inside to clip to zero (not viewable then) with own radius */
        .accordion-body-content {
            background: ${themeColors.uiBackgroundDimm};
            border: ${themeStyles.border.dimm};
            border-radius: ${themeStyles.borderRadius.large};
            max-height: 50vh;
            overflow-y: auto;
            overflow-x: auto;
        }

        /* Code accordions get their padding on <code> (rule below).
           For everything else (slot content, no <pre>), pad the inner. */
        .accordion-body-content:not(:has(pre)) {
            padding: 8px 10px;
        }

        /* Slotted prose (e.g. thinking) own paragraph margins; drop
           the outer ones; body looks the same regardless of content type. */
        ::slotted(:first-child) {
            margin-top: 0;
        }

        ::slotted(:last-child) {
            margin-bottom: 0;
        }

        .accordion-body-clip pre {
            margin: 0;
            min-width: max-content;
            overflow-x: auto;
        }

        .accordion-body-clip pre code {
            white-space: pre;
            display: block;
        }

        .accordion-body-clip pre code.hljs {
            overflow-x: visible;
        }

        /* think/summary: wrap prose, no horizontal scroll */
        .accordion.type-think .accordion-body-content,
        .accordion.type-summary .accordion-body-content {
            overflow-x: hidden;
        }

        .accordion.type-think .accordion-body-clip pre,
        .accordion.type-summary .accordion-body-clip pre {
            min-width: 0;
            white-space: pre-wrap;
            word-break: break-word;
        }

        .accordion.type-think .accordion-body-clip pre code,
        .accordion.type-summary .accordion-body-clip pre code {
            white-space: pre-wrap;
        }

        /* Tool group: nested tool rows hang under a left guide line, indented
           from it so the grouping reads without per-row boxes. */
        .accordion.type-tool-group .accordion-body-content {
            max-height: min(500px, 60vh);
            padding: 4px 8px 4px 14px;
            border-left: 3px solid ${themeColors.autoAccept};
        }

        .accordion.type-tool-group .accordion-body-content collama-accordion {
            margin: 0;
        }
    `,
];
