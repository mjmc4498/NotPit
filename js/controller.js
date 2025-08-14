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
        // Export
        this.view.bindExportEvents(this.handleExportWorkspace, this.handleExportSingleMeetingJSON, this.handleExportTasksCSV, this.handleExportMarkdown);

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

    // --- Import/Export Handlers ---

    _downloadFile(filename, data, type = 'application/json') {
        const blob = new Blob([data], { type });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    }

    handleExportWorkspace = async () => {
        try {
            const workspaceData = await this.store.exportWorkspace();
            const filename = `notpit-workspace-backup-${new Date().toISOString().split('T')[0]}.json`;
            this._downloadFile(filename, JSON.stringify(workspaceData, null, 2));
        } catch (error) {
            console.error('Workspace export failed:', error);
            alert('Failed to export workspace.');
        }
    }

    handleExportSingleMeetingJSON = async () => {
        if (!this.activeMeetingId) {
            alert('Please select a meeting to export.');
            return;
        }
        try {
            const meeting = await this.store.getMeeting(this.activeMeetingId);
            const agendaItems = await this.store.getAgendaItemsForMeeting(this.activeMeetingId);
            const noteBlocks = await this.store.getNoteBlocksForMeeting(this.activeMeetingId);
            const tasks = await this.store.getTasksForMeeting(this.activeMeetingId);
            // In a real app, we'd fetch participants, agreements, etc. too

            const bundledData = {
                meeting,
                agendaItems,
                noteBlocks,
                tasks,
            };

            const filename = `notpit-meeting-${meeting.id}-${new Date().toISOString().split('T')[0]}.json`;
            this._downloadFile(filename, JSON.stringify(bundledData, null, 2));

        } catch (error) {
            console.error('Meeting export failed:', error);
            alert('Failed to export meeting.');
        }
    }

    _convertToCSV(data) {
        if (data.length === 0) return '';
        const headers = Object.keys(data[0]);
        const rows = data.map(row =>
            headers.map(header => {
                let cell = row[header] === null || row[header] === undefined ? '' : row[header];
                cell = String(cell);
                if (cell.includes(',') || cell.includes('"') || cell.includes('\n')) {
                    cell = `"${cell.replace(/"/g, '""')}"`;
                }
                return cell;
            }).join(',')
        );
        return [headers.join(','), ...rows].join('\n');
    }

    handleExportTasksCSV = async () => {
        if (!this.activeMeetingId) {
            alert('Please select a meeting to export tasks from.');
            return;
        }
        try {
            const tasks = await this.store.getTasksForMeeting(this.activeMeetingId);
            if (tasks.length === 0) {
                alert('No tasks to export.');
                return;
            }
            const csvData = this._convertToCSV(tasks);
            const filename = `notpit-tasks-meeting-${this.activeMeetingId}-${new Date().toISOString().split('T')[0]}.csv`;
            this._downloadFile(filename, csvData, 'text/csv;charset=utf-8;');
        } catch (error) {
            console.error('CSV export failed:', error);
            alert('Failed to export tasks as CSV.');
        }
    }

    _generateYAMLFrontMatter(meeting) {
        // A simple YAML generator
        const metadata = {
            title: meeting.título,
            date: meeting.fechaInicio,
            location: meeting.ubicación || 'N/A',
            link: meeting.virtualLink || 'N/A',
            tags: meeting.etiquetas.join(', ')
        };
        return '---\n' + Object.entries(metadata).map(([key, value]) => `${key}: ${value}`).join('\n') + '\n---\n\n';
    }

    _generateMarkdownBody(meeting, agenda, notes, tasks) {
        let body = `# Meeting: ${meeting.título}\n\n`;

        body += '## Agenda\n';
        if (agenda.length > 0) {
            agenda.sort((a,b) => a.order - b.order).forEach(item => {
                body += `- ${item.título}\n`;
            });
        } else {
            body += 'No agenda items.\n';
        }
        body += '\n';

        body += '## Notes\n';
        if (notes.length > 0) {
            notes.forEach(item => {
                body += `### ${item.tipo}\n${item.contenido}\n\n`;
            });
        } else {
            body += 'No notes taken.\n';
        }
        body += '\n';

        body += '## Tasks\n';
        if (tasks.length > 0) {
            tasks.forEach(task => {
                body += `- [${task.estado === 'Done' ? 'x' : ' '}] ${task.descripción} (Priority: ${task.prioridad})\n`;
            });
        } else {
            body += 'No tasks assigned.\n';
        }

        return body;
    }

    handleExportMarkdown = async () => {
        if (!this.activeMeetingId) {
            alert('Please select a meeting to export.');
            return;
        }
        try {
            const meeting = await this.store.getMeeting(this.activeMeetingId);
            const agendaItems = await this.store.getAgendaItemsForMeeting(this.activeMeetingId);
            const noteBlocks = await this.store.getNoteBlocksForMeeting(this.activeMeetingId);
            const tasks = await this.store.getTasksForMeeting(this.activeMeetingId);

            const yaml = this._generateYAMLFrontMatter(meeting);
            const body = this._generateMarkdownBody(meeting, agendaItems, noteBlocks, tasks);
            const markdownContent = yaml + body;

            const filename = `notpit-meeting-${meeting.id}-${new Date().toISOString().split('T')[0]}.md`;
            this._downloadFile(filename, markdownContent, 'text/markdown;charset=utf-8;');

        } catch (error) {
            console.error('Markdown export failed:', error);
            alert('Failed to export as Markdown.');
        }
    }
}
