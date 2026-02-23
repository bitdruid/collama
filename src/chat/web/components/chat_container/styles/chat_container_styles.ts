import {css} from "lit";

export const chatContainerStyles=
 
         css`
                :host {
                    display: flex;
                    flex-direction: column;
                    height: 100%;
                }
        
                collama-chatsessions {
                    flex: 0 0 auto;
                }
        
                .chat-area {
                    flex: 1 1 auto;
                    display: flex;
                    flex-direction: column;
                    min-height: 0;
                }
        
                collama-chatoutput {
                    flex: 1 1 auto;
                    overflow-y: auto;
                    height: 100%;
                    margin-top: 12px;
                    padding: 0px;
                }
        
                collama-chatinput {
                    flex: 0 0 auto;
                    display: flex;
                    flex-direction: column;
                    margin-top: 12px;
                    padding: 8px;
                }
        
                .toast {
                    position: fixed;
                    bottom: 80px;
                    left: 50%;
                    transform: translateX(-50%);
                    background: var(--vscode-editorWidget-background, #1e1e1e);
                    border: 1px solid var(--vscode-editorWidget-border, #454545);
                    color: var(--vscode-editorWidget-foreground, #ccc);
                    padding: 6px 14px;
                    border-radius: 6px;
                    font-size: 12px;
                    opacity: 0;
                    transition: opacity 0.3s;
                    pointer-events: none;
                    z-index: 100;
                }
        
                .toast.visible {
                    opacity: 1;
                }
            `;
    

