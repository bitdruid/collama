import { html, TemplateResult } from "lit";
import { ToolMessage } from "../../../../../common/context-chat";

export interface ToolRenderOptions {
    msg: ToolMessage;
    outOfContextClass: string;
    warningIcon: TemplateResult | string;
    bare?: boolean;
}

export function renderToolMessage(opts: ToolRenderOptions) {
    const { msg, outOfContextClass, warningIcon, bare } = opts;
    const toolLabel = `${msg.toolName || "unknown"}`;
    const escapedArgs = (msg.toolArgs || "").replace(/"/g, "&quot;").replace(/'/g, "&#39;");

    const accordion = html`
        <collama-accordion
            type="tool"
            label="${toolLabel}"
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
