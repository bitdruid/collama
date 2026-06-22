import { css, html } from "lit";
import { customElement, property } from "lit/decorators.js";
import { defaultChatSettings, type ChatSettings } from "../../../../../shared";
import { themeIcons } from "../../../../styles";
import { BaseDropdown } from "../../../../template-components/dropdown/base-dropdown";
import { baseDropdownStyles } from "../../../../template-components/dropdown/styles";
import "../../../../template-components/slider";
import { buildCreateAgentsMdDraftCommandUri, buildOpenFileCommandUri } from "../../../utils";
import { settingsDropdownStyles } from "./styles";

const AGENTS_MD_PATH = "AGENTS.md";
type VerbosityMode = ChatSettings["verbosityMode"];
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

    @property({ type: Object }) config: ChatSettings = defaultChatSettings;
    @property({ type: Boolean }) fancyTyping = false;
    @property({ type: Boolean }) flatDesign = false;
    @property({ type: Boolean }) showThinking = false;
    @property({ type: Boolean }) agentsMdActive = false;

    private _updateBoolean(key: "agenticMode" | "enableEditTools" | "enableShellTool" | "liteMode", event: Event) {
        const value = Number((event.target as HTMLInputElement).value);
        emit(this, "settings-update", { key, value: value === 1 });
    }

    private _updateVerbosityMode = (event: Event) => {
        const index = Number((event.target as HTMLInputElement).value);
        const value = VERBOSITY_MODES[index] ?? "medium";
        emit(this, "settings-update", { key: "verbosityMode", value });
    };

    private _updateFancyTyping = (event: Event) => {
        const value = Number((event.target as HTMLInputElement).value) === 1;
        emit(this, "fancy-typing-update", { value });
    };

    private _updateFlatDesign = (event: Event) => {
        const value = Number((event.target as HTMLInputElement).value) === 1;
        emit(this, "flat-design-update", { value });
    };

    private _updateShowThinking = (event: Event) => {
        const value = Number((event.target as HTMLInputElement).value) === 1;
        emit(this, "show-thinking-update", { value });
    };

    protected override renderContent() {
        return html`
            <section class="settings-section">
                <div class="settings-header">Extension</div>
                ${this._renderToggle("Agentic-Mode", "agenticMode", this.config.agenticMode, false, {
                    description: "Let the agent use tools.",
                })}
                ${this._renderToggle(
                    "Edit Tools",
                    "enableEditTools",
                    this.config.enableEditTools,
                    this.config.agenticMode && !this.config.enableEditTools,
                    {
                        description: "Allow the agent to write, create and delete files.",
                    },
                )}
                ${this._renderToggle(
                    "Shell Tool",
                    "enableShellTool",
                    this.config.enableShellTool,
                    this.config.agenticMode && !this.config.enableShellTool,
                    {
                        description: "Allow the agent to execute shell commands.",
                    },
                )}
                ${this._renderVerbosityMode()}
                ${this._renderToggle("Lite-Mode", "liteMode", this.config.liteMode, this.config.liteMode, {
                    description: "Use a minimal system prompt. May improve small models.",
                })}
            </section>
            <section class="settings-section">
                <div class="settings-header">Style</div>
                ${this._renderStyleToggle("Flat Design", this.flatDesign, this._updateFlatDesign)}
                ${this._renderStyleToggle("Fancy Typing", this.fancyTyping, this._updateFancyTyping)}
            </section>
            <section class="settings-section">
                <div class="settings-header">Agent</div>
                ${this._renderStyleToggle("Show Thinking", this.showThinking, this._updateShowThinking, {})}
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
                title="Controls how  detailed the answers are."
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
        key: "agenticMode" | "enableEditTools" | "enableShellTool" | "liteMode",
        checked: boolean,
        showWarning = false,
        opts: { description?: string } = {},
    ) {
        return html`
            <collama-slider
                label=${label}
                title=${opts.description ?? ""}
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

    private _renderStyleToggle(
        label: string,
        checked: boolean,
        onChange: (event: Event) => void,
        opts: { description?: string } = {},
    ) {
        return html`
            <collama-slider
                label=${label}
                title=${opts.description ?? ""}
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
