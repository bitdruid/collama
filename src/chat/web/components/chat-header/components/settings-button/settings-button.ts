import { LitElement, html } from "lit";
import { customElement, property } from "lit/decorators.js";
import { themeIcons } from "../../../../styles";
import { settingsButtonStyles } from "./styles";

@customElement("collama-settings-button")
export class SettingsButton extends LitElement {
    static styles = [settingsButtonStyles];

    @property({ type: Boolean }) disabled = false;
    @property({ type: Boolean }) showBadge = false;

    render() {
        return html`
            <button
                class="settings-button"
                title="Settings"
                ?disabled=${this.disabled}
                data-base-overlay-anchor
                @click=${this._handleClick}
            >
                <span class="settings-icon">${themeIcons.settings.large}</span>
                ${this.showBadge ? html`<span class="button-badge">!</span>` : ""}
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
