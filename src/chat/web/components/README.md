# Chat Components - Neue Struktur

## 📁 Ordnerstruktur

```
src/chat/web/components/
├── shared/                      # Gemeinsame Ressourcen
│   └── styles/
│       └── common_styles.ts     # Wiederverwendbare CSS-Klassen
├── chat_accordion/              # Accordion Component
├── chat_container/              # Container Component
├── chat_input/                  # Input Components
│   ├── components/              # Sub-Components
│   │   ├── input_area/          # Textarea Component
│   │   ├── input_buttons/       # Button Component
│   │   └── input_panel/         # Panel Component
│   ├── chat_input.ts            # Haupt-Component
│   └── styles.ts                # Haupt-Styles
├── chat_output/                 # Output Components
│   ├── components/              # Sub-Components
│   ├── output.ts                # Haupt-Component
│   └── styles.ts                # Haupt-Styles
└── chat_session/                # Session Components
    ├── components/              # Sub-Components
    │   ├── header/              # Header Component
    │   ├── popup/               # Popup Components
    │   └── shared/              # Gemeinsame Components
    ├── chat_sessions.ts         # Haupt-Component
    ├── styles.ts                # Haupt-Styles
    ├── services/                # Services
    └── utils/                   # Utilities
```

## 🎯 Design-Prinzipien

### 1. **Konsistente Struktur**
- Jede Component hat ihre eigene `styles.ts` Datei
- Sub-Components sind in `components/` Unterordnern organisiert
- Gemeinsame Styles sind in `shared/styles/common_styles.ts`

### 2. **Style-Import-Pattern**
```typescript
import { LitElement, html } from "lit";
import { customElement, property } from "lit/decorators.js";
import { commonStyles } from "../../../shared/styles/common_styles";
import { componentStyles } from "./styles";

@customElement("my-component")
export class MyComponent extends LitElement {
  static styles = [commonStyles, componentStyles];
  // ...
}
```

### 3. **Benennungskonventionen**
- Components: `kebab-case` (z.B. `chat_session_header.ts`)
- Style-Exports: `camelCase` + `Styles` (z.B. `headerStyles`)
- CSS-Klassen: `kebab-case` (z.B. `.session-header`)

## 🔄 Migrationsanleitung

### Alte Struktur → Neue Struktur

#### Chat Session Header
```typescript
// ALT
import { headerCss } from "../styles/header_style";

// NEU
import { headerStyles } from "./styles";
static styles = [commonStyles, headerStyles];
```

#### Chat Session Popup
```typescript
// ALT
import { popupCss } from "../styles/popup_style";
import { sessionItemCss } from "../styles/session_item_style";

// NEU
import { popupStyles, sessionItemStyles } from "./styles";
static styles = [commonStyles, popupStyles];
```

#### Chat Input Components
```typescript
// ALT
import { chatInputStyles } from "./styles/chat_input_styles";

// NEU
import { inputAreaStyles } from "./components/input_area/styles";
import { inputButtonsStyles } from "./components/input_buttons/styles";
import { inputPanelStyles } from "./components/input_panel/styles";
```

## 📋 Vorteile der neuen Struktur

1. **Bessere Übersichtlichkeit**: Jede Component hat ihre eigene Style-Datei
2. **Wiederverwendbarkeit**: Gemeinsame Styles in `common_styles.ts`
3. **Skalierbarkeit**: Einfach neue Sub-Components hinzuzufügen
4. **Konsistenz**: Einheitliches Pattern über alle Components
5. **Wartbarkeit**: Einfacher zu finden und zu aktualisieren

## 🚀 Nächste Schritte

1. [ ] Alte Dateien löschen (nach Migration)
2. [ ] Import-Pfade in allen Components aktualisieren
3. [ ] Tests anpassen
4. [ ] Dokumentation aktualisieren

## 📝 Beispiele

### Neue Component erstellen
```typescript
// my_component/my_component.ts
import { LitElement, html } from "lit";
import { customElement } from "lit/decorators.js";
import { commonStyles } from "../../shared/styles/common_styles";
import { myComponentStyles } from "./styles";

@customElement("my-component")
export class MyComponent extends LitElement {
  static styles = [commonStyles, myComponentStyles];

  render() {
    return html`<div class="my-component">Content</div>`;
  }
}
```

```typescript
// my_component/styles.ts
import { css } from "lit";

export const myComponentStyles = css`
  .my-component {
    padding: 12px;
    background: var(--vscode-editor-background);
  }
`;
```
