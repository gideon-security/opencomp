import { browser } from 'wxt/browser';
import { setupAuthFlowWatcher } from '../lib/background/auth';
import { setupContentScriptAutoInjection } from '../lib/background/content-script-injection';
import { handleBackgroundRequest } from '../lib/background/handlers';
import { parseBackgroundRequest } from '../lib/messaging';

export default defineBackground(() => {
  setupAuthFlowWatcher();
  setupContentScriptAutoInjection();
  browser.runtime.onMessage.addListener((message, sender, sendResponse) => {
    const request = parseBackgroundRequest(message);
    if (!request) return false;

    void handleBackgroundRequest({
      request,
      senderTabId: sender.tab?.id ?? null,
    })
      .then((response) => sendResponse(response))
      .catch((error: unknown) => {
        sendResponse({
          ok: false,
          error: error instanceof Error ? error.message : 'Unexpected error',
        });
      });

    return true;
  });
});
