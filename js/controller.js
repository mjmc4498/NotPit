// This module acts as the controller for the new layout.
import { deriveKey, sign } from './crypto.js';

export default class Controller {
    constructor(store, view, translator) {
        this.store = store;
        this.view = view;
        this.t = translator;
        this.activeMeetingId = null;
        this.currentlyViewedNote = null;

        // Bind view event handlers to controller methods
        this.view.bindMeetingListEvents(this.handleSelectMeeting, this.handleDeleteMeeting);
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
        // Agreements & Decisions
        this.view.bindAgreementsTabEvents(this.handleAddAgreement, this.handleDeleteAgreement, this.handleUpdateAgreement);
        this.view.bindDecisionsTabEvents(this.handleAddDecision, this.handleDeleteDecision);
        // Audit
        this.view.bindAuditTabEvents(this.handleVerifyChain);
        // Export
        this.view.bindExportEvents(this.handleExportWorkspace, this.handleExportSingleMeetingJSON, this.handleExportTasksCSV, this.handleExportMarkdown);
        // Sharing
        this.view.bindSharingEvents(this.handleShare, this.handleCopyTasksCSV);
        this.view.bindSignMeeting(this.handleSignMeeting);
        this.view.bindRenameMeeting(this.handleRenameMeeting);
        // Import
        this.view.bindImportEvents(this.handleImport);
        this.view.bindLockWorkspace(this.handleLockWorkspace);
        this.view.bindSecuritySettingsEvents(this.handleShowSecuritySettings, this.handleEnableEncryption);

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

    async refreshAgreementsView() {
        if (!this.activeMeetingId) return;
        const items = await this.store.getAgreementsForMeeting(this.activeMeetingId);
        const score = this._calculateAcuerdometroScore(items);
        this.view.renderAgreements(items);
        this.view.updateAcuerdometroWidget(score);
    }

    _calculateAcuerdometroScore(agreements) {
        if (!agreements || agreements.length === 0) return -1; // Special value for no agreements

        const priorityWeights = { H: 3, M: 2, L: 1 };

        let totalWeight = 0;
        let fulfilledWeight = 0;

        agreements.forEach(a => {
            const weight = priorityWeights[a.priority] || 1;
            if (a.status === 'Fulfilled') {
                totalWeight += weight;
                fulfilledWeight += weight;
            } else if (a.status === 'Pending') {
                totalWeight += weight;
            }
            // 'Breached' agreements are not counted in the total possible score
        });

        if (totalWeight === 0) return -1; // No pending or fulfilled agreements

        return fulfilledWeight / totalWeight;
    }

    async refreshDecisionsView() {
        if (!this.activeMeetingId) return;
        const items = await this.store.getDecisionsForMeeting(this.activeMeetingId);
        this.view.renderDecisions(items);
    }

    async refreshAuditView() {
        if (!this.activeMeetingId) return;
        const items = await this.store.getEventsForMeeting(this.activeMeetingId);
        this.view.renderAuditView(items);
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
            const agreements = await this.store.getAgreementsForMeeting(id);
            const hasUnsigned = agreements.some(a => !a.signature);
            this.view.toggleSignButton(hasUnsigned);

            this.refreshAgendaView();
            this.refreshNotesView();
            this.refreshTasksView();
            this.refreshAgreementsView();
            this.refreshDecisionsView();
            this.refreshAuditView();
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

    handleDeleteMeeting = async (id) => {
        const meeting = await this.store.getMeeting(id);
        if (!meeting) return;

        this.view.showConfirmation(this.t('confirm_delete_meeting', { title: meeting.título }), async () => {
            await this.store.deleteMeeting(id);
            this.view.showToast('Meeting deleted successfully.', 'success');

            if (this.activeMeetingId === id) {
                this.activeMeetingId = null;
                this.view.showEmptyView();
            }
            await this.showMeetingsInSidebar();
        });
    }

    handleRenameMeeting = async () => {
        if (!this.activeMeetingId) return;

        const meeting = await this.store.getMeeting(this.activeMeetingId);
        if (!meeting) return;

        const newTitle = prompt(this.t('rename_meeting_prompt'), meeting.título);

        if (newTitle && newTitle !== meeting.título) {
            meeting.título = newTitle;
            await this.store.saveMeeting(meeting);
            this.view.showToast('Meeting renamed successfully.', 'success');
            // Refresh views to show new title
            this.view.mainMeetingTitle.textContent = newTitle;
            await this.showMeetingsInSidebar();
        }
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
        this.view.showConfirmation(this.t('confirm_delete_agenda_item'), async () => {
            await this.store.logEvent({ meetingId: this.activeMeetingId, type: 'AGENDA_ITEM_DELETED', details: { id } });
            await this.store.deleteAgendaItem(id);
            await this.refreshAgendaView();
            this.view.showToast('Agenda item deleted.', 'info');
        });
    }

    handleUpdateAgendaOrder = async (reorderedData) => {
        const fullItems = await this.store.getAgendaItemsForMeeting(this.activeMeetingId);
        const itemsToSave = fullItems.map(item => {
            const reorderedItem = reorderedData.find(d => d.id === item.id);
            // Ensure we don't save items that weren't reordered.
            if (reorderedItem) {
                return { ...item, order: reorderedItem.order };
            }
            return item;
        }).filter(item => reorderedData.some(d => d.id === item.id)); // only save changed items

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
            this.view.showToast(this.t('note_saved_success'), 'success');
        }
    }

    handleDeleteNoteBlock = async (id) => {
        this.view.showConfirmation(this.t('confirm_delete_note_block'), async () => {
            await this.store.logEvent({ meetingId: this.activeMeetingId, type: 'NOTE_BLOCK_DELETED', details: { id } });
            await this.store.deleteNoteBlock(id);
            await this.refreshNotesView();
            this.view.showToast('Note block deleted.', 'info');
        });
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
        this.view.showConfirmation(this.t('confirm_delete_task'), async () => {
            await this.store.logEvent({ meetingId: this.activeMeetingId, type: 'TASK_DELETED', details: { id } });
            await this.store.deleteTask(id);
            await this.refreshTasksView();
            this.view.showToast('Task deleted.', 'info');
        });
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
            this.view.showToast(this.t('workspace_export_fail'), 'danger');
        }
    }

