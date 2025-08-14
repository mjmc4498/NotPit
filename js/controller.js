// This module acts as the controller for the new layout.
export default class Controller {
    constructor(store, view, translator) {
        this.store = store;
        this.view = view;
        this.t = translator;
        this.activeMeetingId = null;
        this.currentlyViewedNote = null;

        // Bind view event handlers to controller methods
        this.view.bindSelectMeeting(this.handleSelectMeeting);
        this.view.bindNewMeeting(this.handleNewMeeting);
        this.view.bindCreateMeeting(this.handleCreateMeetingFromTemplate);
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
        // Sharing
        this.view.bindSharingEvents(this.handleShare, this.handleCopyTasksCSV);
        // Import
        this.view.bindImportEvents(this.handleImport);

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

    async refreshTimelineView() {
        if (!this.activeMeetingId) return;
        const items = await this.store.getEventsForMeeting(this.activeMeetingId);
        this.view.renderTimeline(items);
    }

    // --- Meeting Handlers ---
    handleSelectMeeting = async (id) => {
        if (this.activeMeetingId === id) return;
        this.activeMeetingId = id;
        await this.showMeetingsInSidebar();
        const meeting = await this.store.getMeeting(id);
        if (meeting) {
            this.view.showMeetingDetailView(meeting);
            this.refreshAgendaView();
            this.refreshNotesView();
            this.refreshTasksView();
            this.refreshTimelineView();
        } else {
            this.activeMeetingId = null;
            this.view.showEmptyView();
        }
    }

    handleNewMeeting = async () => {
        const templates = await this.store.getTemplates();
        this.view.showNewMeetingModal(templates);
    }

    handleCreateMeetingFromTemplate = async (title, templateId) => {
        const newMeetingData = {
            título: title,
            fechaInicio: new Date().toISOString(),
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
            ubicación: '', virtualLink: '', etiquetas: [], participantes: [],
            agenda: [], tareas: [], acuerdos: [], decisiones: [],
            adjuntos: [], hashChainHead: null
        };
        const newMeetingId = await this.store.saveMeeting(newMeetingData);
        await this.store.logEvent({ meetingId: newMeetingId, type: 'MEETING_CREATED', details: { title } });

        if (templateId !== 'none') {
            const templates = await this.store.getTemplates();
            const template = templates.find(t => t.id === Number(templateId));
            if (template) {
                const agendaItems = template.agenda_titles.map((title, index) => ({
                    meetingId: newMeetingId,
                    título: title,
                    estado: 'pendiente',
                    order: index,
                }));
                for (const item of agendaItems) {
                    await this.store.saveAgendaItem(item);
                    await this.store.logEvent({ meetingId: newMeetingId, type: 'AGENDA_ITEM_CREATED', details: { title: item.título } });
                }
            }
        }

        await this.handleSelectMeeting(newMeetingId);
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
        await this.store.logEvent({ meetingId: this.activeMeetingId, type: 'AGENDA_ITEM_CREATED', details: { title } });
        await this.refreshAgendaView();
    }

    handleDeleteAgendaItem = async (id) => {
        if (confirm(this.t('confirm_delete_agenda_item'))) {
            await this.store.logEvent({ meetingId: this.activeMeetingId, type: 'AGENDA_ITEM_DELETED', details: { id } });
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
        await this.store.logEvent({ meetingId: this.activeMeetingId, type: 'AGENDA_REORDERED', details: {} });
    }

    // --- Note Block Handlers ---
    handleAddNoteBlock = async () => {
        if (!this.activeMeetingId) return;
        const newNoteBlock = {
            meetingId: this.activeMeetingId,
            tipo: 'texto',
            contenido: this.t('new_note_content_default')
        };
        const newId = await this.store.saveNoteBlock(newNoteBlock);
        await this.store.logEvent({ meetingId: this.activeMeetingId, type: 'NOTE_BLOCK_CREATED', details: { id: newId } });
        await this.refreshNotesView();
    }

    handleSaveNoteBlock = async (id, content) => {
        const noteBlocks = await this.store.getNoteBlocksForMeeting(this.activeMeetingId);
        const noteBlockToSave = noteBlocks.find(nb => nb.id === id);
        if (noteBlockToSave) {
            noteBlockToSave.contenido = content;
            await this.store.saveNoteBlock(noteBlockToSave);
            await this.store.logEvent({ meetingId: this.activeMeetingId, type: 'NOTE_BLOCK_UPDATED', details: { id } });
            alert(this.t('note_saved_success'));
        }
    }

    handleDeleteNoteBlock = async (id) => {
        if (confirm(this.t('confirm_delete_note_block'))) {
            await this.store.logEvent({ meetingId: this.activeMeetingId, type: 'NOTE_BLOCK_DELETED', details: { id } });
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
        const newId = await this.store.saveTask(newTask);
        await this.store.logEvent({ meetingId: this.activeMeetingId, type: 'TASK_CREATED', details: { id: newId, description } });
        await this.refreshTasksView();
    };

    handleUpdateTask = async (id, updatedFields) => {
        const tasks = await this.store.getTasksForMeeting(this.activeMeetingId);
        const taskToUpdate = tasks.find(t => t.id === id);
        if (taskToUpdate) {
            const oldStatus = taskToUpdate.estado;
            const newStatus = updatedFields.estado;
            const updatedTask = { ...taskToUpdate, ...updatedFields };
            await this.store.saveTask(updatedTask);

            if (newStatus && oldStatus !== newStatus) {
                await this.store.logEvent({ meetingId: this.activeMeetingId, type: 'TASK_STATUS_CHANGED', details: { id, oldStatus, newStatus } });
            }
            await this.refreshTasksView();
        }
    };

    handleDeleteTask = async (id) => {
        if (confirm(this.t('confirm_delete_task'))) {
            await this.store.logEvent({ meetingId: this.activeMeetingId, type: 'TASK_DELETED', details: { id } });
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
            alert(this.t('workspace_export_fail'));
        }
    }

    handleExportSingleMeetingJSON = async () => {
        if (!this.activeMeetingId) {
            alert(this.t('export_meeting_select_prompt'));
            return;
        }
        try {
            const meeting = await this.store.getMeeting(this.activeMeetingId);
            const agendaItems = await this.store.getAgendaItemsForMeeting(this.activeMeetingId);
            const noteBlocks = await this.store.getNoteBlocksForMeeting(this.activeMeetingId);
            const tasks = await this.store.getTasksForMeeting(this.activeMeetingId);
            const bundledData = { meeting, agendaItems, noteBlocks, tasks };
            const filename = `notpit-meeting-${meeting.id}-${new Date().toISOString().split('T')[0]}.json`;
            this._downloadFile(filename, JSON.stringify(bundledData, null, 2));
        } catch (error) {
            console.error('Meeting export failed:', error);
            alert(this.t('meeting_export_fail'));
        }
    }

    _convertToCSV(data) {
        if (data.length === 0) return '';
        const headers = Object.keys(data[0]);
        const rows = data.map(row => headers.map(header => {
            let cell = row[header] === null || row[header] === undefined ? '' : row[header];
            cell = String(cell);
            if (cell.includes(',') || cell.includes('"') || cell.includes('\n')) {
                cell = `"${cell.replace(/"/g, '""')}"`;
            }
            return cell;
        }).join(','));
        return [headers.join(','), ...rows].join('\n');
    }

    handleExportTasksCSV = async () => {
        if (!this.activeMeetingId) {
            alert(this.t('export_tasks_select_prompt'));
            return;
        }
        try {
            const tasks = await this.store.getTasksForMeeting(this.activeMeetingId);
            if (tasks.length === 0) {
                alert(this.t('export_no_tasks'));
                return;
            }
            const csvData = this._convertToCSV(tasks);
            const filename = `notpit-tasks-meeting-${this.activeMeetingId}-${new Date().toISOString().split('T')[0]}.csv`;
            this._downloadFile(filename, csvData, 'text/csv;charset=utf-8;');
        } catch (error) {
            console.error('CSV export failed:', error);
            alert(this.t('csv_export_fail'));
        }
    }

    _generateYAMLFrontMatter(meeting) {
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
        let body = `# ${this.t('meeting_header', { title: meeting.título })}\n\n`;
        body += `## ${this.t('agenda_header')}\n`;
        if (agenda.length > 0) {
            agenda.sort((a,b) => a.order - b.order).forEach(item => {
                body += `- ${item.título}\n`;
            });
        } else {
            body += `${this.t('no_agenda_items')}\n`;
        }
        body += '\n';
        body += `## ${this.t('notes_header')}\n`;
        if (notes.length > 0) {
            notes.forEach(item => {
                body += `### ${item.tipo}\n${item.contenido}\n\n`;
            });
        } else {
            body += `${this.t('no_notes_yet')}\n`;
        }
        body += '\n';
        body += `## ${this.t('tasks_header')}\n`;
        if (tasks.length > 0) {
            tasks.forEach(task => {
                body += `- [${task.estado === 'Done' ? 'x' : ' '}] ${task.descripción} (Priority: ${task.prioridad})\n`;
            });
        } else {
            body += `${this.t('no_tasks_yet')}\n`;
        }
        return body;
    }

    handleExportMarkdown = async () => {
        if (!this.activeMeetingId) {
            alert(this.t('export_meeting_select_prompt'));
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
            alert(this.t('markdown_export_fail'));
        }
    }

    // --- Sharing Handlers ---
    handleShare = async () => {
        if (!this.activeMeetingId) {
            alert(this.t('export_meeting_select_prompt'));
            return;
        }

        if (!navigator.share) {
            alert(this.t('web_share_api_not_supported'));
            return;
        }

        try {
            const meeting = await this.store.getMeeting(this.activeMeetingId);
            const tasks = await this.store.getTasksForMeeting(this.activeMeetingId);
            const doneTasks = tasks.filter(t => t.estado === 'Done').length;
            const totalTasks = tasks.length;

            const shareData = {
                title: `NotPit Meeting: ${meeting.título}`,
                text: `Summary for "${meeting.título}" held on ${new Date(meeting.fechaInicio).toLocaleDateString()}.\n` +
                      `Tasks: ${doneTasks}/${totalTasks} completed.`,
                url: window.location.href // Shares the app URL
            };

            await navigator.share(shareData);
            await this.store.logEvent({ meetingId: this.activeMeetingId, type: 'MEETING_SHARED', details: { method: 'WebShareAPI' } });

        } catch (error) {
            // Don't alert on AbortError, which happens if the user cancels the share.
            if (error.name !== 'AbortError') {
                console.error('Share failed:', error);
                alert(this.t('share_failed'));
            }
        }
    }

    handleCopyTasksCSV = async () => {
        if (!this.activeMeetingId) {
            alert(this.t('export_tasks_select_prompt'));
            return;
        }

        if (!navigator.clipboard) {
            alert(this.t('clipboard_api_not_supported'));
            return;
        }

        try {
            const tasks = await this.store.getTasksForMeeting(this.activeMeetingId);
            if (tasks.length === 0) {
                alert(this.t('export_no_tasks'));
                return;
            }
            const csvData = this._convertToCSV(tasks);
            await navigator.clipboard.writeText(csvData);
            alert(this.t('csv_copied_success'));
            await this.store.logEvent({ meetingId: this.activeMeetingId, type: 'TASKS_COPIED', details: { format: 'CSV' } });

        } catch (error) {
            console.error('Copy to clipboard failed:', error);
            alert(this.t('copy_failed'));
        }
    }

    // --- Import Handler ---
    handleImport = (event) => {
        const file = event.target.files[0];
        if (!file) {
            return;
        }

        const reader = new FileReader();
        reader.onload = async (e) => {
            try {
                const data = JSON.parse(e.target.result);
                // Simple validation to check if it's a known format
                const isWorkspace = data.meetings && data.tasks && data.agendaItems;
                const isSingleMeeting = data.meeting && data.tasks && data.agendaItems;

                if (!isWorkspace && !isSingleMeeting) {
                    throw new Error(this.t('import_invalid_format'));
                }

                const confirmImport = confirm(this.t(isWorkspace ? 'import_confirm_workspace' : 'import_confirm_single'));
                if (confirmImport) {
                    await this.store.importData(data);
                    alert(this.t('import_success'));
                    await this.showMeetingsInSidebar(); // Refresh the view
                }
            } catch (error) {
                console.error('Import failed:', error);
                alert(`${this.t('import_fail')}: ${error.message}`);
            } finally {
                // Reset the file input so the user can select the same file again
                event.target.value = '';
            }
        };
        reader.onerror = () => {
            alert(this.t('import_file_read_error'));
            event.target.value = '';
        };
        reader.readAsText(file);
    }
}
