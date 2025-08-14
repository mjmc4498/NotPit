// This module handles all DOM manipulation and rendering for the new layout.
export default class View {
    constructor(translator) {
        this.t = translator;

        // Sidebar
        this.meetingsList = document.getElementById('meetings-sidebar-list');
        this.newMeetingBtn = document.getElementById('new-meeting-btn');

        // Main Content Area
        this.mainContentView = document.getElementById('meeting-content-view');
        this.emptyView = document.getElementById('empty-view');
        this.mainMeetingTitle = document.getElementById('main-meeting-title');

        // Import/Export
        this.importBtn = document.getElementById('import-btn');
        this.importFileInput = document.getElementById('import-file-input');
        this.exportWorkspaceBtn = document.getElementById('export-workspace-btn');
        this.exportMeetingJsonBtn = document.getElementById('export-meeting-json-btn');
        this.exportMeetingMdBtn = document.getElementById('export-meeting-md-btn');
        this.exportTasksCsvBtn = document.getElementById('export-tasks-csv-btn');

        // Tab Panes
        this.agendaPane = document.getElementById('agenda-pane');
        this.notasPane = document.getElementById('notas-pane');
        this.tareasPane = document.getElementById('tareas-pane');
    }

    // --- RENDER METHODS ---
    displayMeetingsInSidebar(meetings, activeMeetingId) {
        while (this.meetingsList.firstChild) {
            this.meetingsList.removeChild(this.meetingsList.firstChild);
        }

        if (meetings.length === 0) {
            const p = document.createElement('p');
            p.className = 'text-muted p-3';
            p.textContent = this.t('no_meetings_found');
            this.meetingsList.appendChild(p);
        } else {
            meetings.forEach(meeting => {
                const item = document.createElement('li');
                item.className = 'list-group-item list-group-item-action';
                item.dataset.id = meeting.id;
                item.style.cursor = 'pointer';
                item.innerHTML = `
                    <div class="d-flex w-100 justify-content-between">
                        <h6 class="mb-1">${meeting.título}</h6>
                    </div>
                    <small class="text-muted">${new Date(meeting.fechaInicio).toLocaleDateString()}</small>
                `;
                if (meeting.id === activeMeetingId) item.classList.add('active');
                this.meetingsList.appendChild(item);
            });
        }
    }

    showMeetingDetailView(meeting) {
        this.emptyView.classList.add('d-none');
        this.mainContentView.classList.remove('d-none');
        this.mainMeetingTitle.textContent = meeting.título;
    }

    renderAgenda(items) {
        this.agendaPane.innerHTML = `<h4>${this.t('agenda_header')}</h4>`;

        const form = document.createElement('form');
        form.id = 'add-agenda-item-form';
        form.className = 'd-flex mb-3';
        form.innerHTML = `
            <input type="text" class="form-control me-2" placeholder="${this.t('new_agenda_item_placeholder')}" required>
            <button type="submit" class="btn btn-success btn-sm">${this.t('add_btn')}</button>
        `;
        this.agendaPane.appendChild(form);

        const list = document.createElement('ul');
        list.className = 'list-group';

        if (items.length > 0) {
            items.sort((a, b) => a.order - b.order).forEach(item => {
                const listItem = document.createElement('li');
                listItem.className = 'list-group-item d-flex justify-content-between align-items-center';
                listItem.dataset.id = item.id;
                listItem.textContent = item.título;
                listItem.draggable = true;
                const deleteBtn = document.createElement('button');
                deleteBtn.className = 'btn btn-danger btn-sm delete-agenda-item-btn';
                deleteBtn.textContent = 'X';
                deleteBtn.setAttribute('aria-label', `${this.t('delete_btn')} ${item.título}`);
                listItem.appendChild(deleteBtn);
                list.appendChild(listItem);
            });
        } else {
            const p = document.createElement('p');
            p.className = 'text-muted';
            p.textContent = this.t('no_agenda_items');
            list.appendChild(p);
        }
        this.agendaPane.appendChild(list);
    }

