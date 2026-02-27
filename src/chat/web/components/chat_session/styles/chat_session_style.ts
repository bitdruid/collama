import { css } from "lit";

export const chatSessionStyle = css`
  :host {
    position: relative;
  }

  .popup-overlay {
    display: none;
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    z-index: 1000;
  }

  .popup-overlay.open {
    display: block;
  }
`;
