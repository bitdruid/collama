import { html, LitElement, type TemplateResult } from "lit";
import { customElement, property } from "lit/decorators.js";

import { icons } from "../../../styles/theme-icons";
import { bannerStyles } from "./styles";

export type BannerType = "tool" | "think" | "summary" | "code" | "context" | "tool-group" | "info" | "banner";

/**
 * Base banner component with protected properties for inheritance.
 * Subclasses define icon and heading.
 */
@customElement("collama-banner")
export class Banner extends LitElement {
    static override styles = bannerStyles;

    @property({ type: String }) label = "";
    @property({ type: String }) description = "";
    @property({ type: String }) type: BannerType = "banner";

    /** Override in subclasses */
    protected icon: TemplateResult | null = null;
    protected heading = "";

    protected get hasIcon() {
        return Boolean(this.icon);
    }

    protected get displayIcon() {
        return this.icon ?? html``;
    }

    override render() {
        const label = this.label || this.heading;

        return html`
            <div class="banner type-${this.type}">
                ${this.hasIcon ? html`<span class="banner-icon">${this.displayIcon}</span>` : null}
                <span class="banner-label">
                    ${label}${this.description ? html`<span class="banner-description">${this.description}</span>` : ""}
                </span>
                <span class="banner-slot1"><slot name="slot1"></slot></span>
                <span class="banner-slot2"><slot name="slot2"></slot></span>
            </div>
        `;
    }
}

@customElement("collama-tool-banner")
export class ToolBanner extends Banner {
    override type: BannerType = "tool";
    protected override icon = icons.tool;
    protected override heading = "Tool";
}

@customElement("collama-think-banner")
export class ThinkBanner extends Banner {
    override type: BannerType = "think";
    protected override icon = icons.thinking;
    protected override heading = "Thinking";
}

@customElement("collama-summary-banner")
export class SummaryBanner extends Banner {
    override type: BannerType = "summary";
    protected override icon = icons.summary;
    protected override heading = "Summary";
}

@customElement("collama-code-banner")
export class CodeBanner extends Banner {
    override type: BannerType = "code";
    protected override icon = icons.code;
    protected override heading = "";
}

@customElement("collama-context-banner")
export class ContextBanner extends Banner {
    override type: BannerType = "context";
    protected override icon = icons.paperclip;
    protected override heading = "Context";
}

@customElement("collama-tool-group-banner")
export class ToolGroupBanner extends Banner {
    override type: BannerType = "tool-group";
    protected override icon = icons.tool;
    protected override heading = "Tools";
}

@customElement("collama-info-banner")
export class InfoBanner extends Banner {
    override type: BannerType = "info";
    protected override icon = icons.lesson;
    protected override heading = "Info";
}
