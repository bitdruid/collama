import { html } from "lit";
import { customElement, property } from "lit/decorators.js";
import { buildCreateAgentsMdDraftCommandUri, buildOpenFileCommandUri, icons } from "../../../../utils-front";
import { defaultChatConfig, type ChatConfig } from "../../../types";
import { BaseModal } from "../../template-components/modal/base-modal";
import { settingsModalStyles } from "./styles";

const DEFAULT_SNAKE_LOADING_SPEED = 1800;
const AGENTS_MD_PATH = "AGENTS.md";
const VERBOSITY_MODES = ["compact", "medium", "detailed"] as const;
type VerbosityMode = (typeof VERBOSITY_MODES)[number];

@customElement("collama-settings-modal")
export class SettingsModal extends BaseModal {
    static styles = [...BaseModal.styles, settingsModalStyles];

    @property({ type: Object }) config: ChatConfig = defaultChatConfig;
    @property({ type: Number }) snakeLoadingSpeed = DEFAULT_SNAKE_LOADING_SPEED;
    @property({ type: Boolean }) snakeEyecandyMode = false;
    @property({ type: Boolean }) flatDesign = false;
    @property({ type: Boolean }) agentsMdActive = false;

    constructor() {
        super();
        this.title = "Settings";
    }

    private updateBoolean(key: "agentic" | "enableEditTools" | "enableShellTool", event: Event) {
        this.dispatchEvent(
            new CustomEvent("settings-update", {
                detail: { key, value: (event.target as HTMLInputElement).checked },
                bubbles: true,
                composed: true,
            }),
        );
    }

    private updateVerbosityMode = (event: Event) => {
        const index = Number((event.target as HTMLInputElement).value);
        const value = VERBOSITY_MODES[index] ?? "medium";

        this.dispatchEvent(
            new CustomEvent("settings-update", {
                detail: { key: "verbosityMode", value },
                bubbles: true,
                composed: true,
            }),
        );
    };

    private updateSnakeSpeed = (event: Event) => {
        this.dispatchEvent(
            new CustomEvent("snake-speed-update", {
                detail: { value: Number((event.target as HTMLInputElement).value) },
                bubbles: true,
                composed: true,
            }),
        );
    };

    private updateSnakeEyecandy = (event: Event) => {
        this.dispatchEvent(
            new CustomEvent("snake-eyecandy-update", {
                detail: { value: (event.target as HTMLInputElement).checked },
                bubbles: true,
                composed: true,
            }),
        );
    };

    private updateFlatDesign = (event: Event) => {
        this.dispatchEvent(
            new CustomEvent("flat-design-update", {
                detail: { value: (event.target as HTMLInputElement).checked },
                bubbles: true,
                composed: true,
            }),
        );
    };

    protected renderContent() {
        return html`
            <section class="settings-section">
                <h4>Extension</h4>
                ${this.renderToggle("Agentic-Mode", "agentic", this.config.agentic)}
                ${this.renderToggle(
                    "Edit Tools",
                    "enableEditTools",
                    this.config.enableEditTools,
                    this.config.agentic && !this.config.enableEditTools,
                )}
                ${this.renderToggle(
                    "Shell Tool (Only testing; npm & python)",
                    "enableShellTool",
                    this.config.enableShellTool,
                )}
                ${this.renderVerbosityMode()}
            </section>
            <section class="settings-section">
                <h4>Style</h4>
                ${this.renderStyleToggle("Flat Design", this.flatDesign, this.updateFlatDesign)}
                ${this.renderStyleToggle("Eyecandy-Mode", this.snakeEyecandyMode, this.updateSnakeEyecandy)}
                <div class="setting-row slider-row">
                    <div class="slider-heading">
                        <span class="setting-title"
                            >Snake loading animation speed <em>(default ${DEFAULT_SNAKE_LOADING_SPEED})</em></span
                        >
                        <span class="setting-value">${this.snakeLoadingSpeed} px/s</span>
                    </div>
                    <input
                        type="range"
                        min="500"
                        max="5000"
                        step="100"
                        .value=${String(this.snakeLoadingSpeed)}
                        @input=${this.updateSnakeSpeed}
                    />
                </div>
            </section>
            <section class="settings-section">
                <h4>Project</h4>
                ${this.renderAgentsMdIndicator()}
            </section>
        `;
    }

    private renderVerbosityMode() {
        const value = this.config.verbosityMode ?? "medium";
        const index = VERBOSITY_MODES.indexOf(value as VerbosityMode);

        return html`
            <div class="setting-row slider-row">
                <div class="slider-heading">
                    <span class="setting-title">Verbosity</span>
                    <span class="setting-value">${value}</span>
                </div>
                <input
                    type="range"
                    min="0"
                    max="2"
                    step="1"
                    .value=${String(index < 0 ? 1 : index)}
                    @input=${this.updateVerbosityMode}
                    aria-label="Verbosity"
                />
                <div class="slider-labels" aria-hidden="true">
                    <span>Compact</span>
                    <span>Medium</span>
                    <span>Detailed</span>
                </div>
            </div>
        `;
    }

    private renderAgentsMdIndicator() {
        if (this.agentsMdActive) {
            return html`
                <div class="setting-row info-row">
                    <span class="setting-title">AGENTS.md</span>
                    <a
                        class="agents-md-active"
                        href="${buildOpenFileCommandUri(AGENTS_MD_PATH)}"
                        title="${AGENTS_MD_PATH}"
                    >
                        <span class="agents-md-check">${icons.check}</span>
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

    private renderToggle(
        label: string,
        key: "agentic" | "enableEditTools" | "enableShellTool",
        checked: boolean,
        showWarning = false,
    ) {
        return html`
            <label class="setting-row toggle">
                <span class="setting-text">
                    ${showWarning ? html`<span class="setting-danger">${icons.alertTriangle}</span>` : ""}
                    <span class="setting-title">${label}</span>
                </span>
                <input
                    class="switch-input"
                    type="checkbox"
                    .checked=${checked}
                    @change=${(e: Event) => this.updateBoolean(key, e)}
                />
                <span class="switch" aria-hidden="true"></span>
            </label>
        `;
    }

    private renderStyleToggle(label: string, checked: boolean, onChange: (event: Event) => void) {
        return html`
            <label class="setting-row toggle">
                <span class="setting-text">
                    <span class="setting-title">${label}</span>
                </span>
                <input class="switch-input" type="checkbox" .checked=${checked} @change=${onChange} />
                <span class="switch" aria-hidden="true"></span>
            </label>
        `;
    }
}
