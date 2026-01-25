import {LitElement, html, css} from 'lit';
import {customElement} from 'lit/decorators.js';

@customElement('chatwindow')
export class ChatWindow extends LitElement {
  static styles = css`
    :host {
      display: block;
      width: 100%;
      height: 100%;
    }
    .container {
      display: flex;
      flex-direction: column;
      align-items: center;
      width: 100%;
      height: 100%;
    }
  `;

  render() {
    return html`<div class="container"><slot></slot></div>`;
  }
}