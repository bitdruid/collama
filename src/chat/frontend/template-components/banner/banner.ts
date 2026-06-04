import { html, LitElement, type TemplateResult } from "lit";
import { customElement, property } from "lit/decorators.js";

import { themeIcons } from "../../styles";
import { bannerStyles } from "./styles";

export type BannerType = "tool" | "think" | "summary" | "code" | "context" | "tool-group" | "info" | "banner";

type BannerVariant = "box" | "bare";

interface BannerSpec {
    /** Fallback heading shown when no `label` is provided. */
    heading: string;
    /** Optional leading icon (box variant only). */
    icon: TemplateResult | null;
    /** `box` = bordered header (code/info); `bare` = flat text + colored chevron. */
    variant: BannerVariant;
}

/** Per-type header defaults. The single source of truth for banner types. */
const BANNERS: Record<BannerType, BannerSpec> = {
    code: { heading: "", icon: themeIcons.code.medium, variant: "box" },
    info: { heading: "", icon: null, variant: "box" },
    tool: { heading: "Tool", icon: null, variant: "bare" },
    think: { heading: "Thinking", icon: null, variant: "bare" },
    summary: { heading: "Summary", icon: null, variant: "bare" },
    "tool-group": { heading: "Tools", icon: null, variant: "bare" },
    context: { heading: "Context", icon: null, variant: "bare" },
    banner: { heading: "", icon: null, variant: "bare" },
};

/**
 * Header for accordions and standalone banners.
 *
 * Appearance is driven entirely by `type` (see BANNERS): `code`/`info` render a
 * bordered box, every other type renders as bare text with a colored chevron.
 * When `collapsible` is set the header shows a chevron that rotates with
 * `expanded` to signal open/closed state.
 *
 * @element collama-banner
 * @slot actions - Trailing controls, e.g. a copy button.
 */
@customElement("collama-banner")
export class Banner extends LitElement {
    static override styles = bannerStyles;

    @property({ type: String }) type: BannerType = "banner";
    @property({ type: String }) label = "";
    @property({ type: String }) description = "";
    @property({ type: Boolean }) expanded = false;
    @property({ type: Boolean }) collapsible = false;

    override render() {
        const spec = BANNERS[this.type];
        const label = this.label || spec.heading;

        const labelTpl = html`
            <span class="banner-label">
                ${label}${this.description ? html`<span class="banner-description">${this.description}</span>` : ""}
            </span>
        `;
        const actions = html`<span class="banner-actions"><slot name="actions"></slot></span>`;
        const chevron = this.collapsible
            ? html`<span class="banner-arrow ${this.expanded ? "expanded" : ""}">${themeIcons.chevronDown.large}</span>`
            : null;

        // Code/info: bordered box with an optional leading icon, chevron trailing.
        if (spec.variant === "box") {
            const icon = spec.icon ? html`<span class="banner-icon">${spec.icon}</span>` : null;
            return html`
                <div class="banner type-${this.type}">${icon} ${labelTpl} ${actions} ${chevron}</div>
            `;
        }

        // Everything else: bare text with the chevron leading in its type color.
        return html`
            <div class="banner bare type-${this.type}">
                <span class="banner-pill">${chevron}</span>
                ${labelTpl} ${actions}
            </div>
        `;
    }
}
