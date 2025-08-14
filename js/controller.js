// This module acts as the controller for the new layout.
export default class Controller {
    constructor(store, view) {
        this.store = store;
        this.view = view;
        this.activeMeetingId = null;

        // Bind view event handlers to controller methods
        this.view.bindSelectMeeting(this.handleSelectMeeting);
        this.view.bindNewMeeting(this.handleNewMeeting);
        // Agenda
        this.view.bindAddAgendaItem(this.handleAddAgendaItem);
        this.view.bindDeleteAgendaItem(this.handleDeleteAgendaItem);
        this.view.bindDragAndDropAgenda(this.handleUpdateAgendaOrder);
        // Notas
        this.view.bindNotesTabEvents(this.handleAddNoteBlock, this.handleSaveNoteBlock, this.handleDeleteNoteBlock);
        // Tareas
        this.view.bindTasksTabEvents(this.handleAddTask, this.handleUpdateTask, this.handleDeleteTask);

        // Initial display
        this.showMeetingsInSidebar();
        this.view.showEmptyView();
    }

    // --- Core Render/Refresh Logic ---

    async showMeetingsInSidebar() {
        const meetings = await this.store.getAllMeetings();
        this.view.displayMeetingsInSidebar(meetings, this.activeMeetingId);
    }

    async refreshAgendaView() {
        if (!this.activeMeetingId) return;
        const items = await this.store.getAgendaItemsForMeeting(this.activeMeetingId);
        this.view.renderAgenda(items);
    }

    async refreshNotesView() {
        if (!this.activeMeetingId) return;
        const items = await this.store.getNoteBlocksForMeeting(this.activeMeetingId);
        this.view.renderNotes(items);
    }

    async refreshTasksView() {
        if (!this.activeMeetingId) return;
        const items = await this.store.getTasksForMeeting(this.activeMeetingId);
        this.view.renderTasks(items);
    }

    // --- Meeting Handlers ---

    handleSelectMeeting = async (id) => {
        if (this.activeMeetingId === id) return;
        this.activeMeetingId = id;
        await this.showMeetingsInSidebar();

        const meeting = await this.store.getMeeting(id);
        if (meeting) {
            this.view.showMeetingDetailView(meeting);
            // Render content for all tabs
            this.refreshAgendaView();
            this.refreshNotesView();
            this.refreshTasksView();
        } else {
            this.activeMeetingId = null;
            this.view.showEmptyView();
        }
    }

    handleNewMeeting = async () => {
        const newMeeting = {
            título: "New Meeting",
            fechaInicio: new Date().toISOString(),
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
            ubicación: '', virtualLink: '', etiquetas: [], participantes: [],
            agenda: [], tareas: [], acuerdos: [], decisiones: [],
            adjuntos: [], hashChainHead: null
        };
        const newId = await this.store.saveMeeting(newMeeting);
        await this.handleSelectMeeting(newId);
    }

    // --- Agenda Handlers ---

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

    handleDeleteAgendaItem = async (id) => {
        if (confirm('Are you sure you want to delete this agenda item?')) {
            await this.store.deleteAgendaItem(id);
            await this.refreshAgendaView();
        }
    }

    handleUpdateAgendaOrder = async (reorderedData) => {
        const fullItems = await this.store.getAgendaItemsForMeeting(this.activeMeetingId);
        const itemsToSave = fullItems.map(item => {
            const reorderedItem = reorderedData.find(d => d.id === item.id);
            return { ...item, order: reorderedItem ? reorderedItem.order : item.order };
        });
        await this.store.saveAgendaOrder(itemsToSave);
    }

    // --- Note Block Handlers ---

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

    // --- Task Handlers ---

    handleAddTask = async (description, priority) => {
        if (!this.activeMeetingId) return;
        const newTask = {
            descripción: description,
            prioridad: priority,
            estado: 'ToDo',
            originMeetingId: this.activeMeetingId,
        };
        await this.store.saveTask(newTask);
        await this.refreshTasksView();
    };

    handleUpdateTask = async (id, updatedFields) => {
        const tasks = await this.store.getTasksForMeeting(this.activeMeetingId);
        const taskToUpdate = tasks.find(t => t.id === id);
        if (taskToUpdate) {
            const updatedTask = { ...taskToUpdate, ...updatedFields };
            await this.store.saveTask(updatedTask);
            await this.refreshTasksView();
        }
    };

    handleDeleteTask = async (id) => {
        if (confirm('Are you sure you want to delete this task?')) {
            await this.store.deleteTask(id);
            await this.refreshTasksView();
        }
    };
}
