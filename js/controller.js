// This module acts as the controller for the new layout.
export default class Controller {
    constructor(store, view) {
        this.store = store;
        this.view = view;
        this.activeMeetingId = null;

        // Bind view event handlers to controller methods
        this.view.bindSelectMeeting(this.handleSelectMeeting);
        this.view.bindNewMeeting(this.handleNewMeeting);
        this.view.bindAddAgendaItem(this.handleAddAgendaItem);
        this.view.bindDeleteAgendaItem(this.handleDeleteAgendaItem);
        this.view.bindDragAndDropAgenda(this.handleUpdateAgendaOrder);
        this.view.bindNotesTabEvents(this.handleAddNoteBlock, this.handleSaveNoteBlock, this.handleDeleteNoteBlock);

        // Initial display
        this.showMeetingsInSidebar();
        this.view.showEmptyView();
    }

    /**
     * Fetches all meetings and displays them in the sidebar.
     */
    async showMeetingsInSidebar() {
        const meetings = await this.store.getAllMeetings();
        this.view.displayMeetingsInSidebar(meetings, this.activeMeetingId);
    }

    /**
     * Handles the selection of a meeting from the sidebar.
     * @param {number} id - The ID of the selected meeting.
     */
    handleSelectMeeting = async (id) => {
        if (this.activeMeetingId === id) return; // Do nothing if already selected

        this.activeMeetingId = id;

        // Re-render sidebar to highlight the new active item
        await this.showMeetingsInSidebar();

        const meeting = await this.store.getMeeting(id);
        if (meeting) {
            this.view.showMeetingDetailView(meeting);
            // Render content for all relevant tabs
            const agendaItems = await this.store.getAgendaItemsForMeeting(id);
            this.view.renderAgenda(agendaItems);
            const noteBlocks = await this.store.getNoteBlocksForMeeting(id);
            this.view.renderNotes(noteBlocks);
        } else {
            this.activeMeetingId = null;
            this.view.showEmptyView();
        }
    }

    /**
     * Handles the creation of a new meeting.
     */
    handleNewMeeting = async () => {
        const newMeeting = {
            título: "New Meeting",
            fechaInicio: new Date().toISOString(),
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            // All other properties will have default empty values
            timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
            ubicación: '', virtualLink: '', etiquetas: [], participantes: [],
            agenda: [], tareas: [], acuerdos: [], decisiones: [],
            adjuntos: [], hashChainHead: null
        };

        const newId = await this.store.saveMeeting(newMeeting);
        this.activeMeetingId = newId;

        await this.showMeetingsInSidebar();

        const freshMeeting = await this.store.getMeeting(newId);
        this.view.showMeetingDetailView(freshMeeting);

        // In a real app, we might want to immediately focus the title field for editing.
    }

    /**
     * Refreshes the agenda view for the currently active meeting.
     */
    refreshAgendaView = async () => {
        if (this.activeMeetingId) {
            const agendaItems = await this.store.getAgendaItemsForMeeting(this.activeMeetingId);
            this.view.renderAgenda(agendaItems);
        }
    }

    /**
     * Handles adding a new agenda item.
     * @param {string} title - The title of the new agenda item.
     */
    handleAddAgendaItem = async (title) => {
        if (!this.activeMeetingId) return;

        const items = await this.store.getAgendaItemsForMeeting(this.activeMeetingId);
        const newOrder = items.length > 0 ? Math.max(...items.map(i => i.order)) + 1 : 0;

        const newItem = {
            meetingId: this.activeMeetingId,
            título: title,
            estado: 'pendiente',
            order: newOrder,
        };

        await this.store.saveAgendaItem(newItem);
        await this.refreshAgendaView();
    }

    /**
     * Handles deleting an agenda item.
     * @param {number} id - The ID of the agenda item to delete.
     */
    handleDeleteAgendaItem = async (id) => {
        if (confirm('Are you sure you want to delete this agenda item?')) {
            await this.store.deleteAgendaItem(id);
            await this.refreshAgendaView();
        }
    }

    /**
     * Handles the reordering of agenda items after a drag-and-drop operation.
     * @param {Array<{id: number, order: number}>} reorderedData - An array of objects with id and new order.
     */
    handleUpdateAgendaOrder = async (reorderedData) => {
        const fullItems = await this.store.getAgendaItemsForMeeting(this.activeMeetingId);

        const itemsToSave = fullItems.map(item => {
            const reorderedItem = reorderedData.find(d => d.id === item.id);
            return { ...item, order: reorderedItem ? reorderedItem.order : item.order };
        });

        await this.store.saveAgendaOrder(itemsToSave);
    }

    // --- Note Block Handlers ---

    refreshNotesView = async () => {
        if (this.activeMeetingId) {
            const noteBlocks = await this.store.getNoteBlocksForMeeting(this.activeMeetingId);
            this.view.renderNotes(noteBlocks);
        }
    }

    handleAddNoteBlock = async () => {
        if (!this.activeMeetingId) return;
        const newNoteBlock = {
            meetingId: this.activeMeetingId,
            tipo: 'texto',
            contenido: 'New note...'
        };
        await this.store.saveNoteBlock(newNoteBlock);
        await this.refreshNotesView();
    }

    handleSaveNoteBlock = async (id, content) => {
        const noteBlocks = await this.store.getNoteBlocksForMeeting(this.activeMeetingId);
        const noteBlockToSave = noteBlocks.find(nb => nb.id === id);
        if (noteBlockToSave) {
            noteBlockToSave.contenido = content;
            await this.store.saveNoteBlock(noteBlockToSave);
            alert('Note saved!');
        }
    }

    handleDeleteNoteBlock = async (id) => {
        if (confirm('Are you sure you want to delete this note block?')) {
            await this.store.deleteNoteBlock(id);
            await this.refreshNotesView();
        }
    }
}
