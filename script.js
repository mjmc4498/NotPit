// NotPit application script

document.addEventListener('DOMContentLoaded', () => {
    console.log('NotPit App Loaded');

    // --- Element References ---
    const noteForm = document.getElementById('note-form');
    const notesList = document.getElementById('notes-list');
    const editingNoteIdInput = document.getElementById('editing-note-id');
    const saveBtn = document.getElementById('save-btn');
    const cancelEditBtn = document.getElementById('cancel-edit-btn');
    const attachmentsListContainer = document.getElementById('attachments-list-container');

    let currentAttachments = [];

    // --- Helper Functions for Form State ---

    function renderCurrentAttachments() {
        attachmentsListContainer.innerHTML = '';
        if (currentAttachments.length === 0) return;

        const list = document.createElement('ul');
        list.className = 'list-group';

        currentAttachments.forEach((file, index) => {
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
        attachmentsListContainer.appendChild(list);
    }

    function populateFormForEdit(note) {
        currentAttachments = note.attachments || [];
        renderCurrentAttachments();
        document.getElementById('meeting-title').value = note.title;
        document.getElementById('meeting-date').value = note.date;
        document.getElementById('meeting-agenda').value = note.agenda;
        document.getElementById('meeting-notes').value = note.notes;
        document.getElementById('meeting-agreements').value = note.agreements;
        document.getElementById('meeting-decisions').value = note.decisions;
        document.getElementById('meeting-tasks').value = note.tasks;
        editingNoteIdInput.value = note.id;

        saveBtn.textContent = 'Update Note';
        saveBtn.classList.remove('btn-primary');
        saveBtn.classList.add('btn-success');
        cancelEditBtn.classList.remove('d-none');
    }

    function resetFormMode() {
        noteForm.reset();
        editingNoteIdInput.value = '';
        saveBtn.textContent = 'Save Note';
        saveBtn.classList.remove('btn-success');
        saveBtn.classList.add('btn-primary');
        cancelEditBtn.classList.add('d-none');

        currentAttachments = [];
        attachmentsListContainer.innerHTML = '';
        document.getElementById('meeting-attachments').value = '';
    }

    // --- Event Listeners ---

    // Listener for removing existing attachments from the UI
    attachmentsListContainer.addEventListener('click', (e) => {
        if (e.target.classList.contains('remove-attachment-btn')) {
            const index = Number(e.target.getAttribute('data-index'));
            currentAttachments.splice(index, 1);
            renderCurrentAttachments();
        }
    });

    // Form Submission (Create or Update)
    noteForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        saveBtn.disabled = true;
        saveBtn.textContent = 'Saving...';

        try {
            const attachmentInput = document.getElementById('meeting-attachments');
            const files = Array.from(attachmentInput.files);

            const newlyReadAttachments = await Promise.all(files.map(readFileAsBase64));

            const finalAttachments = [...currentAttachments, ...newlyReadAttachments];

            const noteData = {
                title: document.getElementById('meeting-title').value,
                date: document.getElementById('meeting-date').value,
                agenda: document.getElementById('meeting-agenda').value,
                notes: document.getElementById('meeting-notes').value,
                agreements: document.getElementById('meeting-agreements').value,
                decisions: document.getElementById('meeting-decisions').value,
                tasks: document.getElementById('meeting-tasks').value,
                attachments: finalAttachments,
            };

            const editingId = editingNoteIdInput.value;
            let notes = getNotes();

            if (editingId) {
                // Update existing note
                const noteIndex = notes.findIndex(note => note.id === Number(editingId));
                if (noteIndex > -1) {
                    notes[noteIndex] = {
                        ...notes[noteIndex],
                        ...noteData,
                    };
                }
            } else {
                // Create new note
                const newNote = {
                    id: Date.now(),
                    ...noteData,
                };
                notes.push(newNote);
            }

            saveNotes(notes);
            resetFormMode();
            renderNotes();

        } catch (error) {
            alert(`Error saving note: ${error.message}`);
        } finally {
            saveBtn.disabled = false;
            // The button text will be reset by resetFormMode(), which is called in the try block
            if (saveBtn.textContent === 'Saving...') {
                 saveBtn.textContent = 'Save Note'; // Reset if error happened before resetFormMode
            }
        }
    });

    // Notes List Clicks (Delegated)
    notesList.addEventListener('click', (e) => {
        const card = e.target.closest('.card');
        if (!card) return;
        const noteId = Number(card.getAttribute('data-id'));
        const notes = getNotes();
        const note = notes.find(n => n.id === noteId);
        if (!note) return;

        // Handle View/Edit
        if (e.target.classList.contains('view-edit-btn')) {
            populateFormForEdit(note);
        }
        // Handle Delete
        else if (e.target.classList.contains('delete-btn')) {
            if (confirm(`Are you sure you want to delete the note "${note.title}"?`)) {
                let updatedNotes = notes.filter(n => n.id !== noteId);
                saveNotes(updatedNotes);
                if (editingNoteIdInput.value === String(noteId)) {
                    resetFormMode();
                }
                renderNotes();
            }
        }
        // Handle Generate Summary
        else if (e.target.classList.contains('generate-summary-btn')) {
            openSummaryModal(note);
        }
    });

    // Cancel Edit Button
    cancelEditBtn.addEventListener('click', resetFormMode);

    // --- Summary Modal Logic ---
    const summaryModalEl = document.getElementById('summaryModal');
    const summaryModal = new bootstrap.Modal(summaryModalEl);
    const summaryContentEl = document.getElementById('summary-content');
    const copySummaryBtn = document.getElementById('copy-summary-btn');
    const printSummaryBtn = document.getElementById('print-summary-btn');
    let plainTextSummary = ''; // To hold the text version for copying

    function formatTextForDisplay(text) {
        return text.replace(/\n/g, '<br>');
    }

    function openSummaryModal(note) {
        const summaryTitle = `Summary for: ${note.title} (${note.date})`;
        summaryModalEl.querySelector('#summaryModalLabel').textContent = summaryTitle;

        const sections = [
            { title: 'Agenda', content: note.agenda },
            { title: 'Structured Notes', content: note.notes },
            { title: 'Agreements', content: note.agreements },
            { title: 'Decisions', content: note.decisions },
            { title: 'Tasks', content: note.tasks },
        ];

        // Generate HTML for modal
        let htmlContent = sections.map(section => {
            if (!section.content) return '';
            return `<h4>${section.title}</h4><p>${formatTextForDisplay(section.content)}</p>`;
        }).join('');

        // Handle Attachments
        if (note.attachments && note.attachments.length > 0) {
            htmlContent += '<h4>Attachments</h4>';
            const attachmentList = note.attachments.map(file => {
                const isImage = file.filetype.startsWith('image/');
                const preview = isImage ? `<img src="${file.data}" alt="${file.filename}" style="max-width: 100px; max-height: 100px; display: block; margin-bottom: 5px;">` : '';
                return `<li>${preview}<a href="${file.data}" download="${file.filename}">${file.filename}</a></li>`;
            }).join('');
            htmlContent += `<ul>${attachmentList}</ul>`;
        }
        summaryContentEl.innerHTML = htmlContent;


        // Generate plain text for clipboard
        plainTextSummary = `Meeting Minutes: ${note.title}\nDate: ${note.date}\n\n` +
            sections.map(section => {
                if (!section.content) return '';
                return `--- ${section.title.toUpperCase()} ---\n${section.content}\n`;
            }).join('\n');

        if (note.attachments && note.attachments.length > 0) {
            plainTextSummary += '\n--- ATTACHMENTS ---\n' + note.attachments.map(f => f.filename).join('\n');
        }

        summaryModal.show();
    }

    copySummaryBtn.addEventListener('click', () => {
        navigator.clipboard.writeText(plainTextSummary).then(() => {
            copySummaryBtn.textContent = 'Copied!';
            setTimeout(() => { copySummaryBtn.textContent = 'Copy Text'; }, 2000);
        }).catch(err => {
            console.error('Failed to copy text: ', err);
            alert('Failed to copy text.');
        });
    });

    printSummaryBtn.addEventListener('click', () => {
        document.body.classList.add('printing-summary');
        window.print();
    });

    // Remove print class after printing is done or cancelled
    window.addEventListener('afterprint', () => {
        document.body.classList.remove('printing-summary');
    });

    // --- Import/Export Listeners ---
    const exportBtn = document.getElementById('export-btn');
    const importBtn = document.getElementById('import-btn');
    const importFileInput = document.getElementById('import-file-input');

    // Export Button
    exportBtn.addEventListener('click', () => {
        const notes = getNotes();
        if (notes.length === 0) {
            alert('No notes to export.');
            return;
        }

        const dataStr = JSON.stringify(notes, null, 2);
        const dataBlob = new Blob([dataStr], { type: 'application/json' });
        const url = URL.createObjectURL(dataBlob);

        const link = document.createElement('a');
        link.href = url;
        link.download = `notpit-backup-${new Date().toISOString().split('T')[0]}.json`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    });

    // Import Button - Triggers file input
    importBtn.addEventListener('click', () => {
        importFileInput.click();
    });

    // File Input - Handles import
    importFileInput.addEventListener('change', (event) => {
        const file = event.target.files[0];
        if (!file) {
            return;
        }

        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const importedNotes = JSON.parse(e.target.result);

                // Basic validation
                if (!Array.isArray(importedNotes)) {
                    throw new Error('Invalid format: Not an array.');
                }

                if (confirm('This will overwrite all current notes. Are you sure you want to continue?')) {
                    saveNotes(importedNotes);
                    renderNotes();
                    resetFormMode(); // In case a note was being edited
                    alert('Notes imported successfully!');
                }
            } catch (error) {
                alert(`Error importing file: ${error.message}`);
            } finally {
                // Reset file input to allow re-importing the same file
                importFileInput.value = '';
            }
        };
        reader.readAsText(file);
    });

    // --- Initial Render ---
    renderNotes();
});

