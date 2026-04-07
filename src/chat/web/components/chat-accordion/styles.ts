import { css } from "lit";
import { hljsStyles } from "../../../utils-front";
import { themeColors } from "../../styles/theme-colors";

export const accordionStyles = [
    ...hljsStyles,
    css`
        :host {
            display: block;
            margin: 8px 0;
            position: relative;
            z-index: 0;
        }

        .accordion {
            border: 1px solid ${themeColors.uiBorder};
            border-radius: 6px;
            overflow: hidden;
            position: relative;
        }

        .accordion-header {
            display: flex;
            align-items: center;
            gap: 6px;
            padding: 6px 10px;
            background: ${themeColors.accordionHeader};
            color: ${themeColors.uiFontDimm};
            cursor: pointer;
            user-select: none;
            font-size: 0.9em;
            border: none;
            width: 100%;
            text-align: left;
            transition: background 0.15s;
        }

        .accordion-header:hover {
            background: ${themeColors.uiBackgroundHover};
        }

        .accordion-arrow {
            display: inline-flex;
            align-items: center;
            justify-content: center;
            width: 16px;
            height: 16px;
            transition: transform 0.2s ease;
        }

        .accordion-arrow.expanded {
            transform: rotate(180deg);
        }

        .accordion-icon {
            display: inline-flex;
            align-items: center;
            justify-content: center;
            width: 16px;
            height: 16px;
        }

        .accordion-label {
            flex: 1;
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
            font-weight: 600;
        }

        .accordion-description {
            font-weight: 400;
            font-style: italic;
            opacity: 0.85;
            margin-left: 4px;
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
            background: ${themeColors.accordionContent};
            border-top: 1px solid ${themeColors.uiBorder};
            max-height: min(300px, 40vh);
            overflow-y: scroll;
            overflow-x: auto;
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

        /* Type-specific styling */
        .accordion.type-think .accordion-header {
            border-left: 3px solid ${themeColors.submit};
        }

        .accordion.type-summary .accordion-header {
            border-left: 3px solid ${themeColors.compress};
        }

        .accordion.type-tool .accordion-header {
            border-left: 3px solid ${themeColors.autoAccept};
        }

        .accordion.type-tool-group .accordion-header {
            border-left: 3px solid ${themeColors.autoAccept};
        }

        .accordion.type-tool-group .accordion-content-inner {
            max-height: min(500px, 60vh);
            padding: 0;
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

        .accordion.type-code .accordion-header {
            border-left: none;
        }

        .accordion.type-context .accordion-header {
            border-left: 3px solid ${themeColors.context};
        }

        .accordion-actions {
            display: flex;
            align-items: center;
            gap: 4px;
        }

        .copy-btn {
            display: flex;
            align-items: center;
            gap: 4px;
            background: transparent;
            border: none;
            color: ${themeColors.uiFontDimm};
            cursor: pointer;
            padding: 2px 6px;
            border-radius: 4px;
            font-size: 0.85em;
            transition:
                background 0.15s,
                color 0.15s;
        }

        .copy-btn:hover {
            background: ${themeColors.uiBackgroundHover};
            color: ${themeColors.uiFont};
        }
    `,
];
