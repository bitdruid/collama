import { html, TemplateResult } from "lit";
import { ToolMessage } from "../../../../../common/context-chat";
import { escapeAttr } from "../../../../utils-front";

export interface ToolRenderOptions {
    msg: ToolMessage;
    outOfContextClass: string;
    warningIcon: TemplateResult | string;
    bare?: boolean;
}

export function renderToolMessage(opts: ToolRenderOptions) {
    const { msg, outOfContextClass, warningIcon, bare } = opts;
    const toolName = msg.customKeys?.toolName || "unknown";
    const toolTarget = msg.customKeys?.toolTarget || "";
    const escapedArgs = escapeAttr(msg.customKeys?.toolArgs || "");

    const accordion = html`
        <collama-accordion
            type="tool"
            label="${toolName}"
            description="${toolTarget}"
            code="${escapedArgs}"
            copyCode="${escapedArgs}"
        ></collama-accordion>
    `;

    if (bare) {
        return accordion;
    }

    return html`
        <div class="message tool ${outOfContextClass}">
            <div class="bubble-tool">${accordion}</div>
        </div>
    `;
}
