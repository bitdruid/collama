import { LitElement } from "lit";
import { property, state } from "lit/decorators.js";
import { DismissalController } from "../controllers/dismissal-controller";

export abstract class BaseOverlay extends LitElement {
    @state() protected _open = false;
    @state() protected _visible = false;
    @property({ type: Boolean }) closeOnOutsideClick = true;
    @property({ type: Boolean }) closeOnEscape = true;
    @property({ type: Boolean }) autoShow = false;

    protected closeEventName = "overlay-close";

    private _dismissalController: DismissalController;

    constructor() {
        super();
        this._dismissalController = new DismissalController(this, {
            closeOnOutsideClick: this.closeOnOutsideClick,
            closeOnEscape: this.closeOnEscape,
            onDismiss: () => this.close(),
            onDocumentClick: (e: MouseEvent) => this._onDocumentClick(e),
        });
    }

    show() {
        this._open = true;
        requestAnimationFrame(() => {
            this._visible = true;
        });
        this._dismissalController.setOptions({
            closeOnOutsideClick: this.closeOnOutsideClick,
            closeOnEscape: this.closeOnEscape,
        });
    }

    close() {
        if (!this._open) {
            return;
        }
        this._visible = false;
        this._dismissalController.delayedClose(() => {
            this._open = false;
            this.dispatchEvent(new CustomEvent(this.closeEventName, { bubbles: true, composed: true }));
        }, 200);
    }

    toggle() {
        if (this._open) {
            this.close();
            return;
        }
        this.show();
    }

    override firstUpdated(changedProperties: Map<PropertyKey, unknown>) {
        super.firstUpdated(changedProperties);
        if (this.autoShow) {
            this.show();
        }
    }

    private _onDocumentClick(e: MouseEvent) {
        if (!this._open) {
            return;
        }
        const path = e.composedPath();
        if (path.some((el) => el instanceof Element && el.hasAttribute("data-base-overlay-anchor"))) {
            this.close();
            return;
        }
        if (this.closeOnOutsideClick && !path.includes(this)) {
            this.close();
        }
    }
}
