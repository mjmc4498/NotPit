// This module will manage all application data using IndexedDB.
export default class Store {
    constructor(dbName = 'NotPitDB', storeName = 'notes') {
        this.dbName = dbName;
        this.storeName = storeName;
    }

    /**
     * Opens and initializes the IndexedDB database.
     * @private
     * @returns {Promise<IDBDatabase>} A promise that resolves with the database object.
     */
    _openDB() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(this.dbName, 1);

            request.onupgradeneeded = event => {
                const db = event.target.result;
                if (!db.objectStoreNames.contains(this.storeName)) {
                    db.createObjectStore(this.storeName, { keyPath: 'id', autoIncrement: true });
                }
            };

            request.onsuccess = event => resolve(event.target.result);
            request.onerror = event => reject(`Database error: ${event.target.errorCode}`);
        });
    }

    /**
     * Retrieves all notes from the database.
     * @returns {Promise<Array>} A promise that resolves with an array of note objects.
     */
    async getAllNotes() {
        const db = await this._openDB();
        return new Promise((resolve, reject) => {
            const transaction = db.transaction(this.storeName, 'readonly');
            const store = transaction.objectStore(this.storeName);
            const request = store.getAll();

            request.onsuccess = () => resolve(request.result);
            request.onerror = (event) => reject(`Error fetching notes: ${event.target.errorCode}`);
        });
    }

    /**
     * Adds a new note to the database.
     * @param {object} note The note object to add. The 'id' property will be ignored.
     * @returns {Promise<number>} A promise that resolves with the new note's ID.
     */
    async addNote(note) {
        const db = await this._openDB();
        // The 'id' is managed by IndexedDB, so we ensure it's not part of the object we add.
        delete note.id;
        return new Promise((resolve, reject) => {
            const transaction = db.transaction(this.storeName, 'readwrite');
            const store = transaction.objectStore(this.storeName);
            const request = store.add(note);

            request.onsuccess = () => resolve(request.result);
            request.onerror = (event) => reject(`Error adding note: ${event.target.errorCode}`);
        });
    }

    /**
     * Updates an existing note in the database.
     * @param {object} note The note object to update. It must contain an 'id'.
     * @returns {Promise<number>} A promise that resolves with the updated note's ID.
     */
    async updateNote(note) {
        const db = await this._openDB();
        return new Promise((resolve, reject) => {
            const transaction = db.transaction(this.storeName, 'readwrite');
            const store = transaction.objectStore(this.storeName);
            const request = store.put(note);

            request.onsuccess = () => resolve(request.result);
            request.onerror = (event) => reject(`Error updating note: ${event.target.errorCode}`);
        });
    }

    /**
     * Deletes a note from the database by its ID.
     * @param {number} id The ID of the note to delete.
     * @returns {Promise<void>} A promise that resolves when the deletion is complete.
     */
    async deleteNote(id) {
        const db = await this._openDB();
        return new Promise((resolve, reject) => {
            const transaction = db.transaction(this.storeName, 'readwrite');
            const store = transaction.objectStore(this.storeName);
            const request = store.delete(id);

            request.onsuccess = () => resolve();
            request.onerror = (event) => reject(`Error deleting note: ${event.target.errorCode}`);
        });
    }

    /**
     * Imports an array of notes, overwriting any existing data.
     * @param {Array<object>} notes The array of notes to import.
     * @returns {Promise<void>} A promise that resolves when the import is complete.
     */
    async importNotes(notes) {
        const db = await this._openDB();
        return new Promise((resolve, reject) => {
            const transaction = db.transaction(this.storeName, 'readwrite');
            const store = transaction.objectStore(this.storeName);

            // Clear existing data
            const clearRequest = store.clear();

            clearRequest.onerror = (event) => reject(`Error clearing store: ${event.target.errorCode}`);

            clearRequest.onsuccess = () => {
                // Add new data
                notes.forEach(note => {
                    // Ensure notes from import don't conflict with autoincrement keys if they have an 'id'
                    delete note.id;
                    store.add(note);
                });
            };

            transaction.oncomplete = () => resolve();
            transaction.onerror = (event) => reject(`Import transaction failed: ${event.target.errorCode}`);
        });
    }
}
