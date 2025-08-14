// This module handles all DOM manipulation and rendering.
export default class View {
    constructor() {
        // --- Form Elements ---
        this.noteForm = document.getElementById('note-form');
        this.meetingTitle = document.getElementById('meeting-title');
        this.meetingDate = document.getElementById('meeting-date');
        this.meetingAgenda = document.getElementById('meeting-agenda');
        this.meetingNotes = document.getElementById('meeting-notes');
        this.meetingAgreements = document.getElementById('meeting-agreements');
        this.meetingDecisions = document.getElementById('meeting-decisions');
        this.meetingTasks = document.getElementById('meeting-tasks');
        this.attachmentInput = document.getElementById('meeting-attachments');
        this.attachmentsListContainer = document.getElementById('attachments-list-container');
        this.editingNoteIdInput = document.getElementById('editing-note-id');
        this.saveBtn = document.getElementById('save-btn');
        this.cancelEditBtn = document.getElementById('cancel-edit-btn');

        // --- Notes List ---
        this.notesList = document.getElementById('notes-list');

        // --- Import/Export ---
        this.importBtn = document.getElementById('import-btn');
        this.importFileInput = document.getElementById('import-file-input');
        this.exportBtn = document.getElementById('export-btn');

        // --- Summary Modal ---
        this.summaryModalEl = document.getElementById('summaryModal');
        this.summaryModal = new bootstrap.Modal(this.summaryModalEl);
        this.summaryContentEl = document.getElementById('summary-content');
        this.copySummaryBtn = document.getElementById('copy-summary-btn');
        this.printSummaryBtn = document.getElementById('print-summary-btn');

        this._temporaryNoteState = { attachments: [] };
    }

    // --- RENDER METHODS ---

    displayMeetings(meetings) {
        while (this.notesList.firstChild) {
            this.notesList.removeChild(this.notesList.firstChild);
        }

        if (meetings.length === 0) {
            const p = document.createElement('p');
            p.className = 'text-muted';
            p.textContent = 'No meetings yet. Create one!';
            this.notesList.appendChild(p);
        } else {
            meetings.forEach(meeting => {
                const meetingElement = document.createElement('div');
                meetingElement.className = 'card mb-3';
                meetingElement.setAttribute('data-id', meeting.id);
                meetingElement.innerHTML = `
                    <div class="card-body">
                        <h5 class="card-title">${meeting.título}</h5>
                        <h6 class="card-subtitle mb-2 text-muted">${new Date(meeting.fechaInicio).toLocaleString()}</h6>
                        <p class="card-text">Attachments: ${meeting.adjuntos ? meeting.adjuntos.length : 0}</p>
                        <button class="btn btn-sm btn-success generate-summary-btn">Summary</button>
                        <button class="btn btn-sm btn-info view-edit-btn">View/Edit</button>
                        <button class="btn btn-sm btn-danger delete-btn">Delete</button>
                    </div>
                `;
                this.notesList.appendChild(meetingElement);
            });
        }
    }

    renderCurrentAttachments() {
        this.attachmentsListContainer.innerHTML = '';
        const attachments = this._temporaryNoteState.attachments || [];
        if (attachments.length === 0) return;

        const list = document.createElement('ul');
        list.className = 'list-group';

        attachments.forEach((file, index) => {
            const listItem = document.createElement('li');
            listItem.className = 'list-group-item d-flex justify-content-between align-items-center';
            listItem.textContent = file.filename;

            const removeBtn = document.createElement('button');
            removeBtn.type = 'button';
            removeBtn.className = 'btn btn-danger btn-sm remove-attachment-btn';
            removeBtn.textContent = 'Remove';
            removeBtn.setAttribute('data-index', index);

            listItem.appendChild(removeBtn);
            list.appendChild(listItem);
        });
        this.attachmentsListContainer.appendChild(list);
    }

    _formatTextForDisplay(text) {
        return text ? text.replace(/\n/g, '<br>') : '';
    }

    displaySummaryModal(meeting, noteBlocks) {
        const summaryTitle = `Summary for: ${meeting.título} (${new Date(meeting.fechaInicio).toLocaleDateString()})`;
        this.summaryModalEl.querySelector('#summaryModalLabel').textContent = summaryTitle;

        let htmlContent = '';
        noteBlocks.forEach(nb => {
            htmlContent += `<h4>${nb.tipo}</h4><p>${this._formatTextForDisplay(nb.contenido)}</p>`
        });

        if (meeting.adjuntos && meeting.adjuntos.length > 0) {
            htmlContent += '<h4>Attachments</h4>';
            const attachmentList = meeting.adjuntos.map(file => {
                const isImage = file.filetype.startsWith('image/');
                const preview = isImage ? `<img src="${file.data}" alt="${file.filename}" style="max-width: 100px; max-height: 100px; display: block; margin-bottom: 5px;">` : '';
                return `<li>${preview}<a href="${file.data}" download="${file.filename}">${file.filename}</a></li>`;
            }).join('');
            htmlContent += `<ul>${attachmentList}</ul>`;
        }
        this.summaryContentEl.innerHTML = htmlContent;
        this.summaryModal.show();
    }

