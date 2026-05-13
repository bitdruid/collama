import { css, html } from "lit";
import { customElement, property } from "lit/decorators.js";
import { buildCreateAgentsMdDraftCommandUri, buildOpenFileCommandUri } from "../../../../utils-front";
import { themeIcons } from "../../../styles";
import { defaultChatConfig, type ChatConfig } from "../../../types";
import { BaseDropdown } from "../../template-components/dropdown/base-dropdown";
import { baseDropdownStyles } from "../../template-components/dropdown/styles";
import "../../template-components/slider";
import { settingsDropdownStyles } from "./styles";

const AGENTS_MD_PATH = "AGENTS.md";
type VerbosityMode = ChatConfig["verbosityMode"];
const VERBOSITY_MODES: readonly VerbosityMode[] = ["compact", "medium", "detailed"];

function emit(el: HTMLElement, name: string, detail?: unknown) {
    el.dispatchEvent(new CustomEvent(name, { detail, bubbles: true, composed: true }));
}

@customElement("collama-settings-dropdown")
export class SettingsDropdown extends BaseDropdown {
    static override styles = css`
        ${baseDropdownStyles}
        ${settingsDropdownStyles}
    `;

    @property({ type: Object }) config: ChatConfig = defaultChatConfig;
    @property({ type: Boolean }) snakeLoadingEnabled = false;
    @property({ type: Boolean }) snakeEyecandyMode = false;
    @property({ type: Boolean }) flatDesign = false;
    @property({ type: Boolean }) agentsMdActive = false;

    private _updateBoolean(key: "agentic" | "enableEditTools" | "enableShellTool", event: Event) {
        const value = Number((event.target as HTMLInputElement).value);
        emit(this, "settings-update", { key, value: value === 1 });
    }

    private _updateVerbosityMode = (event: Event) => {
        const index = Number((event.target as HTMLInputElement).value);
        const value = VERBOSITY_MODES[index] ?? "medium";
        emit(this, "settings-update", { key: "verbosityMode", value });
    };

    private _updateSnakeLoadingEnabled = (event: Event) => {
        const value = Number((event.target as HTMLInputElement).value) === 1;
        emit(this, "snake-loading-enabled-update", { value });
    };

    private _updateSnakeEyecandy = (event: Event) => {
        const value = Number((event.target as HTMLInputElement).value) === 1;
        emit(this, "snake-eyecandy-update", { value });
    };

    private _updateFlatDesign = (event: Event) => {
        const value = Number((event.target as HTMLInputElement).value) === 1;
        emit(this, "flat-design-update", { value });
    };

    protected override renderContent() {
        return html`
            <section class="settings-section">
                <h4>Extension</h4>
                ${this._renderToggle("Agentic-Mode", "agentic", this.config.agentic)}
                ${this._renderToggle(
                    "Edit Tools",
                    "enableEditTools",
                    this.config.enableEditTools,
                    this.config.agentic && !this.config.enableEditTools,
                )}
                ${this._renderToggle("Shell Tool", "enableShellTool", this.config.enableShellTool)}
                ${this._renderVerbosityMode()}
            </section>
            <section class="settings-section">
                <h4>Style</h4>
                ${this._renderStyleToggle("Flat Design", this.flatDesign, this._updateFlatDesign)}
                ${this._renderStyleToggle("Loading Snake", this.snakeLoadingEnabled, this._updateSnakeLoadingEnabled)}
                ${this._renderStyleToggle("Eyecandy-Mode", this.snakeEyecandyMode, this._updateSnakeEyecandy)}
            </section>
            <section class="settings-section">
                <h4>Project</h4>
                ${this._renderAgentsMdIndicator()}
            </section>
        `;
    }

    private _renderVerbosityMode() {
        const value = this.config.verbosityMode ?? "medium";
        const index = VERBOSITY_MODES.indexOf(value as VerbosityMode);

        return html`
            <collama-slider
                label="Agent Verbosity"
                value-label=${value}
                min="0"
                max="2"
                step="1"
                .value=${index < 0 ? 1 : index}
                marks="3"
                @input=${this._updateVerbosityMode}
            ></collama-slider>
        `;
    }

    private _renderAgentsMdIndicator() {
        if (this.agentsMdActive) {
            return html`
                <div class="setting-row info-row">
                    <span class="setting-title">AGENTS.md</span>
                    <a
                        class="agents-md-active"
                        href="${buildOpenFileCommandUri(AGENTS_MD_PATH)}"
                        title="${AGENTS_MD_PATH}"
                    >
                        <span class="agents-md-check">${themeIcons.check.medium}</span>
                        active
                    </a>
                </div>
            `;
        }
        return html`
            <div class="setting-row info-row">
                <span class="setting-title">AGENTS.md</span>
                <a
                    class="agents-md-create"
                    href="${buildCreateAgentsMdDraftCommandUri()}"
                    title="Create AGENTS.md draft"
                    >create</a
                >
            </div>
        `;
    }

    private _renderToggle(
        label: string,
        key: "agentic" | "enableEditTools" | "enableShellTool",
        checked: boolean,
        showWarning = false,
    ) {
        return html`
            <collama-slider
                label=${label}
                value-label=${checked ? "On" : "Off"}
                min="0"
                max="1"
                step="1"
                .value=${checked ? 1 : 0}
                marks="2"
                @input=${(event: Event) => this._updateBoolean(key, event)}
            >
                ${showWarning ? html`<span slot="prefix">${themeIcons.alertTriangle.medium}</span>` : ""}
            </collama-slider>
        `;
    }

    private _renderStyleToggle(label: string, checked: boolean, onChange: (event: Event) => void) {
        return html`
            <collama-slider
                label=${label}
                value-label=${checked ? "On" : "Off"}
                min="0"
                max="1"
                step="1"
                .value=${checked ? 1 : 0}
                marks="2"
                @input=${onChange}
            ></collama-slider>
        `;
    }
}
