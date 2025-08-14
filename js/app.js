import Controller from './controller.js';
import Store from './store.js';
import View from './view.js';
import { t, setLanguage } from './i18n.js';
import { deriveKey } from './crypto.js';

class App {
    constructor() {
        this.store = new Store();
        this.view = new View(t);
    }

    async start() {
        // First, translate the static parts of the UI
        this.translateUI();

        // Then, check if the workspace is encrypted
        const isEncrypted = await this.store.getMetadata('encryption_enabled');

        if (isEncrypted) {
            this.view.showLockedState(true);
            this.view.bindUnlock(this.handleUnlock);
        } else {
            this.initializeApp();
        }
    }

    handleUnlock = async (password) => {
        try {
            const saltHex = await this.store.getMetadata('encryption_salt');
            if (!saltHex) throw new Error("Encryption salt not found.");

            const salt = new Uint8Array(saltHex.match(/.{1,2}/g).map(byte => parseInt(byte, 16)));

            const key = await deriveKey(password, salt);
            this.store.setEncryptionKey(key);

            // To verify the password is correct, we try to decrypt a "canary" value.
            const canary = await this.store.getMetadata('encryption_canary');
            if (!canary) {
                // If the canary doesn't exist, this might be the first unlock.
                // In a real app, we'd handle this more gracefully. For now, we proceed.
                 console.warn("Encryption canary not found. Assuming first unlock or old version.");
            } else {
                const decryptedCanary = await decrypt(key, canary);
                if (decryptedCanary.test !== 'ok') {
                    throw new Error("Canary decryption failed. Invalid password.");
                }
            }

            this.view.showLockedState(false);
            this.initializeApp();

        } catch (error) {
            console.error("Unlock failed:", error);
            this.view.showToast("Unlock failed. Please check your password.", 'danger');
            this.store.setEncryptionKey(null); // Clear any potentially bad key
        }
    }

    initializeApp() {
        this.controller = new Controller(this.store, this.view, t);

        // Register the service worker
        if ('serviceWorker' in navigator) {
            navigator.serviceWorker.register('/sw.js').then(registration => {
                console.log('Service Worker registered with scope:', registration.scope);
            }).catch(error => {
                console.log('Service Worker registration failed:', error);
            });
        }
    }

    translateUI() {
        document.querySelectorAll('[data-i18n-key]').forEach(el => {
            el.textContent = t(el.dataset.i18nKey);
        });
        document.querySelectorAll('[data-i18n-placeholder-key]').forEach(el => {
            el.placeholder = t(el.dataset.i18nPlaceholderKey);
        });
        document.title = t('app_title');
    }
}

// Wait for the DOM to be fully loaded before starting the app
window.addEventListener('DOMContentLoaded', () => {
    const app = new App();
    app.start();
});
