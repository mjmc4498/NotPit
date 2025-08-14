// This module handles all DOM manipulation and rendering for the new layout.
export default class View {
    constructor() {
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
        // ... other panes would be referenced here as they are implemented
    }

    // --- RENDER METHODS ---

    /**
     * Renders the list of meetings in the sidebar.
     * @param {Array} meetings - The array of meeting objects to display.
     * @param {number|null} activeMeetingId - The ID of the currently selected meeting.
     */
    displayMeetingsInSidebar(meetings, activeMeetingId) {
        while (this.meetingsList.firstChild) {
            this.meetingsList.removeChild(this.meetingsList.firstChild);
        }

        if (meetings.length === 0) {
            const p = document.createElement('p');
            p.className = 'text-muted p-3';
            p.textContent = 'No meetings found.';
            this.meetingsList.appendChild(p);
        } else {
            meetings.forEach(meeting => {
                const item = document.createElement('li');
                item.className = 'list-group-item list-group-item-action';
                item.dataset.id = meeting.id;
                item.style.cursor = 'pointer'; // Make it look clickable
                item.innerHTML = `
                    <div class="d-flex w-100 justify-content-between">
                        <h6 class="mb-1">${meeting.título}</h6>
                    </div>
                    <small class="text-muted">${new Date(meeting.fechaInicio).toLocaleDateString()}</small>
                `;
                if (meeting.id === activeMeetingId) {
                    item.classList.add('active');
                }
                this.meetingsList.appendChild(item);
            });
        }
    }

    /**
     * Shows the main content area and populates it with meeting data.
     * @param {object} meeting - The meeting object to display.
     */
    showMeetingDetailView(meeting) {
        this.emptyView.classList.add('d-none');
        this.mainContentView.classList.remove('d-none');
        this.mainMeetingTitle.textContent = meeting.título;
        // The content of the tabs will be rendered by their own methods
    }

    renderAgenda(items) {
        this.agendaPane.innerHTML = '<h4>Agenda</h4>';

        // Form for adding new items
        const form = document.createElement('form');
        form.id = 'add-agenda-item-form';
        form.className = 'd-flex mb-3';
        form.innerHTML = `
            <input type="text" class="form-control me-2" placeholder="New agenda item..." required>
            <button type="submit" class="btn btn-success btn-sm">Add</button>
        `;
        this.agendaPane.appendChild(form);

        if (items.length === 0) {
            this.agendaPane.innerHTML += '<p class="text-muted">No agenda items yet.</p>';
            return;
        }

        const list = document.createElement('ul');
        list.className = 'list-group';

        items.sort((a, b) => a.order - b.order).forEach(item => {
            const listItem = document.createElement('li');
            listItem.className = 'list-group-item d-flex justify-content-between align-items-center';
            listItem.dataset.id = item.id;
            listItem.textContent = item.título;

            listItem.draggable = true; // Make item draggable
            const deleteBtn = document.createElement('button');
            deleteBtn.className = 'btn btn-danger btn-sm delete-agenda-item-btn';
            deleteBtn.textContent = 'X';
            deleteBtn.setAttribute('aria-label', `Delete agenda item: ${item.título}`);
            listItem.appendChild(deleteBtn);

            list.appendChild(listItem);
        });

        this.agendaPane.appendChild(list);
    }

    /**
     * Shows the empty state view when no meeting is selected.
     */
    showEmptyView() {
        this.mainContentView.classList.add('d-none');
        this.emptyView.classList.remove('d-none');
    }


    // --- BINDING METHODS ---

    /**
     * Binds a handler for when a meeting is selected from the sidebar.
     * @param {Function} handler - The function to call with the selected meeting's ID.
     */
    bindSelectMeeting(handler) {
        this.meetingsList.addEventListener('click', event => {
            event.preventDefault();
            const item = event.target.closest('.list-group-item');
            if (item) {
                const id = Number(item.dataset.id);
                handler(id);
            }
        });
    }

    /**
     * Binds a handler for the "New Meeting" button.
     * @param {Function} handler - The function to call when the button is clicked.
     */
    bindNewMeeting(handler) {
        this.newMeetingBtn.addEventListener('click', () => {
            handler();
        });
    }

