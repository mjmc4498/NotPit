const locales = {
  en: {
    // Static UI
    sidebar_header: "NotPit Meetings",
    filter_meetings_placeholder: "Filter meetings...",
    new_meeting_btn: "New Meeting",
    import_btn: "Import",
    export_all_btn: "Export All",
    empty_view_header: "No Meeting Selected",
    empty_view_text: "Select a meeting from the sidebar or create a new one to get started.",
    export_dropdown: "Export",
    export_meeting_json: "Export Meeting (JSON)",
    export_meeting_md: "Export Notes (Markdown)",
    export_tasks_csv: "Export Tasks (CSV)",
    agenda_tab: "Agenda",
    notes_tab: "Notes",
    agreements_tab: "Agreements",
    decisions_tab: "Decisions",
    tasks_tab: "Tasks",
    app_title: "NotPit - Meeting Notes Manager",
    // Dynamic content
    no_meetings_found: "No meetings found.",
    agenda_header: "Agenda",
    new_agenda_item_placeholder: "New agenda item...",
    add_btn: "Add",
    no_agenda_items: "No agenda items yet.",
    notes_header: "Notes",
    add_note_block_btn: "Add Note Block",
    save_btn: "Save",
    delete_btn: "Delete",
    no_notes_yet: "No notes for this meeting yet.",
    tasks_header: "Tasks",
    new_task_placeholder: "New task description...",
    priority_low: "Low",
    priority_medium: "Medium",
    priority_high: "High",
    status_todo: "To Do",
    status_doing: "Doing",
    status_done: "Done",
    no_tasks_yet: "No tasks for this meeting yet.",
    // Controller messages
    confirm_delete_meeting: "Are you sure you want to delete the meeting '{title}'?",
    confirm_delete_agenda_item: "Are you sure you want to delete this agenda item?",
    confirm_delete_note_block: "Are you sure you want to delete this note block?",
    confirm_delete_task: "Are you sure you want to delete this task?",
    note_saved_success: "Note saved!",
    error_generic: "Error: {message}",
    export_meeting_select_prompt: "Please select a meeting to export.",
    export_tasks_select_prompt: "Please select a meeting to export tasks from.",
    export_no_tasks: "No tasks to export.",
    workspace_export_fail: "Failed to export workspace.",
    meeting_export_fail: "Failed to export meeting.",
    csv_export_fail: "Failed to export tasks as CSV.",
    markdown_export_fail: "Failed to export as Markdown.",
    new_meeting_title_default: "New Meeting",
    new_note_content_default: "New note...",
    meeting_header: "Meeting: {title}",
  },
  es: {
    // Static UI
    sidebar_header: "Reuniones de NotPit",
    filter_meetings_placeholder: "Filtrar reuniones...",
    new_meeting_btn: "Nueva Reunión",
    import_btn: "Importar",
    export_all_btn: "Exportar Todo",
    empty_view_header: "Ninguna Reunión Seleccionada",
    empty_view_text: "Selecciona una reunión de la barra lateral o crea una nueva para comenzar.",
    export_dropdown: "Exportar",
    export_meeting_json: "Exportar Reunión (JSON)",
    export_meeting_md: "Exportar Notas (Markdown)",
    export_tasks_csv: "Exportar Tareas (CSV)",
    agenda_tab: "Agenda",
    notes_tab: "Notas",
    agreements_tab: "Acuerdos",
    decisions_tab: "Decisiones",
    tasks_tab: "Tareas",
    app_title: "NotPit - Gestor de Notas de Reuniones",
    // Dynamic content
    no_meetings_found: "No se encontraron reuniones.",
    agenda_header: "Agenda",
    new_agenda_item_placeholder: "Nuevo punto de la agenda...",
    add_btn: "Añadir",
    no_agenda_items: "Aún no hay puntos en la agenda.",
    notes_header: "Notas",
    add_note_block_btn: "Añadir Bloque de Nota",
    save_btn: "Guardar",
    delete_btn: "Eliminar",
    no_notes_yet: "Aún no hay notas para esta reunión.",
    tasks_header: "Tareas",
    new_task_placeholder: "Descripción de nueva tarea...",
    priority_low: "Baja",
    priority_medium: "Media",
    priority_high: "Alta",
    status_todo: "Por Hacer",
    status_doing: "En Progreso",
    status_done: "Hecho",
    no_tasks_yet: "Aún no hay tareas para esta reunión.",
    // Controller messages
    confirm_delete_meeting: "¿Seguro que quieres eliminar la reunión '{title}'?",
    confirm_delete_agenda_item: "¿Seguro que quieres eliminar este punto de la agenda?",
    confirm_delete_note_block: "¿Seguro que quieres eliminar este bloque de nota?",
    confirm_delete_task: "¿Seguro que quieres eliminar esta tarea?",
    note_saved_success: "¡Nota guardada!",
    error_generic: "Error: {message}",
    export_meeting_select_prompt: "Por favor, selecciona una reunión para exportar.",
    export_tasks_select_prompt: "Por favor, selecciona una reunión para exportar las tareas.",
    export_no_tasks: "No hay tareas para exportar.",
    workspace_export_fail: "Falló la exportación del espacio de trabajo.",
    meeting_export_fail: "Falló la exportación de la reunión.",
    csv_export_fail: "Falló la exportación a CSV.",
    markdown_export_fail: "Falló la exportación a Markdown.",
    new_meeting_title_default: "Nueva Reunión",
    new_note_content_default: "Nueva nota...",
    meeting_header: "Reunión: {title}",
  }
};

let currentLanguage = 'es'; // Default to Spanish as requested

export function setLanguage(lang) {
  if (locales[lang]) {
    currentLanguage = lang;
  }
}

export function t(key, params = {}) {
  let str = locales[currentLanguage][key] || key;
  for (const param in params) {
    str = str.replace(new RegExp(`{${param}}`, 'g'), params[param]);
  }
  return str;
}