    renderNotes(noteBlocks) {
        this.notasPane.innerHTML = `<h4>${this.t('notes_header')}</h4>`;

        const addNoteBlockBtn = document.createElement('button');
        addNoteBlockBtn.id = 'add-note-block-btn';
        addNoteBlockBtn.className = 'btn btn-primary btn-sm mb-3';
        addNoteBlockBtn.textContent = this.t('add_note_block_btn');
        this.notasPane.appendChild(addNoteBlockBtn);

        const noteBlocksContainer = document.createElement('div');
        noteBlocksContainer.id = 'note-blocks-container';

        if (noteBlocks.length > 0) {
            noteBlocks.forEach(nb => {
                const wrapper = document.createElement('div');
                wrapper.className = 'note-block-wrapper mb-3';
                wrapper.dataset.id = nb.id;
                wrapper.innerHTML = `
                    <div class="markdown-toolbar btn-group btn-group-sm" role="toolbar">
                        <button type="button" class="btn btn-outline-secondary" data-format="bold"><b>B</b></button>
                        <button type="button" class="btn btn-outline-secondary" data-format="italic"><i>I</i></button>
                        <button type="button" class="btn btn-outline-secondary" data-format="list-ul">- List</button>
                    </div>
                    <textarea class="form-control" rows="5">${nb.contenido}</textarea>
                    <div class="mt-1">
                        <button class="btn btn-success btn-sm save-note-block-btn">${this.t('save_btn')}</button>
                        <button class="btn btn-danger btn-sm delete-note-block-btn" aria-label="${this.t('delete_btn')}">${this.t('delete_btn')}</button>
                    </div>
                `;
                noteBlocksContainer.appendChild(wrapper);
            });
        } else {
            noteBlocksContainer.innerHTML = `<p class="text-muted">${this.t('no_notes_yet')}</p>`;
        }
        this.notasPane.appendChild(noteBlocksContainer);
    }

    renderTasks(tasks) {
        this.tareasPane.innerHTML = `<h4>${this.t('tasks_header')}</h4>`;

        const form = document.createElement('form');
        form.id = 'add-task-form';
        form.className = 'd-flex mb-3';
        form.innerHTML = `
            <input type="text" name="description" class="form-control me-2" placeholder="${this.t('new_task_placeholder')}" required>
            <select name="priority" class="form-select me-2" style="width: 120px;">
                <option value="L">${this.t('priority_low')}</option>
                <option value="M" selected>${this.t('priority_medium')}</option>
                <option value="H">${this.t('priority_high')}</option>
            </select>
            <button type="submit" class="btn btn-success btn-sm">${this.t('add_btn')}</button>
        `;
        this.tareasPane.appendChild(form);

        const list = document.createElement('div');
        list.className = 'list-group';

        if (tasks.length > 0) {
            tasks.forEach(task => {
                const item = document.createElement('div');
                item.className = 'list-group-item d-flex justify-content-between align-items-center';
                item.dataset.id = task.id;

                const priorityColors = { L: 'info', M: 'warning', H: 'danger' };
                item.innerHTML = `
                    <span>
                        <span class="badge bg-${priorityColors[task.prioridad] || 'secondary'} me-2">${task.prioridad}</span>
                        ${task.descripción}
                    </span>
                    <div>
                        <select class="form-select form-select-sm update-task-status me-2" style="width: 120px;">
                            <option value="ToDo" ${task.estado === 'ToDo' ? 'selected' : ''}>${this.t('status_todo')}</option>
                            <option value="Doing" ${task.estado === 'Doing' ? 'selected' : ''}>${this.t('status_doing')}</option>
                            <option value="Done" ${task.estado === 'Done' ? 'selected' : ''}>${this.t('status_done')}</option>
                        </select>
                        <button class="btn btn-danger btn-sm delete-task-btn" aria-label="${this.t('delete_btn')}">X</button>
                    </div>
                `;
                list.appendChild(item);
            });
        } else {
            list.innerHTML = `<p class="text-muted">${this.t('no_tasks_yet')}</p>`;
        }
        this.tareasPane.appendChild(list);
    }

    showEmptyView() {
        this.mainContentView.classList.add('d-none');
        this.emptyView.classList.remove('d-none');
    }

    bindSelectMeeting(handler) {
        this.meetingsList.addEventListener('click', event => {
            event.preventDefault();
            const item = event.target.closest('.list-group-item');
            if (item) handler(Number(item.dataset.id));
        });
    }

    bindNewMeeting(handler) {
        this.newMeetingBtn.addEventListener('click', handler);
    }

    bindAddAgendaItem(handler) {
        this.agendaPane.addEventListener('submit', event => {
            if (event.target.id === 'add-agenda-item-form') {
                event.preventDefault();
                const input = event.target.querySelector('input');
                if (input.value) {
                    handler(input.value);
                    input.value = '';
                }
            }
        });
    }