function readFileAsBase64(file) {
    return new Promise((resolve, reject) => {
        // Size check
        if (file.size > 2 * 1024 * 1024) { // 2MB limit
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

/**
 * Retrieves all notes from localStorage.
 * @returns {Array} An array of note objects.
 */
function getNotes() {
    const notes = localStorage.getItem('notpit-notes');
    return notes ? JSON.parse(notes) : [];
}

/**
 * Saves an array of notes to localStorage.
 * @param {Array} notes The array of notes to save.
 */
function saveNotes(notes) {
    localStorage.setItem('notpit-notes', JSON.stringify(notes));
}

/**
 * Renders the list of notes to the page.
 */
function renderNotes() {
    const notes = getNotes();
    const notesList = document.getElementById('notes-list');
    notesList.innerHTML = ''; // Clear existing notes

    if (notes.length === 0) {
        notesList.innerHTML = '<p class="text-muted">No notes yet. Create one!</p>';
        return;
    }

    notes.forEach(note => {
        const noteElement = document.createElement('div');
        noteElement.classList.add('card', 'mb-3');
        noteElement.setAttribute('data-id', note.id);

        noteElement.innerHTML = `
            <div class="card-body">
                <h5 class="card-title">${note.title}</h5>
                <h6 class="card-subtitle mb-2 text-muted">${note.date}</h6>
                <p class="card-text">${note.agenda.substring(0, 100)}...</p>
                <button class="btn btn-sm btn-success generate-summary-btn">Summary</button>
                <button class="btn btn-sm btn-info view-edit-btn">View/Edit</button>
                <button class="btn btn-sm btn-danger delete-btn">Delete</button>
            </div>
        `;
        notesList.appendChild(noteElement);
    });
}

// Note object structure for reference:
/*
const note = {
    id: Date.now(),
    title: 'Meeting Title',
    date: '2025-08-13',
    agenda: '...',
    notes: '...',
    agreements: '...',
    decisions: '...',
    tasks: '...'
};
*/