    handleExportSingleMeetingJSON = async () => {
        if (!this.activeMeetingId) {
            this.view.showToast(this.t('export_meeting_select_prompt'), 'warning');
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
            this.view.showToast(this.t('meeting_export_fail'), 'danger');
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
            this.view.showToast(this.t('export_tasks_select_prompt'), 'warning');
            return;
        }
        try {
            const tasks = await this.store.getTasksForMeeting(this.activeMeetingId);
            if (tasks.length === 0) {
                this.view.showToast(this.t('export_no_tasks'), 'info');
                return;
            }
            const csvData = this._convertToCSV(tasks);
            const filename = `notpit-tasks-meeting-${this.activeMeetingId}-${new Date().toISOString().split('T')[0]}.csv`;
            this._downloadFile(filename, csvData, 'text/csv;charset=utf-8;');
        } catch (error) {
            console.error('CSV export failed:', error);
            this.view.showToast(this.t('csv_export_fail'), 'danger');
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
            this.view.showToast(this.t('export_meeting_select_prompt'), 'warning');
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
            this.view.showToast(this.t('markdown_export_fail'), 'danger');
        }
    }

    // --- Sharing Handlers ---
    handleShare = async () => {
        if (!this.activeMeetingId) {
            this.view.showToast(this.t('export_meeting_select_prompt'), 'warning');
            return;
        }

        if (!navigator.share) {
            this.view.showToast(this.t('web_share_api_not_supported'), 'danger');
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
                this.view.showToast(this.t('share_failed'), 'danger');
            }
        }
    }

    handleCopyTasksCSV = async () => {
        if (!this.activeMeetingId) {
            this.view.showToast(this.t('export_tasks_select_prompt'), 'warning');
            return;
        }

        if (!navigator.clipboard) {
            this.view.showToast(this.t('clipboard_api_not_supported'), 'danger');
            return;
        }

        try {
            const tasks = await this.store.getTasksForMeeting(this.activeMeetingId);
            if (tasks.length === 0) {
                this.view.showToast(this.t('export_no_tasks'), 'info');
                return;
            }
            const csvData = this._convertToCSV(tasks);
            await navigator.clipboard.writeText(csvData);
            this.view.showToast(this.t('csv_copied_success'), 'success');
            await this.store.logEvent({ meetingId: this.activeMeetingId, type: 'TASKS_COPIED', details: { format: 'CSV' } });

        } catch (error) {
            console.error('Copy to clipboard failed:', error);
            this.view.showToast(this.t('copy_failed'), 'danger');
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

                this.view.showConfirmation(this.t(isWorkspace ? 'import_confirm_workspace' : 'import_confirm_single'), async () => {
                    await this.store.importData(data);
                    this.view.showToast(this.t('import_success'), 'success');
                    await this.showMeetingsInSidebar(); // Refresh the view
                });
            } catch (error) {
                console.error('Import failed:', error);
                this.view.showToast(`${this.t('import_fail')}: ${error.message}`, 'danger');
            } finally {
                // Reset the file input so the user can select the same file again
                event.target.value = '';
            }
        };
        reader.onerror = () => {
            this.view.showToast(this.t('import_file_read_error'), 'danger');
            event.target.value = '';
        };
        reader.readAsText(file);
    }

    // --- Agreement and Decision Handlers ---
    handleAddAgreement = async (statement, deadline, priority) => {
        if (!this.activeMeetingId) return;
        const newAgreement = {
            meetingId: this.activeMeetingId,
            statement,
            deadline,
            priority,
            status: 'Pending',
            signature: ''
        };
        await this.store.saveAgreement(newAgreement);
        await this.refreshAgreementsView();
    }

    handleDeleteAgreement = async (id) => {
        this.view.showConfirmation(this.t('confirm_delete_agreement'), async () => {
            await this.store.deleteAgreement(id);
            await this.refreshAgreementsView();
            this.view.showToast('Agreement deleted.', 'info');
        });
    }

    handleUpdateAgreement = async (id, updatedFields) => {
        const agreement = await this.store.getAgreement(id);
        if (agreement) {
            const updatedAgreement = { ...agreement, ...updatedFields };
            await this.store.saveAgreement(updatedAgreement);
            await this.refreshAgreementsView();
        }
    }

    handleAddDecision = async (statement) => {
        if (!this.activeMeetingId) return;
        // The store will now handle all the hashing and chaining logic.
        const decisionData = {
            meetingId: this.activeMeetingId,
            statement,
            resultado: 'N/A', // Default value
            // hashPrev and hashSelf will be calculated by the store.
        };
        await this.store.saveDecision(decisionData);
        await this.refreshDecisionsView();
    }

    handleDeleteDecision = async (id) => {
        this.view.showConfirmation(this.t('confirm_delete_decision'), async () => {
            await this.store.deleteDecision(id);
            await this.refreshDecisionsView();
            this.view.showToast('Decision deleted.', 'info');
        });
    }

    handleSignMeeting = async () => {
        if (!this.activeMeetingId) return;

        const password = prompt(this.t('sign_meeting_prompt_password'));
        if (!password) return;

        try {
            const meeting = await this.store.getMeeting(this.activeMeetingId);
            let salt;

            if (meeting.pbkdf2Salt) {
                // Convert hex salt from DB back to Uint8Array
                salt = new Uint8Array(meeting.pbkdf2Salt.match(/.{1,2}/g).map(byte => parseInt(byte, 16)));
            } else {
                // Create and save a new salt for this meeting
                salt = crypto.getRandomValues(new Uint8Array(16));
                meeting.pbkdf2Salt = Array.from(salt).map(b => b.toString(16).padStart(2, '0')).join('');
                await this.store.saveMeeting(meeting);
            }

            const key = await deriveKey(password, salt);
            const agreements = await this.store.getAgreementsForMeeting(this.activeMeetingId);

            for (const agreement of agreements) {
                if (!agreement.signature) {
                    const payload = `${agreement.statement}|${agreement.deadline}|${agreement.priority}|${agreement.status}`;
                    agreement.signature = await sign(key, payload);
                    await this.store.saveAgreement(agreement);
                }
            }

            this.view.showToast(this.t('sign_success'), 'success');
            await this.refreshAgreementsView();
            this.view.toggleSignButton(false); // Hide button immediately

        } catch (error) {
            console.error("Signing failed:", error);
            this.view.showToast(this.t('sign_fail'), 'danger');
        }
    }

    // --- Audit Handlers ---
    handleVerifyChain = async () => {
        if (!this.activeMeetingId) return;
        try {
            const isValid = await this.store.verifyDecisionChain(this.activeMeetingId);
            this.view.displayChainStatus(isValid);
        } catch (error) {
            console.error("Chain verification failed:", error);
            this.view.displayChainStatus(false);
        }
    }

    handleLockWorkspace = () => {
        // Clear the in-memory key and reload the page.
        // The startup logic in app.js will then force the locked view.
        this.store.setEncryptionKey(null);
        location.reload();
    }

    // --- Security Handlers ---
    handleShowSecuritySettings = async () => {
        const isEncrypted = await this.store.getMetadata('encryption_enabled');
        this.view.renderSecuritySettings(isEncrypted);
    }

    handleEnableEncryption = async (password) => {
        this.view.showConfirmation(this.t('confirm_enable_encryption'), async () => {
            this.view.showLoading(true, 'Encrypting workspace... This may take a moment.');
            try {
                const salt = crypto.getRandomValues(new Uint8Array(16));
            const key = await deriveKey(password, salt);

            // Set key in store temporarily to encrypt everything
            this.store.setEncryptionKey(key);

            // Create and save the canary
            const canary = { test: 'ok' };
            const encryptedCanary = await encrypt(key, canary);
            await this.store.setMetadata('encryption_canary', encryptedCanary);

            // Re-encrypt all data
            await this.store.encryptAllData();

            // Persist salt and enable encryption flag
            const saltHex = Array.from(salt).map(b => b.toString(16).padStart(2, '0')).join('');
            await this.store.setMetadata('encryption_salt', saltHex);
            await this.store.setMetadata('encryption_enabled', true);

            this.view.showLoading(false);
            this.view.showToast(this.t('encryption_enabled_success'), 'success');
            setTimeout(() => location.reload(), 2000); // Give user time to read toast

            } catch (error) {
                this.view.showLoading(false);
                console.error("Failed to enable encryption:", error);
                this.view.showToast(this.t('encryption_enabled_fail'), 'danger');
                this.store.setEncryptionKey(null); // Clear key on failure
            }
        });
    }
}