    // --- FORM HANDLING ---

    getMeetingData() {
        const meetingData = {
            título: this.meetingTitle.value,
            fechaInicio: new Date(this.meetingDate.value).toISOString(),
            // For simplicity, we'll keep other meeting fields static for now
            timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
            ubicación: '', virtualLink: '', etiquetas: [], participantes: [],
            agenda: [], tareas: [], acuerdos: [], decisiones: [],
            adjuntos: this._temporaryNoteState.attachments || [],
        };

        const noteBlocks = [
            { type: 'agenda', content: this.meetingAgenda.value },
            { type: 'notes', content: this.meetingNotes.value },
            { type: 'agreements', content: this.meetingAgreements.value },
            { type: 'decisions', content: this.meetingDecisions.value },
            { type: 'tasks', content: this.meetingTasks.value },
        ];

        const editingId = this.getEditingId();
        if (editingId) {
            meetingData.id = Number(editingId);
        }

        return { meetingData, noteBlocks };
    }

    getEditingId() {
        return this.editingNoteIdInput.value;
    }

    getNewAttachments() {
        return Array.from(this.attachmentInput.files);
    }

    populateForm(meeting, noteBlocks) {
        this.resetForm();
        this.meetingTitle.value = meeting.título;
        this.meetingDate.value = meeting.fechaInicio.substring(0, 16); // Format for datetime-local input

        noteBlocks.forEach(nb => {
            if (nb.tipo === 'agenda') this.meetingAgenda.value = nb.contenido;
            if (nb.tipo === 'notes') this.meetingNotes.value = nb.contenido;
            if (nb.tipo === 'agreements') this.meetingAgreements.value = nb.contenido;
            if (nb.tipo === 'decisions') this.meetingDecisions.value = nb.contenido;
            if (nb.tipo === 'tasks') this.meetingTasks.value = nb.contenido;
        });

        this.editingNoteIdInput.value = meeting.id;
        this._temporaryNoteState.attachments = meeting.adjuntos || [];
        this.renderCurrentAttachments();

        this.saveBtn.textContent = 'Update Meeting';
        this.saveBtn.classList.remove('btn-primary');
        this.saveBtn.classList.add('btn-success');
        this.cancelEditBtn.classList.remove('d-none');
    }

    resetForm() {
        this.noteForm.reset();
        this.editingNoteIdInput.value = '';
        this.saveBtn.textContent = 'Save Meeting';
        this.saveBtn.classList.remove('btn-success');
        this.saveBtn.classList.add('btn-primary');
        this.cancelEditBtn.classList.add('d-none');
        this._temporaryNoteState = { attachments: [] };
        this.attachmentsListContainer.innerHTML = '';
    }

    setSaveButtonState(isSaving) {
        this.saveBtn.disabled = isSaving;
        this.saveBtn.textContent = isSaving ? 'Saving...' : (this.getEditingId() ? 'Update Meeting' : 'Save Meeting');
    }

    // --- BINDING METHODS ---

    bindAddOrUpdateMeeting(handler) {
        this.noteForm.addEventListener('submit', event => {
            event.preventDefault();
            handler();
        });
    }

    bindCancelEdit(handler) {
        this.cancelEditBtn.addEventListener('click', () => handler());
    }

    bindNotesListEvents(viewHandler, deleteHandler, summaryHandler) {
        this.notesList.addEventListener('click', event => {
            const card = event.target.closest('.card');
            if (!card) return;
            const id = Number(card.dataset.id);

            if (event.target.classList.contains('view-edit-btn')) {
                viewHandler(id);
            } else if (event.target.classList.contains('delete-btn')) {
                deleteHandler(id);
            } else if (event.target.classList.contains('generate-summary-btn')) {
                summaryHandler(id);
            }
        });
    }

    bindAttachmentEvents(removeHandler) {
        this.attachmentsListContainer.addEventListener('click', e => {
            if (e.target.classList.contains('remove-attachment-btn')) {
                const index = Number(e.target.dataset.index);
                this._temporaryNoteState.attachments.splice(index, 1);
                removeHandler();
            }
        });
    }

    bindImport(handler) {
        this.importBtn.addEventListener('click', () => this.importFileInput.click());
        this.importFileInput.addEventListener('change', event => {
            const file = event.target.files[0];
            if (file) {
                handler(file);
                this.importFileInput.value = '';
            }
        });
    }

    bindExport(handler) {
        this.exportBtn.addEventListener('click', () => handler());
    }

    bindSummaryModalEvents(copyHandler, printHandler) {
        this.copySummaryBtn.addEventListener('click', () => copyHandler());
        this.printSummaryBtn.addEventListener('click', () => {
            document.body.classList.add('printing-summary');
            window.print();
        });
        window.addEventListener('afterprint', () => {
            document.body.classList.remove('printing-summary');
        });
    }
}
