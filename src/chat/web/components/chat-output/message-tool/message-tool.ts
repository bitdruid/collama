import { html, TemplateResult } from "lit";
import { ChatMessage } from "../../chat-container/chat-container";

export interface ToolRenderOptions {
    msg: ChatMessage;
    outOfContextClass: string;
    warningIcon: TemplateResult | string;
}

export function renderToolMessage(opts: ToolRenderOptions) {
    const { msg, outOfContextClass, warningIcon } = opts;
    const toolLabel = `Tool: ${msg.toolName || "unknown"}`;
    const escapedArgs = (msg.toolArgs || "").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
    return html`
        <div class="message tool ${outOfContextClass}">
            <div class="bubble-tool">
                <!-- <div class="role-header role-tool">
                    <span class="role-label">${warningIcon}Tool</span>
                </div> -->
                <collama-accordion
                    type="tool"
                    label="${toolLabel}"
                    s
                    code="${escapedArgs}"
                    copyCode="${escapedArgs}"
                ></collama-accordion>
            </div>
        </div>
    `;
}