    bindAddAgendaItem(handler) {
        // Use event delegation on the pane
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
                const li = event.target.closest('.list-group-item');
                const id = Number(li.dataset.id);
                handler(id);
            }
        });
    }

    renderNotes(noteBlocks) {
        this.notasPane.innerHTML = '<h4>Notes</h4>';

        const addNoteBlockBtn = document.createElement('button');
        addNoteBlockBtn.id = 'add-note-block-btn';
        addNoteBlockBtn.className = 'btn btn-primary btn-sm mb-3';
        addNoteBlockBtn.textContent = 'Add New Note Block';
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
                        <button class="btn btn-success btn-sm save-note-block-btn">Save</button>
                        <button class="btn btn-danger btn-sm delete-note-block-btn" aria-label="Delete this note block">Delete</button>
                    </div>
                `;
                noteBlocksContainer.appendChild(wrapper);
            });
        } else {
            noteBlocksContainer.innerHTML = '<p class="text-muted">No notes for this meeting yet.</p>';
        }
        this.notasPane.appendChild(noteBlocksContainer);
    }

    bindDragAndDropAgenda(handler) {
        const list = this.agendaPane.querySelector('.list-group');
        if (!list) return;

        let draggedItem = null;

        list.addEventListener('dragstart', e => {
            draggedItem = e.target;
            setTimeout(() => {
                e.target.style.display = 'none';
            }, 0);
        });

        list.addEventListener('dragend', e => {
            setTimeout(() => {
                draggedItem.style.display = '';
                draggedItem = null;
            }, 0);
        });

        list.addEventListener('dragover', e => {
            e.preventDefault();
        });

        list.addEventListener('drop', e => {
            e.preventDefault();
            const target = e.target.closest('.list-group-item');
            if (target && draggedItem && target !== draggedItem) {
                // Reorder the elements in the DOM
                const rect = target.getBoundingClientRect();
                const offsetY = e.clientY - rect.top;
                if (offsetY > target.offsetHeight / 2) {
                    list.insertBefore(draggedItem, target.nextSibling);
                } else {
                    list.insertBefore(draggedItem, target);
                }
            }
            // After dropping, get the new order and call the handler
            const updatedItems = [];
            list.querySelectorAll('.list-group-item').forEach((li, index) => {
                updatedItems.push({
                    id: Number(li.dataset.id),
                    order: index,
                });
            });
            handler(updatedItems);
        });
    }

    bindNotesTabEvents(addNoteBlockHandler, saveNoteBlockHandler, deleteNoteBlockHandler) {
        this.notasPane.addEventListener('click', event => {
            const target = event.target;

            if (target.id === 'add-note-block-btn') {
                addNoteBlockHandler();
            } else if (target.classList.contains('save-note-block-btn')) {
                const wrapper = target.closest('.note-block-wrapper');
                const id = Number(wrapper.dataset.id);
                const textarea = wrapper.querySelector('textarea');
                saveNoteBlockHandler(id, textarea.value);
            } else if (target.classList.contains('delete-note-block-btn')) {
                const wrapper = target.closest('.note-block-wrapper');
                const id = Number(wrapper.dataset.id);
                deleteNoteBlockHandler(id);
            } else if (target.closest('.markdown-toolbar')) {
                const button = target.closest('button');
                if (button) {
                    const format = button.dataset.format;
                    const wrapper = target.closest('.note-block-wrapper');
                    const textarea = wrapper.querySelector('textarea');
                    this._applyMarkdown(textarea, format);
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
            case 'bold':
                newText = `**${selectedText}**`;
                break;
            case 'italic':
                newText = `*${selectedText}*`;
                break;
            case 'list-ul':
                newText = selectedText.split('\n').map(line => `- ${line}`).join('\n');
                break;
            default:
                return;
        }

        textarea.setRangeText(newText, start, end, 'select');
        textarea.focus();
    }

    renderTasks(tasks) {
        this.tareasPane.innerHTML = '<h4>Tasks</h4>';

        const form = document.createElement('form');
        form.id = 'add-task-form';
        form.className = 'd-flex mb-3';
        form.innerHTML = `
            <input type="text" name="description" class="form-control me-2" placeholder="New task description..." required>
            <select name="priority" class="form-select me-2" style="width: 100px;">
                <option value="L">Low</option>
                <option value="M" selected>Medium</option>
                <option value="H">High</option>
            </select>
            <button type="submit" class="btn btn-success btn-sm">Add</button>
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
                            <option value="ToDo" ${task.estado === 'ToDo' ? 'selected' : ''}>To Do</option>
                            <option value="Doing" ${task.estado === 'Doing' ? 'selected' : ''}>Doing</option>
                            <option value="Done" ${task.estado === 'Done' ? 'selected' : ''}>Done</option>
                        </select>
                        <button class="btn btn-danger btn-sm delete-task-btn">X</button>
                    </div>
                `;
                list.appendChild(item);
            });
        } else {
            list.innerHTML = '<p class="text-muted">No tasks for this meeting yet.</p>';
        }
        this.tareasPane.appendChild(list);
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
                const item = event.target.closest('.list-group-item');
                const id = Number(item.dataset.id);
                deleteTaskHandler(id);
            }
        });

        this.tareasPane.addEventListener('change', event => {
            if (event.target.classList.contains('update-task-status')) {
                const item = event.target.closest('.list-group-item');
                const id = Number(item.dataset.id);
                const newStatus = event.target.value;
                updateTaskHandler(id, { estado: newStatus });
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
