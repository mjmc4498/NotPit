// This module acts as the controller.
// It handles user interactions and orchestrates the view and the store.
export default class Controller {
    constructor(store, view) {
        this.store = store;
        this.view = view;
        this.currentlyViewedNote = null;

        // Bind view event handlers to controller methods
        this.view.bindAddOrUpdateNote(this.handleAddOrUpdateNote);
        this.view.bindCancelEdit(this.handleCancelEdit);
        this.view.bindNotesListEvents(this.handleViewNote, this.handleDeleteNote, this.handleShowSummary);
        this.view.bindAttachmentEvents(this.handleRemoveAttachment);
        this.view.bindImport(this.handleImport);
        this.view.bindExport(this.handleExport);
        this.view.bindSummaryModalEvents(this.handleCopySummary, this.handlePrintSummary);

        // Initial display
        this.showAllNotes();
    }

    async showAllNotes() {
        const notes = await this.store.getAllNotes();
        this.view.displayNotes(notes);
    }

    _readFileAsBase64(file) {
        return new Promise((resolve, reject) => {
            if (file.size > 2 * 1024 * 1024) { // 2MB limit
                return reject(new Error(`File ${file.name} is too large (max 2MB).`));
            }
            const reader = new FileReader();
            reader.onload = () => resolve({
                filename: file.name,
                filetype: file.type,
                data: reader.result
            });
            reader.onerror = (error) => reject(error);
            reader.readAsDataURL(file);
        });
    }

    handleAddOrUpdateNote = async () => {
        this.view.setSaveButtonState(true);
        try {
            const noteData = this.view.getNoteData();
            const newAttachments = this.view.getNewAttachments();

            const newlyReadAttachments = await Promise.all(newAttachments.map(this._readFileAsBase64));
            noteData.attachments.push(...newlyReadAttachments);

            if (noteData.id) {
                await this.store.updateNote(noteData);
            } else {
                await this.store.addNote(noteData);
            }
            this.view.resetForm();
            await this.showAllNotes();
        } catch (error) {
            alert(`Error: ${error.message}`);
        } finally {
            this.view.setSaveButtonState(false);
        }
    }

    handleCancelEdit = () => {
        this.view.resetForm();
    }

    handleViewNote = async (id) => {
        const notes = await this.store.getAllNotes();
        const note = notes.find(n => n.id === id);
        if (note) {
            this.view.populateForm(note);
        }
    }

    handleDeleteNote = async (id) => {
        const notes = await this.store.getAllNotes();
        const note = notes.find(n => n.id === id);
        if (confirm(`Are you sure you want to delete the note "${note.title}"?`)) {
            await this.store.deleteNote(id);
            if (Number(this.view.getEditingId()) === id) {
                this.view.resetForm();
            }
            await this.showAllNotes();
        }
    }

    handleRemoveAttachment = () => {
        this.view.renderCurrentAttachments();
    }

    handleShowSummary = async (id) => {
        const notes = await this.store.getAllNotes();
        this.currentlyViewedNote = notes.find(n => n.id === id);
        if (this.currentlyViewedNote) {
            this.view.displaySummaryModal(this.currentlyViewedNote);
        }
    }

    handleCopySummary = () => {
        if (!this.currentlyViewedNote) return;

        const note = this.currentlyViewedNote;
        const sections = [
            { title: 'Agenda', content: note.agenda },
            { title: 'Structured Notes', content: note.notes },
            { title: 'Agreements', content: note.agreements },
            { title: 'Decisions', content: note.decisions },
            { title: 'Tasks', content: note.tasks },
        ];

        let plainTextSummary = `Meeting Minutes: ${note.title}\nDate: ${note.date}\n\n` +
            sections.map(section => {
                if (!section.content) return '';
                return `--- ${section.title.toUpperCase()} ---\n${section.content}\n`;
            }).join('\n');

        if (note.attachments && note.attachments.length > 0) {
            plainTextSummary += '\n--- ATTACHMENTS ---\n' + note.attachments.map(f => f.filename).join('\n');
        }

        navigator.clipboard.writeText(plainTextSummary).then(() => {
            alert('Summary copied to clipboard!');
        }).catch(err => {
            console.error('Failed to copy text: ', err);
            alert('Failed to copy summary.');
        });
    }

    handlePrintSummary = () => {
        // The view handles the CSS classes and window.print() call.
        // This handler is here for completeness of the event binding.
    }

    handleExport = async () => {
        try {
            const notes = await this.store.getAllNotes();
            if (notes.length === 0) {
                alert('No notes to export.');
                return;
            }
            const dataStr = JSON.stringify(notes, null, 2);

            if (window.showSaveFilePicker) {
                // Modern File System Access API
                const handle = await window.showSaveFilePicker({
                    suggestedName: `notpit-backup-${new Date().toISOString().split('T')[0]}.json`,
                    types: [{
                        description: 'JSON Files',
                        accept: { 'application/json': ['.json'] },
                    }],
                });
                const writable = await handle.createWritable();
                await writable.write(dataStr);
                await writable.close();
                alert('Export successful!');
            } else {
                // Fallback method
                const blob = new Blob([dataStr], { type: 'application/json' });
                const url = URL.createObjectURL(blob);
                const link = document.createElement('a');
                link.href = url;
                link.download = `notpit-backup-${new Date().toISOString().split('T')[0]}.json`;
                link.click();
                URL.revokeObjectURL(url);
            }
        } catch (error) {
            // AbortError is thrown if the user cancels the file picker.
            if (error.name !== 'AbortError') {
                console.error('Export failed:', error);
                alert(`Export failed: ${error.message}`);
            }
        }
    }

    handleImport = (file) => {
        const reader = new FileReader();
        reader.onload = async (e) => {
            try {
                const importedNotes = JSON.parse(e.target.result);
                if (!Array.isArray(importedNotes)) {
                    throw new Error('Invalid format: Not an array.');
                }
                if (confirm('This will overwrite all current notes. Are you sure?')) {
                    await this.store.importNotes(importedNotes);
                    this.view.resetForm();
                    await this.showAllNotes();
                    alert('Notes imported successfully!');
                }
            } catch (error) {
                alert(`Error importing file: ${error.message}`);
            }
        };
        reader.readAsText(file);
    }
}
