import Controller from './controller.js';
import Store from './store.js';
import View from './view.js';
import { t } from './i18n.js';

function translateUI() {
    document.querySelectorAll('[data-i18n-key]').forEach(el => {
        el.textContent = t(el.dataset.i18nKey);
    });
    document.querySelectorAll('[data-i18n-placeholder-key]').forEach(el => {
        el.placeholder = t(el.dataset.i18nPlaceholderKey);
    });
    document.title = t('app_title');
}

// Translate the static UI on initial load
translateUI();

// Initialize the application by creating the three main components.
// The controller will wire up the view and the store.
const app = new Controller(new Store(), new View(t), t);

// Register the service worker
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js')
      .then(registration => {
        console.log('Service Worker registered: ', registration);
      })
      .catch(registrationError => {
        console.log('Service Worker registration failed: ', registrationError);
      });
  });
}
