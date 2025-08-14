# NotPit

NotPit es una aplicación de página única (SPA) diseñada para ser un gestor de notas de reuniones robusto, seguro y centrado en la privacidad. Funciona completamente offline y todos los datos se guardan exclusivamente en el dispositivo del usuario, garantizando que la información nunca abandone su equipo.

## Características Principales

- **Offline-First**: La aplicación está diseñada para funcionar sin conexión a internet. Es una PWA (Progressive Web App) que puede ser "instalada" en tu escritorio o pantalla de inicio.
- **100% Local y Privado**: Todos los datos se almacenan localmente en tu navegador usando IndexedDB. Nada se envía a ningún servidor.
- **Encriptación Opcional**: Ofrece la posibilidad de encriptar todo el espacio de trabajo con una contraseña usando el algoritmo AES-GCM. ¡Si olvidas tu contraseña, los datos serán irrecuperables!
- **Gestión de Reuniones**: Crea, renombra y elimina reuniones.
- **Notas Estructuradas**: Cada reunión se organiza en pestañas para una gestión clara de la información:
    - **Agenda**: Planifica los puntos a tratar.
    - **Notas**: Toma notas en formato de texto enriquecido (Markdown).
    - **Tareas**: Gestiona tareas con prioridades y fechas de inicio/fin.
    - **Acuerdos**: Registra los acuerdos alcanzados.
    - **Decisiones**: Documenta las decisiones tomadas.
- **Trazabilidad y Confianza**:
    - **Decision Ledger**: Cada decisión forma parte de una cadena de hash criptográfica (blockchain-like) para garantizar su integridad.
    - **Firma de Acuerdos**: Los acuerdos pueden ser "firmados" con una contraseña para registrar el compromiso.
    - **Vista de Auditoría**: Permite verificar la integridad de la cadena de decisiones.
- **Planificación Visual**:
    - **Diagrama de Gantt**: Visualiza las tareas de una reunión en un diagrama de Gantt interactivo.
- **Importación y Exportación**:
    - Exporta e importa todo tu espacio de trabajo en formato JSON.
    - Exporta reuniones individuales en JSON, notas en Markdown y tareas en CSV.

## Tecnología Utilizada

- **HTML5, CSS3, JavaScript (ES6 Modules)**: Sin frameworks, solo vainilla JS moderno.
- **Bootstrap 5**: Para un diseño responsive y componentes de UI.
- **Bootstrap Icons**: Para la iconografía de la interfaz.
- **Frappe Gantt**: Para la visualización del diagrama de Gantt.
- **IndexedDB**: Para el almacenamiento local de la base de datos.
- **Service Worker**: Para las capacidades offline (PWA).
- **Web Crypto API**: Para todas las operaciones criptográficas (hashing, encriptación, firmas).

## Instalación y Uso

No se requiere instalación. La aplicación está diseñada para funcionar directamente en cualquier navegador web moderno.

1.  **Opción 1 (Recomendada): Servidor Local**
    -   Usa cualquier servidor web estático para servir los ficheros. Un ejemplo simple con Python es:
        ```bash
        python -m http.server
        ```
    -   Abre tu navegador y ve a `http://localhost:8000`.

2.  **Opción 2: Abrir Fichero Localmente**
    -   Simplemente abre el fichero `index.html` en tu navegador.
    -   **Nota**: Algunas funcionalidades, como el Service Worker, pueden tener un comportamiento restringido en algunos navegadores cuando se abren directamente desde el sistema de ficheros (`file:///`).

## Guía Rápida de Uso

### 1. Crear una Reunión
- Haz clic en el botón **"Nueva Reunión"** en la barra lateral.
- Introduce un título y, si lo deseas, selecciona una plantilla de agenda.
- La nueva reunión aparecerá en la barra lateral.

### 2. Gestionar una Reunión
- Selecciona una reunión de la lista para ver sus detalles.
- Usa las pestañas (**Agenda**, **Notas**, **Tareas**, etc.) para añadir y gestionar la información.
- Para **renombrar** una reunión, haz clic en el icono del lápiz <i class="bi bi-pencil"></i> junto al título.
- Para **eliminar** una reunión, haz clic en el icono de la papelera <i class="bi bi-trash"></i> en la lista de la barra lateral.

### 3. Seguridad y Encriptación
- Haz clic en el botón de **Ajustes** <i class="bi bi-gear"></i> en la barra lateral.
- En el modal, puedes habilitar la encriptación estableciendo una contraseña.
- **¡ADVERTENCIA!**: Esta acción es irreversible. Si olvidas tu contraseña, no hay forma de recuperar tus datos.
- Una vez la encriptación está activada, la aplicación se bloqueará cada vez que la abras. Deberás introducir tu contraseña para acceder.
- Puedes usar el botón **Bloquear** <i class="bi bi-lock"></i> para bloquear manualmente tu sesión.

### 4. Importar y Exportar
- **Exportar Todo**: Usa el botón <i class="bi bi-box-arrow-up"></i> en la barra lateral para descargar un fichero JSON con todos tus datos.
- **Exportar Reunión Individual**: Dentro de una reunión, usa el menú desplegable de descarga <i class="bi bi-download"></i> para exportar la reunión en diferentes formatos (JSON, Markdown, CSV).
- **Importar**: Usa el botón <i class="bi bi-box-arrow-in-down"></i> para cargar un fichero JSON previamente exportado y restaurar tus datos.
