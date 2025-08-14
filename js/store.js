// This module manages all application data using IndexedDB.
export default class Store {
    constructor(dbName = 'NotPitDB') {
        this.dbName = dbName;
        this.db = null;
    }

    /**
     * Opens and initializes the IndexedDB database.
     * @private
     */
    async _openDB() {
        if (this.db) {
            return Promise.resolve(this.db);
        }

        return new Promise((resolve, reject) => {
            const request = indexedDB.open(this.dbName, 2);

            request.onupgradeneeded = event => {
                const db = event.target.result;
                const oldVersion = event.oldVersion;
                const transaction = event.target.transaction;

                if (oldVersion < 2) {
                    // --- Create New Schema ---
                    const stores = [
                        { name: 'meetings', keyPath: 'id', autoIncrement: true },
                        { name: 'participants', keyPath: 'id', autoIncrement: true },
                        { name: 'agendaItems', keyPath: 'id', autoIncrement: true },
                        { name: 'noteBlocks', keyPath: 'id', autoIncrement: true },
                        { name: 'tasks', keyPath: 'id', autoIncrement: true },
                        { name: 'agreements', keyPath: 'id', autoIncrement: true },
                        { name: 'decisions', keyPath: 'id', autoIncrement: true },
                    ];
                    stores.forEach(s => {
                        if (!db.objectStoreNames.contains(s.name)) {
                            db.createObjectStore(s.name, { keyPath: s.keyPath, autoIncrement: s.autoIncrement });
                        }
                    });

                    const taskStore = transaction.objectStore('tasks');
                    taskStore.createIndex('by_meeting', 'originMeetingId', { unique: false });
                    const agendaItemStore = transaction.objectStore('agendaItems');
                    agendaItemStore.createIndex('by_meeting', 'meetingId', { unique: false });
                    const noteBlockStore = transaction.objectStore('noteBlocks');
                    noteBlockStore.createIndex('by_meeting', 'meetingId', { unique: false });

                    // --- Data Migration from v1 'notes' store ---
                    if (transaction.objectStoreNames.contains('notes')) {
                        const oldNotesStore = transaction.objectStore('notes');
                        const newMeetingsStore = transaction.objectStore('meetings');
                        const newNoteBlocksStore = transaction.objectStore('noteBlocks');

                        oldNotesStore.openCursor().onsuccess = cursorEvent => {
                            const cursor = cursorEvent.target.result;
                            if (cursor) {
                                const oldNote = cursor.value;
                                const newMeetingData = {
                                    título: oldNote.title,
                                    fechaInicio: new Date(oldNote.date).toISOString(),
                                    fechaFin: new Date(oldNote.date).toISOString(),
                                    timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
                                    ubicación: '', virtualLink: '', etiquetas: [], participantes: [],
                                    agenda: [], tareas: [], acuerdos: [], decisiones: [],
                                    adjuntos: oldNote.attachments || [],
                                    createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
                                    hashChainHead: null
                                };

                                const addMeetingRequest = newMeetingsStore.add(newMeetingData);
                                addMeetingRequest.onsuccess = (addEvent) => {
                                    const newMeetingId = addEvent.target.result;
                                    const fieldsToMigrateAsNoteBlocks = [
                                        { type: 'agenda', content: oldNote.agenda },
                                        { type: 'notes', content: oldNote.notes },
                                        { type: 'agreements', content: oldNote.agreements },
                                        { type: 'decisions', content: oldNote.decisions },
                                        { type: 'tasks', content: oldNote.tasks }
                                    ];

                                    fieldsToMigrateAsNoteBlocks.forEach(field => {
                                        if (field.content && field.content.trim() !== '') {
                                            newNoteBlocksStore.add({
                                                meetingId: newMeetingId,
                                                tipo: field.type,
                                                contenido: field.content
                                            });
                                        }
                                    });
                                };
                                cursor.continue();
                            } else {
                                console.log("Data migration from v1 to v2 complete.");
                                db.deleteObjectStore('notes');
                                console.log("Old 'notes' object store deleted.");
                            }
                        };
                    }
                }
            };

            request.onsuccess = event => {
                this.db = event.target.result;
                resolve(this.db);
            };
            request.onerror = event => reject(`Database error: ${event.target.errorCode}`);
        });
    }

    async _transact(storeName, mode, action) {
        const db = await this._openDB();
        return new Promise((resolve, reject) => {
            const transaction = db.transaction(storeName, mode);
            const store = transaction.objectStore(storeName);
            action(store, resolve, reject);
            transaction.onerror = event => reject(`Transaction error: ${event.target.errorCode}`);
        });
    }

