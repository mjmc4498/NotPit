// This module acts as the controller.
export default class Controller {
    constructor(store, view) {
        this.store = store;
        this.view = view;
        this.currentlyViewedNote = null; // This will hold meeting and note blocks

        // Bind view event handlers to controller methods
        this.view.bindAddOrUpdateMeeting(this.handleAddOrUpdateMeeting);
        this.view.bindCancelEdit(this.handleCancelEdit);
        this.view.bindNotesListEvents(this.handleViewMeeting, this.handleDeleteMeeting, this.handleShowSummary);
        this.view.bindAttachmentEvents(this.handleRemoveAttachment);
        this.view.bindImport(this.handleImport);
        this.view.bindExport(this.handleExport);
        this.view.bindSummaryModalEvents(this.handleCopySummary, this.handlePrintSummary);

        // Initial display
        this.showAllMeetings();
    }

    async showAllMeetings() {
        const meetings = await this.store.getAllMeetings();
        this.view.displayMeetings(meetings);
    }

    _readFileAsBase64(file) {
        return new Promise((resolve, reject) => {
            if (file.size > 2 * 1024 * 1024) {
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

    handleAddOrUpdateMeeting = async () => {
        this.view.setSaveButtonState(true);
        try {
            const { meetingData, noteBlocks } = this.view.getMeetingData();
            const newAttachments = this.view.getNewAttachments();

            const newlyReadAttachments = await Promise.all(newAttachments.map(this._readFileAsBase64));
            meetingData.adjuntos.push(...newlyReadAttachments);

            // Save the main meeting object first to get an ID
            const savedMeetingId = await this.store.saveMeeting(meetingData);

            // Now, associate and save the note blocks
            const finalNoteBlocks = noteBlocks.map(nb => ({
                ...nb,
                meetingId: savedMeetingId
            }));
            await this.store.saveNoteBlocks(finalNoteBlocks);

            this.view.resetForm();
            await this.showAllMeetings();
        } catch (error) {
            alert(`Error: ${error.message}`);
        } finally {
            this.view.setSaveButtonState(false);
        }
    }

    handleCancelEdit = () => {
        this.view.resetForm();
    }

    handleViewMeeting = async (id) => {
        const meeting = await this.store.getMeeting(id);
        const noteBlocks = await this.store.getNoteBlocksForMeeting(id);
        if (meeting) {
            this.view.populateForm(meeting, noteBlocks);
        }
    }

    handleDeleteMeeting = async (id) => {
        const meeting = await this.store.getMeeting(id);
        if (confirm(`Are you sure you want to delete the meeting "${meeting.título}"?`)) {
            await this.store.deleteMeeting(id);
            // In a real app, we'd also delete related note blocks, tasks, etc.
            if (Number(this.view.getEditingId()) === id) {
                this.view.resetForm();
            }
            await this.showAllMeetings();
        }
    }

    handleRemoveAttachment = () => {
        this.view.renderCurrentAttachments();
    }

    handleShowSummary = async (id) => {
        const meeting = await this.store.getMeeting(id);
        const noteBlocks = await this.store.getNoteBlocksForMeeting(id);
        this.currentlyViewedNote = { meeting, noteBlocks };
        if (meeting) {
            this.view.displaySummaryModal(meeting, noteBlocks);
        }
    }

    handleCopySummary = () => {
        if (!this.currentlyViewedNote) return;

        const { meeting, noteBlocks } = this.currentlyViewedNote;
        let plainTextSummary = `Meeting Minutes: ${meeting.título}\nDate: ${new Date(meeting.fechaInicio).toLocaleString()}\n\n`;

        noteBlocks.forEach(nb => {
            plainTextSummary += `--- ${nb.tipo.toUpperCase()} ---\n${nb.contenido}\n\n`;
        });

        if (meeting.adjuntos && meeting.adjuntos.length > 0) {
            plainTextSummary += '--- ATTACHMENTS ---\n' + meeting.adjuntos.map(f => f.filename).join('\n');
        }

        navigator.clipboard.writeText(plainTextSummary).then(() => {
            alert('Summary copied to clipboard!');
        }).catch(err => alert('Failed to copy summary.'));
    }

    handlePrintSummary = () => {
        // The view handles this.
    }

    handleExport = async () => {
        // This is now more complex. For now, just export the meetings table.
        alert("Exporting just the meetings list for now. A full export would require bundling all related data.");
        const meetings = await this.store.getAllMeetings();
        const dataStr = JSON.stringify(meetings, null, 2);
        const blob = new Blob([dataStr], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `notpit-meetings-backup-${new Date().toISOString().split('T')[0]}.json`;
        link.click();
        URL.revokeObjectURL(url);
    }

    handleImport = (file) => {
        alert("Import is disabled for this version due to the new data model complexity.");
        // The logic would need to parse a complex JSON and populate multiple stores.
    }
}
