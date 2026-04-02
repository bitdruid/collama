import type { ReactiveController, ReactiveControllerHost } from "lit";

/**
 * Controller that handles dismissal of a component via:
 * - Click outside the component (with optional custom handler)
 * - Escape key press
 */
export class DismissalController implements ReactiveController {
    host: ReactiveControllerHost;

    private _handleDocumentClick: ((e: MouseEvent) => void) | null = null;
    private _handleKeyDown: ((e: KeyboardEvent) => void) | null = null;
    private _closeOnOutsideClick: boolean;
    private _closeOnEscape: boolean;
    private _onDismiss: () => void;
    private _onDocumentClick?: (e: MouseEvent) => void;

    constructor(
        host: ReactiveControllerHost,
        options: {
            closeOnOutsideClick?: boolean;
            closeOnEscape?: boolean;
            onDismiss: () => void;
            onDocumentClick?: (e: MouseEvent) => void;
        },
    ) {
        this.host = host;
        this._closeOnOutsideClick = options.closeOnOutsideClick ?? true;
        this._closeOnEscape = options.closeOnEscape ?? true;
        this._onDismiss = options.onDismiss;
        this._onDocumentClick = options.onDocumentClick;
        host.addController(this);
    }

    /**
     * Update dismissal options
     */
    setOptions(options: {
        closeOnOutsideClick?: boolean;
        closeOnEscape?: boolean;
        onDismiss?: () => void;
        onDocumentClick?: (e: MouseEvent) => void;
    }) {
        if (options.closeOnOutsideClick !== undefined) {
            this._closeOnOutsideClick = options.closeOnOutsideClick;
        }
        if (options.closeOnEscape !== undefined) {
            this._closeOnEscape = options.closeOnEscape;
        }
        if (options.onDismiss !== undefined) {
            this._onDismiss = options.onDismiss;
        }
        if (options.onDocumentClick !== undefined) {
            this._onDocumentClick = options.onDocumentClick;
        }
    }

    hostConnected() {
        if (this._closeOnOutsideClick) {
            this._handleDocumentClick = (e: MouseEvent) => this._onDocumentClickHandler(e);
            document.addEventListener("click", this._handleDocumentClick, { capture: true });
        }
        if (this._closeOnEscape) {
            this._handleKeyDown = (e: KeyboardEvent) => this._onKeyDown(e);
            document.addEventListener("keydown", this._handleKeyDown);
        }
    }

    hostDisconnected() {
        if (this._handleDocumentClick) {
            document.removeEventListener("click", this._handleDocumentClick, { capture: true });
            this._handleDocumentClick = null;
        }
        if (this._handleKeyDown) {
            document.removeEventListener("keydown", this._handleKeyDown);
            this._handleKeyDown = null;
        }
    }

    private _onDocumentClickHandler(e: MouseEvent) {
        if (!this._closeOnOutsideClick) {
            return;
        }

        // Use custom handler if provided, otherwise use default behavior
        if (this._onDocumentClick) {
            this._onDocumentClick(e);
        } else {
            const path = e.composedPath();
            if (!path.includes(this.host as unknown as Element)) {
                this._onDismiss();
            }
        }
    }

    private _onKeyDown(e: KeyboardEvent) {
        if (!this._closeOnEscape) {
            return;
        }

        if (e.key === "Escape") {
            this._onDismiss();
        }
    }
}