    // --- Meeting Methods ---
    async getAllMeetings() {
        return this._transact('meetings', 'readonly', (store, resolve) => {
            store.getAll().onsuccess = e => resolve(e.target.result);
        });
    }

    async getMeeting(id) {
        return this._transact('meetings', 'readonly', (store, resolve) => {
            store.get(id).onsuccess = e => resolve(e.target.result);
        });
    }

    async saveMeeting(meeting) {
        meeting.updatedAt = new Date().toISOString();
        if (!meeting.id) meeting.createdAt = new Date().toISOString();
        return this._transact('meetings', 'readwrite', (store, resolve) => {
            store.put(meeting).onsuccess = e => resolve(e.target.result);
        });
    }

    async deleteMeeting(id) {
        return this._transact('meetings', 'readwrite', (store, resolve) => {
            store.delete(id).onsuccess = () => resolve();
        });
    }

    // --- NoteBlock Methods ---
    async getNoteBlocksForMeeting(meetingId) {
        return this._transact('noteBlocks', 'readonly', (store, resolve) => {
            const index = store.index('by_meeting');
            index.getAll(meetingId).onsuccess = e => resolve(e.target.result);
        });
    }

    async saveNoteBlock(noteBlock) {
        return this._transact('noteBlocks', 'readwrite', (store, resolve) => {
            store.put(noteBlock).onsuccess = e => resolve(e.target.result);
        });
    }

    async deleteNoteBlock(id) {
        return this._transact('noteBlocks', 'readwrite', (store, resolve) => {
            store.delete(id).onsuccess = () => resolve();
        });
    }

    async saveAllNoteBlocks(noteBlocks) {
        const db = await this._openDB();
        return new Promise((resolve, reject) => {
            const transaction = db.transaction('noteBlocks', 'readwrite');
            const store = transaction.objectStore('noteBlocks');
            noteBlocks.forEach(nb => store.put(nb));
            transaction.oncomplete = () => resolve();
            transaction.onerror = e => reject(`Transaction error: ${e.target.errorCode}`);
        });
    }

    // --- Agenda Item Methods ---
    async getAgendaItemsForMeeting(meetingId) {
        return this._transact('agendaItems', 'readonly', (store, resolve) => {
            const index = store.index('by_meeting');
            index.getAll(meetingId).onsuccess = e => resolve(e.target.result);
        });
    }

    async saveAgendaItem(item) {
        return this._transact('agendaItems', 'readwrite', (store, resolve) => {
            store.put(item).onsuccess = e => resolve(e.target.result);
        });
    }

    async deleteAgendaItem(id) {
        return this._transact('agendaItems', 'readwrite', (store, resolve) => {
            store.delete(id).onsuccess = () => resolve();
        });
    }

    async saveAgendaOrder(items) {
        const db = await this._openDB();
        const transaction = db.transaction('agendaItems', 'readwrite');
        const store = transaction.objectStore('agendaItems');
        items.forEach(item => store.put(item));
        return new Promise((resolve, reject) => {
            transaction.oncomplete = () => resolve();
            transaction.onerror = e => reject(e);
        });
    }

    // --- Task Methods ---
    async getTasksForMeeting(meetingId) {
        return this._transact('tasks', 'readonly', (store, resolve) => {
            const index = store.index('by_meeting');
            index.getAll(meetingId).onsuccess = e => resolve(e.target.result);
        });
    }

    async saveTask(task) {
        return this._transact('tasks', 'readwrite', (store, resolve) => {
            store.put(task).onsuccess = e => resolve(e.target.result);
        });
    }

    async deleteTask(id) {
        return this._transact('tasks', 'readwrite', (store, resolve) => {
            store.delete(id).onsuccess = () => resolve();
        });
    }

    // ... other entity methods ...

    async exportWorkspace() {
        const db = await this._openDB();
        const exportableStores = ['meetings', 'participants', 'agendaItems', 'noteBlocks', 'tasks', 'agreements', 'decisions'];
        const workspace = {};

        return new Promise((resolve, reject) => {
            const transaction = db.transaction(exportableStores, 'readonly');
            transaction.onerror = e => reject(`Transaction error: ${e.target.errorCode}`);

            let completed = 0;
            exportableStores.forEach(storeName => {
                const store = transaction.objectStore(storeName);
                store.getAll().onsuccess = e => {
                    workspace[storeName] = e.target.result;
                    completed++;
                    if (completed === exportableStores.length) {
                        resolve(workspace);
                    }
                };
            });
        });
    }
}
