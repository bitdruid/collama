import { html } from "lit";
import { customElement, property } from "lit/decorators.js";
import { icons } from "../../../../utils-front";
import { defaultChatConfig, type ChatConfig } from "../../../types";
import { BaseModal } from "../../template-components/modal/base-modal";
import { settingsModalStyles } from "./styles";

const DEFAULT_SNAKE_LOADING_SPEED = 1800;

@customElement("collama-settings-modal")
export class SettingsModal extends BaseModal {
    static styles = [...BaseModal.styles, settingsModalStyles];

    @property({ type: Object }) config: ChatConfig = defaultChatConfig;
    @property({ type: Number }) snakeLoadingSpeed = DEFAULT_SNAKE_LOADING_SPEED;
    @property({ type: Boolean }) snakeEyecandyMode = false;

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
            </section>
            <section class="settings-section">
                <h4>Style</h4>
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
                    ${showWarning ? html`<span class="setting-warning">${icons.alertTriangle}</span>` : ""}
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
