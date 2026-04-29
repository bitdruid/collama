import { LitElement, html } from "lit";
import { customElement, property } from "lit/decorators.js";
import { icons } from "../../../../styles/theme-icons";
import { settingsButtonStyles } from "./styles";

@customElement("collama-settings-button")
export class SettingsButton extends LitElement {
    static styles = [settingsButtonStyles];

    @property({ type: Boolean }) disabled = false;
    @property({ type: Boolean }) expanded = false;
    @property({ type: Boolean }) showBadge = false;

    render() {
        return html`
            <button
                class="settings-button ${this.expanded ? "expanded" : ""}"
                title="Settings"
                ?disabled=${this.disabled}
                data-base-overlay-anchor
                @click=${this._handleClick}
            >
                <span class="settings-icon">${icons.settings}</span>
                ${this.showBadge ? html`<span class="button-badge">!</span>` : ""}
                <span class="toggle-icon">${icons.chevronDown}</span>
            </button>
        `;
    }

    private _handleClick() {
        if (this.disabled) {
            return;
        }
        this.dispatchEvent(new CustomEvent("toggle-settings-dropdown", { bubbles: true, composed: true }));
    }
}
