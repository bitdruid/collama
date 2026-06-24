import { unsafeSVG } from "lit/directives/unsafe-svg.js";
import { html } from "lit/static-html.js";
import {
    AlertTriangle,
    BetweenHorizontalStart,
    Check,
    CheckCheck,
    ChevronDown,
    CircleCheckBig,
    Code,
    Copy,
    CornerDownLeft,
    createElement,
    Download,
    FileText,
    Folder,
    GalleryHorizontalEnd,
    History,
    MessageCircleDashed,
    Minimize2,
    Paperclip,
    Pencil,
    Plus,
    Send,
    Settings,
    Trash2,
    Upload,
    X,
} from "lucide";

const icon = (Icon: any) => ({
    small: html`${unsafeSVG(createElement(Icon, { width: 12, height: 12 }).outerHTML)}`,
    medium: html`${unsafeSVG(createElement(Icon, { width: 14, height: 14 }).outerHTML)}`,
    large: html`${unsafeSVG(createElement(Icon, { width: 18, height: 18 }).outerHTML)}`,
});

/** Filled dot. */
const dotIcon = {
    small: html`<svg width="12" height="12" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg">
        <circle cx="6" cy="6" r="2.5" fill="currentColor" />
    </svg>`,
    medium: html`<svg width="14" height="14" viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg">
        <circle cx="7" cy="7" r="3" fill="currentColor" />
    </svg>`,
    large: html`<svg width="18" height="18" viewBox="0 0 18 18" fill="none" xmlns="http://www.w3.org/2000/svg">
        <circle cx="9" cy="9" r="4" fill="currentColor" />
    </svg>`,
};

export const themeIcons = {
    alertTriangle: icon(AlertTriangle),
    betweenHorizontalStart: icon(BetweenHorizontalStart),
    check: icon(Check),
    checkCheck: icon(CheckCheck),
    chevronDown: icon(ChevronDown),
    circleCheckBig: icon(CircleCheckBig),
    code: icon(Code),
    compress: icon(Minimize2),
    copy: icon(Copy),
    download: icon(Download),
    dot: dotIcon,
    enter: icon(CornerDownLeft),
    fileText: icon(FileText),
    folder: icon(Folder),
    gallery: icon(GalleryHorizontalEnd),
    ghostChat: icon(MessageCircleDashed),
    history: icon(History),
    paperclip: icon(Paperclip),
    pencil: icon(Pencil),
    plus: icon(Plus),
    send: icon(Send),
    settings: icon(Settings),
    trash: icon(Trash2),
    upload: icon(Upload),
    x: icon(X),
} as const;
