import { css } from "lit";

export const chatSessionStyle = css`
  .popup-overlay {
    display: none;
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    z-index: 99;
  }

  .popup-overlay.open {
    display: block;
  }
`;
