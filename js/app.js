import Controller from './controller.js';
import Store from './store.js';
import View from './view.js';

// Initialize the application by creating the three main components.
// The controller will wire up the view and the store.
const app = new Controller(new Store(), new View());

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
