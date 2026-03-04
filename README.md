# 📅 iOS Calendar for Windows

Una aplicación de escritorio moderna que trae la experiencia estética y funcional del calendario de iOS a Windows. Construida con tecnologías web de vanguardia, esta agenda ofrece un sistema completo para gestionar **eventos, tareas y notas**, con soporte nativo para **sincronización bidireccional con iCloud**.

## ✨ Características Principales

**☁️ Sincronización Total con iCloud (CalDAV)**

- **Conexión Bidireccional:** Inicia sesión de forma segura (con Contraseña de Aplicación) para ver, crear, editar y eliminar eventos directamente en tus servidores de Apple.
- **Smart Sync:** Se sincroniza en segundo plano de forma inteligente (_Fetch on Focus_) al volver a la ventana, con protección contra saturación de red.
- **Gestión de Recurrencias:** Soporte avanzado para borrar o editar una única instancia de un evento repetitivo o la serie completa.
- **Apple Reminders:** Sincronización integrada de tus recordatorios de iOS (soporte VTODO).
- **Colores Personalizados:** Soporta la inyección de colores personalizados mediante etiquetas `<COLOR:#HEX>` en la descripción de iCloud.

**🎨 Interfaz iOS Premium & Vistas de Calendario**

- **Estética Apple:** Diseño _Glassmorphism_, modo oscuro/claro dinámico y barra de título personalizada (sin bordes nativos de Windows) con controles estilo Mac.
- **4 Vistas Interactivas:** - _Año:_ Cuadrícula térmica con salto rápido.
  - _Mes:_ Eventos continuos en formato "píldora".
  - _Semana & Día:_ Líneas de tiempo precisas con cálculo inteligente de solapamientos visuales.
- **Selectores iOS:** Tambores giratorios (_TimeSelector_) recreados desde cero para elegir horas y minutos al más puro estilo iPhone.
- **Navegación Fluida:** Soporte nativo para cambio de páginas mediante scroll, gestos de touchpad, deslizamiento táctil (_swipe_) y atajos de teclado.

**✅ Productividad: Tareas y Notas**

- **Gestor de Tareas Avanzado:** Crea tareas padre e infinitas subtareas desplegables con seguimiento de progreso. Limpia las tareas completadas con un solo clic.
- **Notas (Post-its):** Tablón de notas personalizables por color. Soporte para fijar notas importantes (_Pin_) en la parte superior.
- **Notificaciones de Escritorio:** Alertas nativas del sistema que te avisan antes de que comience un evento, según los recordatorios configurados.

**🔍 Búsqueda Global y Arquitectura**

- **Spotlight para Windows (Omnibar):** Presiona **`Ctrl + K`** (o `Cmd + K`) para abrir el buscador global interactivo y encontrar al instante eventos, tareas o notas.
- **Offline-First:** Construida sobre _Dexie.js_ (IndexedDB). Si te quedas sin internet, la app sigue funcionando al 100%. Tus datos locales siempre están seguros.

## 🛠️ Stack Tecnológico

El proyecto está desarrollado con las siguientes herramientas principales:

- **Frontend:** React 18, Vite y Tailwind CSS.
- **Entorno de Escritorio:** Electron (utilizando `vite-plugin-electron` para una integración fluida con Vite).
- **Base de Datos Local:** IndexedDB a través de **Dexie.js**, gestionando las tablas de `events`, `tasks` y `notes` de forma reactiva con `dexie-react-hooks`.
- **Sincronización iCloud:** Peticiones HTTP a través de un proxy IPC (`icloudRequest`) en Electron para evadir el CORS, parseo de XML con `fast-xml-parser` y manejo del formato iCal con `ical.js`.
- **Utilidades:** `date-fns` para la manipulación de fechas, y `lucide-react` para la iconografía.

## 📂 Estructura del Proyecto

El código fuente está organizado de la siguiente manera:

```text
├── electron/                  # Código del proceso principal de Electron
│   ├── main.ts                # Inicialización de ventana y proxy CORS (CalDAV)
│   ├── preload.ts             # Puente IPC expuesto al renderer
│   └── electron-env.d.ts      # Tipos globales
├── src/
│   ├── assets/                # Imágenes y recursos estáticos
│   ├── components/            # Componentes UI de React (Vistas, Modales, Layout)
│   ├── db/
│   │   └── database.js        # Configuración del esquema de IndexedDB (Dexie)
│   ├── services/
│   │   └── iCloudService.js   # Lógica cliente para el protocolo CalDAV de Apple
│   ├── App.jsx                # Componente principal y lógica de estados globales/notificaciones
│   ├── main.jsx               # Punto de entrada de React
│   └── index.css              # Configuración base de Tailwind y animaciones personalizadas
├── electron-builder.json5     # Configuración para compilar los ejecutables de escritorio
├── tailwind.config.cjs        # Configuración de colores del tema (ios-blue, ios-surface, etc.)
└── vite.config.ts             # Configuración de empaquetado y plugins de Vite
```

## 🚀 Instalación y Desarrollo

Para ejecutar este proyecto en tu entorno local, asegúrate de tener [Node.js](https://nodejs.org/) instalado.

1. **Clona el repositorio:**

   ```bash
   git clone https://github.com/bytrigi/ios-agenda-calendar-for-windows.git
   cd bytrigi-ios-agenda-calendar-for-windows
   ```

2. **Instala las dependencias:**

   ```bash
   npm install
   ```

3. **Inicia el entorno de desarrollo:**
   Esto arrancará el servidor de Vite y abrirá la ventana de Electron en modo desarrollo con Hot-Module Replacement (HMR).

   ```bash
   npm run dev
   ```

4. **Construye el ejecutable (Producción):**
   Generará los instaladores para el sistema operativo en la carpeta `release/`.
   ```bash
   npm run build
   ```

## ☁️ Guía de Configuración de iCloud

Para habilitar la sincronización con el calendario de Apple:

1. Ve a los **Ajustes** dentro de la aplicación.
2. Ingresa el correo electrónico asociado a tu **Apple ID**.
3. **Importante:** No uses tu contraseña habitual. Debes ir a [appleid.apple.com](https://appleid.apple.com) y generar una **Contraseña de Aplicación**.
4. Introduce la contraseña de aplicación, selecciona los calendarios que deseas importar y pulsa en "Guardar y Sincronizar".
5. La aplicación protegerá tus credenciales localmente e implementará comprobaciones automáticas con control de inercia y retrasos (debounce lag-protection) para sincronizar en segundo plano o al volver el foco a la ventana.
