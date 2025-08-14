// This module manages all application data using IndexedDB.
import { sha256, encrypt, decrypt } from './crypto.js';

export default class Store {
    constructor(dbName = 'NotPitDB') {
        this.dbName = dbName;
        this.db = null;
        this.encryptionKey = null; // Will hold the AES-GCM key for the session
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
            const request = indexedDB.open(this.dbName, 6); // Version 6 for Encryption

            request.onupgradeneeded = event => {
                const db = event.target.result;
                const oldVersion = event.oldVersion;
                const transaction = event.target.transaction;

                if (oldVersion < 6) {
                    db.createObjectStore('app_metadata', { keyPath: 'key' });
                }

                if (oldVersion < 5) {
                    const agreementsStore = db.createObjectStore('agreements', { keyPath: 'id', autoIncrement: true });
                    agreementsStore.createIndex('by_meeting', 'meetingId', { unique: false });

                    const decisionsStore = db.createObjectStore('decisions', { keyPath: 'id', autoIncrement: true });
                    decisionsStore.createIndex('by_meeting', 'meetingId', { unique: false });
                }


                if (oldVersion < 2) {
                    // This block is for migrating very old schemas.
                    // The main object stores are now created in their respective version blocks.
                    const stores = [
                        { name: 'meetings', keyPath: 'id', autoIncrement: true },
                        { name: 'participants', keyPath: 'id', autoIncrement: true },
                        { name: 'agendaItems', keyPath: 'id', autoIncrement: true },
                        { name: 'noteBlocks', keyPath: 'id', autoIncrement: true },
                        { name: 'tasks', keyPath: 'id', autoIncrement: true },
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
                }

                if (oldVersion < 3) {
                    const templateStore = db.createObjectStore('templates', { keyPath: 'id', autoIncrement: true });
                    const defaultTemplates = [
                        { name: '1-on-1', agenda_titles: ['Catch up & Personal', 'Feedback & Blockers', 'Goals & Priorities', 'Action Items'] },
                        { name: 'Daily Stand-up', agenda_titles: ['What did you do yesterday?', 'What will you do today?', 'Any blockers?'] },
                        { name: 'Sprint Review', agenda_titles: ['Sprint Goal Recap', 'Demo of Completed Work', 'Stakeholder Feedback', 'Next Sprint Planning'] },
                        { name: 'Incident RCA', agenda_titles: ['Incident Summary', 'Timeline of Events', 'Root Cause Analysis', 'Impact Assessment', 'Corrective Actions'] }
                    ];
                    defaultTemplates.forEach(template => templateStore.add(template));
                }

                if (oldVersion < 4) {
                    const eventStore = db.createObjectStore('events', { keyPath: 'id', autoIncrement: true });
                    eventStore.createIndex('by_meeting', 'meetingId', { unique: false });
                }


                // --- Data Migration from v1 'notes' store ---
                if (oldVersion < 2) {
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

    // --- Encryption and Metadata Methods ---
    setEncryptionKey(key) {
        this.encryptionKey = key;
    }

    async getMetadata(key) {
        return this._transact('app_metadata', 'readonly', (store, resolve) => {
            store.get(key).onsuccess = e => resolve(e.target.result ? e.target.result.value : undefined);
        });
    }

    async setMetadata(key, value) {
        const item = { key, value };
        return this._transact('app_metadata', 'readwrite', (store, resolve) => {
            store.put(item).onsuccess = e => resolve(e.target.result);
        });
    }

    // --- Meeting Methods ---
    async _encryptItem(item) {
        if (!this.encryptionKey) return item;
        const encryptedData = await encrypt(this.encryptionKey, item);
        // Preserve the ID for lookups, and other indexed fields
        const payload = { id: item.id, data: encryptedData };
        if (item.meetingId) payload.meetingId = item.meetingId;
        if (item.originMeetingId) payload.originMeetingId = item.originMeetingId;

        if (!payload.id) delete payload.id; // Allow auto-increment for new items
        return payload;
    }

    async _decryptItem(item) {
        if (!this.encryptionKey || !item.data) return item;
        try {
            return await decrypt(this.encryptionKey, item.data);
        } catch (e) {
            console.error(`Failed to decrypt item #${item.id}`, e);
            return { ...item, error: 'Decryption Failed' }; // Return item with error flag
        }
    }

    async getAllMeetings() {
        return this._transact('meetings', 'readonly', (store, resolve) => {
            store.getAll().onsuccess = async (e) => {
                const results = e.target.result;
                const decryptedResults = await Promise.all(results.map(r => this._decryptItem(r)));
                resolve(decryptedResults);
            };
        });
    }

    async getMeeting(id) {
        return this._transact('meetings', 'readonly', (store, resolve) => {
            store.get(id).onsuccess = async (e) => {
                const result = e.target.result;
                resolve(await this._decryptItem(result));
            };
        });
    }

    async saveMeeting(meeting) {
        meeting.updatedAt = new Date().toISOString();
        if (!meeting.id) meeting.createdAt = new Date().toISOString();

        const payload = await this._encryptItem(meeting);

        return this._transact('meetings', 'readwrite', (store, resolve) => {
            store.put(payload).onsuccess = e => resolve(e.target.result);
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
            index.getAll(meetingId).onsuccess = async (e) => {
                const results = e.target.result;
                const decryptedResults = await Promise.all(results.map(r => this._decryptItem(r)));
                resolve(decryptedResults);
            };
        });
    }

    async saveNoteBlock(noteBlock) {
        const payload = await this._encryptItem(noteBlock);
        return this._transact('noteBlocks', 'readwrite', (store, resolve) => {
            store.put(payload).onsuccess = e => resolve(e.target.result);
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
            index.getAll(meetingId).onsuccess = async (e) => {
                const results = e.target.result;
                const decryptedResults = await Promise.all(results.map(r => this._decryptItem(r)));
                resolve(decryptedResults);
            };
        });
    }

    async saveAgendaItem(item) {
        const payload = await this._encryptItem(item);
        return this._transact('agendaItems', 'readwrite', (store, resolve) => {
            store.put(payload).onsuccess = e => resolve(e.target.result);
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
            index.getAll(meetingId).onsuccess = async (e) => {
                const results = e.target.result;
                const decryptedResults = await Promise.all(results.map(r => this._decryptItem(r)));
                resolve(decryptedResults);
            };
        });
    }

    async saveTask(task) {
        const payload = await this._encryptItem(task);
        return this._transact('tasks', 'readwrite', (store, resolve) => {
            store.put(payload).onsuccess = e => resolve(e.target.result);
        });
    }

    async deleteTask(id) {
        return this._transact('tasks', 'readwrite', (store, resolve) => {
            store.delete(id).onsuccess = () => resolve();
        });
    }

    // --- Agreement Methods ---
    async getAgreementsForMeeting(meetingId) {
        return this._transact('agreements', 'readonly', (store, resolve) => {
            const index = store.index('by_meeting');
            index.getAll(meetingId).onsuccess = async (e) => {
                const results = e.target.result;
                const decryptedResults = await Promise.all(results.map(r => this._decryptItem(r)));
                resolve(decryptedResults);
            };
        });
    }

    async saveAgreement(agreement) {
        const payload = await this._encryptItem(agreement);
        return this._transact('agreements', 'readwrite', (store, resolve) => {
            store.put(payload).onsuccess = e => resolve(e.target.result);
        });
    }

    async getAgreement(id) {
        return this._transact('agreements', 'readonly', (store, resolve) => {
            store.get(id).onsuccess = e => resolve(e.target.result);
        });
    }

    async deleteAgreement(id) {
        return this._transact('agreements', 'readwrite', (store, resolve) => {
            store.delete(id).onsuccess = () => resolve();
        });
    }

    // --- Decision Methods ---
    async getDecisionsForMeeting(meetingId) {
        return this._transact('decisions', 'readonly', (store, resolve) => {
            const index = store.index('by_meeting');
            index.getAll(meetingId).onsuccess = async (e) => {
                const results = e.target.result;
                const decryptedResults = await Promise.all(results.map(r => this._decryptItem(r)));
                resolve(decryptedResults);
            };
        });
    }

    async saveDecision(decisionData) {
        const db = await this._openDB();
        const tx = db.transaction(['decisions', 'meetings'], 'readwrite');
        const decisionsStore = tx.objectStore('decisions');
        const meetingsStore = tx.objectStore('meetings');

        return new Promise(async (resolve, reject) => {
            tx.onerror = event => reject(event.target.error);
            tx.oncomplete = () => resolve();

            // 1. Find the last decision to get the previous hash
            const cursorReq = decisionsStore.index('by_meeting').openCursor(decisionData.meetingId, 'prev');
            let lastDecision = null;
            cursorReq.onsuccess = async (event) => {
                lastDecision = event.target.result ? event.target.result.value : null;

                // 2. Prepare the new decision object
                const newDecision = { ...decisionData };
                newDecision.hashPrev = lastDecision ? lastDecision.hashSelf : null;

                const timestamp = new Date().toISOString();
                const canonicalString = `${newDecision.statement}|${newDecision.resultado}|${timestamp}|${newDecision.hashPrev}`;

                newDecision.hashSelf = await sha256(canonicalString);
                newDecision.timestamp = timestamp; // Add timestamp for reproducibility

                // 3. Encrypt and Save the new decision
                const payload = await this._encryptItem(newDecision);
                const addReq = decisionsStore.add(payload);
                addReq.onsuccess = (addEvent) => {
                    const newDecisionId = addEvent.target.result;

                    // 4. Update the meeting's hashChainHead
                    const getMeetingReq = meetingsStore.get(decisionData.meetingId);
                    getMeetingReq.onsuccess = (getEvent) => {
                        const meeting = getEvent.target.result;
                        if (meeting) {
                            meeting.hashChainHead = newDecision.hashSelf;
                            meetingsStore.put(meeting); // This will resolve the transaction
                        } else {
                            tx.abort();
                            reject(new Error(`Meeting with id ${decisionData.meetingId} not found.`));
                        }
                    };
                };
            };
        });
    }

    async deleteDecision(id) {
        return this._transact('decisions', 'readwrite', (store, resolve) => {
            store.delete(id).onsuccess = () => resolve();
        });
    }

    // --- Event Methods ---
    async logEvent(eventData) {
        const event = {
            ...eventData,
            timestamp: new Date().toISOString()
        };
        return this._transact('events', 'readwrite', (store, resolve) => {
            store.add(event).onsuccess = e => resolve(e.target.result);
        });
    }

    async getEventsForMeeting(meetingId) {
        return this._transact('events', 'readonly', (store, resolve) => {
            const index = store.index('by_meeting');
            index.getAll(meetingId).onsuccess = e => resolve(e.target.result);
        });
    }

    async getTemplates() {
        return this._transact('templates', 'readonly', (store, resolve) => {
            store.getAll().onsuccess = e => resolve(e.target.result);
        });
    }

    async exportWorkspace() {
        const db = await this._openDB();
        const exportableStores = ['meetings', 'participants', 'agendaItems', 'noteBlocks', 'tasks', 'agreements', 'decisions', 'templates', 'events'];
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

    async importData(data) {
        const db = await this._openDB();
        const isWorkspace = data.meetings && Array.isArray(data.meetings);
        const isSingleMeeting = data.meeting && typeof data.meeting === 'object';

        if (isWorkspace) {
            // Full workspace import
            const storeNames = Object.keys(data);
            const transaction = db.transaction(storeNames, 'readwrite');
            transaction.onerror = e => Promise.reject(e);

            const clearPromises = storeNames.map(name => {
                return new Promise((resolve, reject) => {
                    const store = transaction.objectStore(name);
                    store.clear().onsuccess = resolve;
                });
            });

            await Promise.all(clearPromises);

            const addPromises = storeNames.flatMap(name =>
                data[name].map(item =>
                    new Promise((resolve, reject) => {
                        // We don't want to keep the old primary key
                        delete item.id;
                        transaction.objectStore(name).add(item).onsuccess = resolve;
                    })
                )
            );
            await Promise.all(addPromises);

        } else if (isSingleMeeting) {
            // Single meeting import
            const storeNames = ['meetings', 'agendaItems', 'noteBlocks', 'tasks']; // and others if they exist
            const transaction = db.transaction(storeNames, 'readwrite');
            transaction.onerror = e => Promise.reject(e);

            return new Promise((resolve, reject) => {
                const meetingData = data.meeting;
                const oldMeetingId = meetingData.id;
                delete meetingData.id; // Let IndexedDB generate a new ID

                const addMeetingReq = transaction.objectStore('meetings').add(meetingData);

                addMeetingReq.onsuccess = (event) => {
                    const newMeetingId = event.target.result;
                    const itemPromises = [];

                    // Helper to add items and update their meeting ID
                    const addItems = (storeName, items) => {
                        if (data[storeName] && Array.isArray(data[storeName])) {
                            data[storeName].forEach(item => {
                                delete item.id;
                                // This is the crucial part: update the foreign key
                                if (item.meetingId !== undefined) item.meetingId = newMeetingId;
                                if (item.originMeetingId !== undefined) item.originMeetingId = newMeetingId;

                                itemPromises.push(new Promise(res => {
                                    transaction.objectStore(storeName).add(item).onsuccess = res;
                                }));
                            });
                        }
                    };

                    addItems('agendaItems', data.agendaItems);
                    addItems('noteBlocks', data.noteBlocks);
                    addItems('tasks', data.tasks);
                    // ... add other entities like agreements, decisions if they are in the export

                    Promise.all(itemPromises).then(resolve).catch(reject);
                };
                addMeetingReq.onerror = reject;
            });
        } else {
            return Promise.reject(new Error("Invalid import data format."));
        }
    }

    async verifyDecisionChain(meetingId) {
        const meeting = await this.getMeeting(meetingId);
        const decisions = await this.getDecisionsForMeeting(meetingId);

        if (!decisions || decisions.length === 0) {
            return meeting.hashChainHead === null; // Valid if no decisions and no head
        }

        // Sort decisions chronologically
        decisions.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));

        let lastHash = null;
        for (const decision of decisions) {
            // Check if the chain is broken
            if (decision.hashPrev !== lastHash) {
                return false;
            }
            // Recalculate the hash of the current decision
            const canonicalString = `${decision.statement}|${decision.resultado}|${decision.timestamp}|${decision.hashPrev}`;
            const recalculatedHash = await sha256(canonicalString);

            if (recalculatedHash !== decision.hashSelf) {
                return false; // Tampered data
            }
            lastHash = recalculatedHash;
        }

        // Finally, check the head of the chain
        return lastHash === meeting.hashChainHead;
    }

    async encryptAllData() {
        if (!this.encryptionKey) throw new Error("Encryption key not set.");

        const storesToEncrypt = ['meetings', 'agendaItems', 'noteBlocks', 'tasks', 'agreements', 'decisions', 'events', 'templates'];
        const db = await this._openDB();
        const tx = db.transaction(storesToEncrypt, 'readwrite');

        return new Promise((resolve, reject) => {
            tx.oncomplete = resolve;
            tx.onerror = () => reject(tx.error);

            storesToEncrypt.forEach(storeName => {
                const store = tx.objectStore(storeName);
                store.openCursor().onsuccess = (e) => {
                    const cursor = e.target.result;
                    if (cursor) {
                        const item = cursor.value;
                        // a primitive check to avoid re-encrypting
                        if (typeof item.data !== 'string') {
                            this._encryptItem(item).then(payload => {
                                cursor.update(payload);
                            });
                        }
                        cursor.continue();
                    }
                };
            });
        });
    }
}
