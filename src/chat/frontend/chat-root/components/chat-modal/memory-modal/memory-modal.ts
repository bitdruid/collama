import { html, TemplateResult } from "lit";
import { customElement, property, query, state } from "lit/decorators.js";

import type { MemoryScope, MemoryViewEntry } from "../../../../../shared";
import { themeIcons } from "../../../../styles";
import "../../../../template-components/button-box";
import "../../../../template-components/button-row";
import { BaseModal } from "../../../../template-components/modal/base-modal";
import "../../../../template-components/text-box";
import { memoryModalStyles } from "./styles";

const SCOPE_LABELS: Record<MemoryScope, string> = {
    global: "Global",
    workspace: "Workspace",
};

@customElement("collama-memory-modal")
export class MemoryModal extends BaseModal {
    static override styles = [...BaseModal.styles, memoryModalStyles];

    @property({ type: Array }) entries: MemoryViewEntry[] = [];

    @state() private _expanded = new Set<string>();
    @state() private _showAddForm = false;
    @state() private _addKey = "";
    @state() private _addShort = "";
    @state() private _addLong = "";
    @state() private _editingEntry: MemoryViewEntry | null = null;

    @query(".add-key-input")
    private addKeyInput!: HTMLElement;

    constructor() {
        super();
        this.title = "Memory";
    }

    private _entryId(entry: MemoryViewEntry): string {
        return `${entry.scope}:${entry.key}`;
    }

    private _toggle(entry: MemoryViewEntry) {
        const id = this._entryId(entry);
        const next = new Set(this._expanded);
        if (next.has(id)) {
            next.delete(id);
        } else {
            next.add(id);
        }
        this._expanded = next;
    }

    private _delete(entry: MemoryViewEntry, e: Event) {
        e.stopPropagation();
        this.dispatchEvent(
            new CustomEvent("memory-delete-request", {
                detail: { key: entry.key, scope: entry.scope },
                bubbles: true,
                composed: true,
            }),
        );
    }

    private _edit(entry: MemoryViewEntry, e: Event) {
        e.stopPropagation();
        this._editingEntry = entry;
        this._addKey = entry.key;
        this._addShort = entry.short;
        this._addLong = entry.long ?? "";
        this._showAddForm = true;
        this.updateComplete.then(() => this.addKeyInput?.focus());
    }

    private _openAddForm() {
        this._editingEntry = null;
        this._addKey = "";
        this._addShort = "";
        this._addLong = "";
        this._showAddForm = true;
        this.updateComplete.then(() => this.addKeyInput?.focus());
    }

    private _closeAddForm() {
        this._showAddForm = false;
        this._editingEntry = null;
    }

    private _onAddKeyInput(e: CustomEvent<{ value: string }>) {
        this._addKey = e.detail.value;
    }

    private _onAddShortInput(e: CustomEvent<{ value: string }>) {
        this._addShort = e.detail.value;
    }

    private _onAddLongInput(e: CustomEvent<{ value: string }>) {
        this._addLong = e.detail.value;
    }

    private _saveAdd() {
        const key = this._addKey.trim();
        const short = this._addShort.trim();
        const long = this._addLong.trim();
        if (!key || !short) {
            return;
        }
        if (this._editingEntry) {
            this.dispatchEvent(
                new CustomEvent("memory-edit-request", {
                    detail: { oldKey: this._editingEntry.key, key, short, long, scope: this._editingEntry.scope },
                    bubbles: true,
                    composed: true,
                }),
            );
        } else {
            this.dispatchEvent(
                new CustomEvent("memory-add-request", {
                    detail: { key, short, long, scope: "global" as const },
                    bubbles: true,
                    composed: true,
                }),
            );
        }
        this._closeAddForm();
    }

    protected override renderContent(): TemplateResult {
        const scopes: MemoryScope[] = ["global", "workspace"];
        return html`
            <div class="memory-body">
                ${this.entries.length === 0
                    ? html`<div class="memory-empty">No memories stored yet.</div>`
                    : scopes.map((scope) => this._renderGroup(scope))}
                ${this._renderAddForm()}
            </div>
            <collama-button-row>
                ${this._showAddForm
                    ? html`
                          <collama-accept-button
                              title="Save"
                              ?disabled=${!this._addKey.trim() || !this._addShort.trim()}
                              @action=${this._saveAdd}
                          ></collama-accept-button>
                          <collama-cancel-button title="Cancel" @action=${this._closeAddForm}></collama-cancel-button>
                      `
                    : html`
                          <collama-add-button @action=${this._openAddForm}></collama-add-button>
                          <collama-cancel-button title="Cancel" @action=${this.close}></collama-cancel-button>
                      `}
            </collama-button-row>
        `;
    }

    private _renderAddForm(): TemplateResult {
        if (!this._showAddForm) {
            return html``;
        }
        return html`
            <div class="memory-add-form">
                <collama-textbox
                    class="add-key-input"
                    mode="input"
                    placeholder="Key (required)"
                    .value=${this._addKey}
                    @textbox-input=${this._onAddKeyInput}
                    @textbox-submit=${this._saveAdd}
                ></collama-textbox>
                <collama-textbox
                    mode="input"
                    placeholder="Short summary (required)"
                    .value=${this._addShort}
                    @textbox-input=${this._onAddShortInput}
                    @textbox-submit=${this._saveAdd}
                ></collama-textbox>
                <collama-textbox
                    mode="input"
                    placeholder="Long description (optional)"
                    .value=${this._addLong}
                    @textbox-input=${this._onAddLongInput}
                    @textbox-submit=${this._saveAdd}
                ></collama-textbox>
            </div>
        `;
    }

    private _renderGroup(scope: MemoryScope): TemplateResult {
        const entries = this.entries.filter((e) => e.scope === scope);
        if (entries.length === 0) {
            return html``;
        }
        return html`
            <div class="memory-group">
                <div class="memory-group-header">${SCOPE_LABELS[scope]} · ${entries.length}</div>
                ${entries.map((entry) => this._renderEntry(entry))}
            </div>
        `;
    }

    private _renderEntry(entry: MemoryViewEntry): TemplateResult {
        const expanded = this._expanded.has(this._entryId(entry));
        return html`
            <div class="memory-entry ${expanded ? "expanded" : ""}">
                <div class="memory-entry-row" @click=${() => this._toggle(entry)}>
                    <span class="memory-chevron">${themeIcons.chevronDown.small}</span>
                    <div class="memory-entry-text">
                        <div class="memory-key">${entry.key}</div>
                        <div class="memory-short">${entry.short}</div>
                    </div>
                    <span class="memory-actions">
                        <span
                            class="memory-action memory-edit"
                            title="Edit"
                            @click=${(e: Event) => this._edit(entry, e)}
                        >
                            ${themeIcons.pencil.medium}
                        </span>
                        <span
                            class="memory-action memory-delete"
                            title="Delete"
                            @click=${(e: Event) => this._delete(entry, e)}
                        >
                            ${themeIcons.trash.medium}
                        </span>
                    </span>
                </div>
                ${expanded ? html`<div class="memory-long">${entry.long}</div>` : ""}
            </div>
        `;
    }
}