    bindDeleteAgendaItem(handler) {
        this.agendaPane.addEventListener('click', event => {
            if (event.target.classList.contains('delete-agenda-item-btn')) {
                handler(Number(event.target.closest('.list-group-item').dataset.id));
            }
        });
    }

    bindDragAndDropAgenda(handler) {
        const list = this.agendaPane.querySelector('.list-group');
        if (!list) return;
        let draggedItem = null;
        list.addEventListener('dragstart', e => {
            draggedItem = e.target;
            setTimeout(() => e.target.style.display = 'none', 0);
        });
        list.addEventListener('dragend', () => {
            setTimeout(() => { if(draggedItem) draggedItem.style.display = '' }, 0);
        });
        list.addEventListener('dragover', e => e.preventDefault());
        list.addEventListener('drop', e => {
            e.preventDefault();
            const target = e.target.closest('.list-group-item');
            if (target && draggedItem && target !== draggedItem) {
                const rect = target.getBoundingClientRect();
                const offsetY = e.clientY - rect.top;
                list.insertBefore(draggedItem, offsetY > target.offsetHeight / 2 ? target.nextSibling : target);
            }
            const updatedItems = Array.from(list.querySelectorAll('.list-group-item')).map((li, index) => ({
                id: Number(li.dataset.id),
                order: index,
            }));
            handler(updatedItems);
        });
    }

    bindNotesTabEvents(addNoteBlockHandler, saveNoteBlockHandler, deleteNoteBlockHandler) {
        this.notasPane.addEventListener('click', event => {
            const target = event.target;
            const wrapper = target.closest('.note-block-wrapper');
            if (target.id === 'add-note-block-btn') addNoteBlockHandler();
            else if (target.classList.contains('save-note-block-btn')) {
                const id = Number(wrapper.dataset.id);
                const textarea = wrapper.querySelector('textarea');
                saveNoteBlockHandler(id, textarea.value);
            } else if (target.classList.contains('delete-note-block-btn')) {
                deleteNoteBlockHandler(Number(wrapper.dataset.id));
            } else if (target.closest('.markdown-toolbar')) {
                const button = target.closest('button');
                if (button) {
                    const textarea = wrapper.querySelector('textarea');
                    this._applyMarkdown(textarea, button.dataset.format);
                }
            }
        });
    }

    _applyMarkdown(textarea, format) {
        const start = textarea.selectionStart;
        const end = textarea.selectionEnd;
        const selectedText = textarea.value.substring(start, end);
        let newText;
        switch (format) {
            case 'bold': newText = `**${selectedText}**`; break;
            case 'italic': newText = `*${selectedText}*`; break;
            case 'list-ul': newText = selectedText.split('\n').map(line => `- ${line}`).join('\n'); break;
            default: return;
        }
        textarea.setRangeText(newText, start, end, 'select');
        textarea.focus();
    }

    bindTasksTabEvents(addTaskHandler, updateTaskHandler, deleteTaskHandler) {
        this.tareasPane.addEventListener('submit', event => {
            if (event.target.id === 'add-task-form') {
                event.preventDefault();
                const form = event.target;
                const description = form.elements.description.value;
                const priority = form.elements.priority.value;
                if (description) {
                    addTaskHandler(description, priority);
                    form.reset();
                }
            }
        });
        this.tareasPane.addEventListener('click', event => {
            if (event.target.classList.contains('delete-task-btn')) {
                deleteTaskHandler(Number(event.target.closest('.list-group-item').dataset.id));
            }
        });
        this.tareasPane.addEventListener('change', event => {
            if (event.target.classList.contains('update-task-status')) {
                const item = event.target.closest('.list-group-item');
                updateTaskHandler(Number(item.dataset.id), { estado: event.target.value });
            }
        });
    }

    bindExportEvents(workspaceHandler, meetingJsonHandler, tasksCsvHandler, markdownHandler) {
        this.exportWorkspaceBtn.addEventListener('click', workspaceHandler);
        this.exportMeetingJsonBtn.addEventListener('click', meetingJsonHandler);
        this.exportTasksCsvBtn.addEventListener('click', tasksCsvHandler);
        this.exportMeetingMdBtn.addEventListener('click', markdownHandler);
    }
}
