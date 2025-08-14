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

    displayNotes(notes) {
        while (this.notesList.firstChild) {
            this.notesList.removeChild(this.notesList.firstChild);
        }

        if (notes.length === 0) {
            const p = document.createElement('p');
            p.className = 'text-muted';
            p.textContent = 'No notes yet. Create one!';
            this.notesList.appendChild(p);
        } else {
            notes.forEach(note => {
                const noteElement = document.createElement('div');
                noteElement.className = 'card mb-3';
                noteElement.setAttribute('data-id', note.id);
                noteElement.innerHTML = `
                    <div class="card-body">
                        <h5 class="card-title">${note.title}</h5>
                        <h6 class="card-subtitle mb-2 text-muted">${note.date}</h6>
                        <p class="card-text">${(note.agenda || '').substring(0, 100)}...</p>
                        <button class="btn btn-sm btn-success generate-summary-btn">Summary</button>
                        <button class="btn btn-sm btn-info view-edit-btn">View/Edit</button>
                        <button class="btn btn-sm btn-danger delete-btn">Delete</button>
                    </div>
                `;
                this.notesList.appendChild(noteElement);
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

    displaySummaryModal(note) {
        const summaryTitle = `Summary for: ${note.title} (${note.date})`;
        this.summaryModalEl.querySelector('#summaryModalLabel').textContent = summaryTitle;

        const sections = [
            { title: 'Agenda', content: note.agenda },
            { title: 'Structured Notes', content: note.notes },
            { title: 'Agreements', content: note.agreements },
            { title: 'Decisions', content: note.decisions },
            { title: 'Tasks', content: note.tasks },
        ];

        let htmlContent = sections.map(section => {
            if (!section.content) return '';
            return `<h4>${section.title}</h4><p>${this._formatTextForDisplay(section.content)}</p>`;
        }).join('');

        if (note.attachments && note.attachments.length > 0) {
            htmlContent += '<h4>Attachments</h4>';
            const attachmentList = note.attachments.map(file => {
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

    getNoteData() {
        const noteData = {
            title: this.meetingTitle.value,
            date: this.meetingDate.value,
            agenda: this.meetingAgenda.value,
            notes: this.meetingNotes.value,
            agreements: this.meetingAgreements.value,
            decisions: this.meetingDecisions.value,
            tasks: this.meetingTasks.value,
            attachments: this._temporaryNoteState.attachments || [],
        };
        const editingId = this.getEditingId();
        if (editingId) {
            noteData.id = Number(editingId);
        }
        return noteData;
    }

    getEditingId() {
        return this.editingNoteIdInput.value;
    }

    getNewAttachments() {
        return Array.from(this.attachmentInput.files);
    }

    populateForm(note) {
        this.meetingTitle.value = note.title;
        this.meetingDate.value = note.date;
        this.meetingAgenda.value = note.agenda;
        this.meetingNotes.value = note.notes;
        this.meetingAgreements.value = note.agreements;
        this.meetingDecisions.value = note.decisions;
        this.meetingTasks.value = note.tasks;
        this.editingNoteIdInput.value = note.id;
        this._temporaryNoteState.attachments = note.attachments || [];
        this.renderCurrentAttachments();

        this.saveBtn.textContent = 'Update Note';
        this.saveBtn.classList.remove('btn-primary');
        this.saveBtn.classList.add('btn-success');
        this.cancelEditBtn.classList.remove('d-none');
    }

    resetForm() {
        this.noteForm.reset();
        this.editingNoteIdInput.value = '';
        this.saveBtn.textContent = 'Save Note';
        this.saveBtn.classList.remove('btn-success');
        this.saveBtn.classList.add('btn-primary');
        this.cancelEditBtn.classList.add('d-none');
        this._temporaryNoteState = { attachments: [] };
        this.attachmentsListContainer.innerHTML = '';
    }

    setSaveButtonState(isSaving) {
        this.saveBtn.disabled = isSaving;
        this.saveBtn.textContent = isSaving ? 'Saving...' : (this.getEditingId() ? 'Update Note' : 'Save Note');
    }

    // --- BINDING METHODS ---

    bindAddOrUpdateNote(handler) {
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
        this.copySummaryBtn.addEventListener('click', () => {
            copyHandler();
        });
        this.printSummaryBtn.addEventListener('click', () => {
            document.body.classList.add('printing-summary');
            window.print();
        });
        window.addEventListener('afterprint', () => {
            document.body.classList.remove('printing-summary');
        });
    }
}
