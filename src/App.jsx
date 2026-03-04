import React, { useState, useEffect, useRef } from 'react';
import { startOfMonth, subMonths, addMonths, addDays, addWeeks, addYears, subDays, subWeeks, subYears } from 'date-fns';
import { db } from './db/database';
import { useLiveQuery } from 'dexie-react-hooks';

// Componentes
import PlannerLayout from './components/PlannerLayout';
import DayView from './components/DayView';
import WeekView from './components/WeekView';
import MonthView from './components/MonthView';
import YearView from './components/YearView';
import TasksView from './components/TasksView';
import NotesView from './components/NotesView';

// Modales
import EventModal from './components/EventModal';
import ConfirmModal from './components/ConfirmModal';
import GlobalSearch from './components/GlobalSearch';
import SettingsModal from './components/SettingsModal';
import { ICloudService } from './services/iCloudService';

function App() {
  const [activeTab, setActiveTab] = useState('day');
  const [currentDate, setCurrentDate] = useState(new Date());
  
  // ESTADOS MODALES Y NOTIFICACIONES
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [showDeleteOptions, setShowDeleteOptions] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [settingsInitialTab, setSettingsInitialTab] = useState('general');
  const [toastMessage, setToastMessage] = useState(null);
  const [syncAlert, setSyncAlert] = useState(null);

  const showToast = (msg) => {
      setToastMessage(msg);
      setTimeout(() => setToastMessage(null), 3500);
  };

  // ESTADO NOTIFICACIONES
  const [notificationsEnabled, setNotificationsEnabled] = useState(Notification.permission === 'granted');
  const notifiedEventsRef = useRef(new Set()); 

  const events = useLiveQuery(() => db.events.toArray()) || [];

  // ==================================================================================
  // 🔔 GESTIÓN DE NOTIFICACIONES
  // ==================================================================================

  const toggleNotifications = () => {
    if (!notificationsEnabled) {
        if (Notification.permission === 'granted') {
            setNotificationsEnabled(true);
            new Notification("✅ Notificaciones Activadas", { body: "Recibirás alertas según tus eventos." });
        } else {
            Notification.requestPermission().then(permission => {
                if (permission === 'granted') {
                    setNotificationsEnabled(true);
                    new Notification("✅ ¡Conectado!", { body: "Recibirás alertas según tus eventos." });
                }
            });
        }
    } else {
        setNotificationsEnabled(false);
    }
  };

  useEffect(() => {
    const checkInterval = setInterval(() => {
        if (!notificationsEnabled || Notification.permission !== 'granted') return;

        const now = new Date();
        events.forEach(event => {
            const reminderTime = event.reminder || 0;
            if (reminderTime === 0) return;

            const start = new Date(event.start);
            const diffMs = start - now;
            const diffMins = diffMs / 60000; 

            if (diffMins <= reminderTime && diffMins > (reminderTime - 1) && !notifiedEventsRef.current.has(event.id)) {
                
                const notification = new Notification(`📅 ${event.title}`, {
                    body: `Comienza en ${reminderTime} minutos`,
                    icon: '/vite.svg',
                    requireInteraction: true,
                    silent: false
                });

                notification.onclick = () => {
                    window.focus();
                    setCurrentDate(start);
                    setActiveTab('day');
                    setTimeout(() => {
                        setSelectedEvent(event);
                        setIsModalOpen(true);
                    }, 200);
                };

                notifiedEventsRef.current.add(event.id);
            }
        });
    }, 5000);

    return () => clearInterval(checkInterval);
  }, [events, notificationsEnabled]); 

  // ==================================================================================
  // 💾 CRUD
  // ==================================================================================

  const openCreateModal = (slotDate = null) => { 
      // Si slotDate viene del click global (es un MouseEvent React) lo ignoramos.
      const safeDate = (slotDate && typeof slotDate.getMonth === 'function') ? slotDate : null;
      
      if (!safeDate) {
          setSelectedEvent(null); // Esto activará el form vacío ("else" en EventModal)
      } else {
          const eEnd = new Date(safeDate);
          eEnd.setMinutes(eEnd.getMinutes() + (appSettings?.defaultDuration || 60));
          setSelectedEvent({
              start: safeDate,
              end: eEnd
          });
      }
      setIsModalOpen(true); 
  };
  const openEditModal = (event) => { setSelectedEvent(event); setIsModalOpen(true); };

  const handleSaveEvent = async (eventData) => {
    try {
        let finalId = eventData.id || crypto.randomUUID();
        let source = eventData.source || 'local';

        // LOGICA DE GUARDADO EN ICLOUD
        // Si tenemos config de iCloud y el evento es de iCloud (o nuevo) Y no se seleccionó explicitly 'local'
        if (iCloudConfig && eventData.calendarUrl !== 'local' && (!eventData.source || eventData.source === 'icloud')) {
            try {
                const service = new ICloudService(iCloudConfig.email, iCloudConfig.password);
                
                // Usamos la URL del calendario guardada en el evento (si existe) o la default
                const targetCalendarUrl = eventData.calendarUrl || iCloudConfig.defaultCalendarUrl;

                if (eventData.id && eventData.source === 'icloud') {
                    // ACTUALIZAR (UPDATE)
                    // Usamos updateEvent que hace PUT directo (sin If-None-Match)
                    const updatedCloudEvent = await service.updateEvent(targetCalendarUrl, { ...eventData });
                    console.log('Evento actualizado en iCloud:', eventData.id);
                    source = 'icloud';
                    // Mantener ID original pero actualizar descripción si cambió (inyección de tag)
                    finalId = eventData.id;
                    eventData.description = updatedCloudEvent.description; 
                } else {
                    // CREAR (NEW)
                    const cloudEvent = await service.createEvent(targetCalendarUrl, { ...eventData, id: finalId });
                    console.log('Evento creado en iCloud:', cloudEvent);
                    finalId = cloudEvent.id; 
                    source = 'icloud';
                    eventData.description = cloudEvent.description;
                }

            } catch (cloudError) {
                // FALLBACK SMART: Si falla con 412 (Precondition Failed), significa que el evento YA EXISTE en iCloud.
                // Esto pasa si localmente no teniamos 'source: icloud' pero el UID ya estaba pillado.
                // Intentamos hacer UPDATE en vez de CREATE.
                if (cloudError.message && cloudError.message.includes('412')) {
                   try {
                       console.log('Detectado error 412 (Ya existe). Intentando UPDATE...');
                       const service = new ICloudService(iCloudConfig.email, iCloudConfig.password); // Re-instanciar
                       const targetCalendarUrl = eventData.calendarUrl || iCloudConfig.defaultCalendarUrl;
                       const updatedFallback = await service.updateEvent(targetCalendarUrl, { ...eventData, id: finalId });
                       console.log('Evento recuperado y actualizado en iCloud via Fallback.');
                       source = 'icloud';
                       eventData.description = updatedFallback.description;
                   } catch (updateError) {
                       console.error('Fallo el fallback de update:', updateError);
                       alert('Error al sincronizar con iCloud (incluso al intentar actualizar).\n' + updateError.message);
                       source = 'local';
                   }
                } else {
                    console.error('Error sincronizando con iCloud:', cloudError);
                    showToast('⚠️ Error iCloud: Se guardará localmente.');
                    source = 'local';
                } 
            }
        }

        const dataToSave = {
            title: eventData.title || 'Sin título',
            start: new Date(eventData.start).toISOString(),
            end: new Date(eventData.end).toISOString(),
            color: eventData.color,
            description: eventData.description,
            allDay: !!eventData.allDay,
            reminder: eventData.reminder || 0,
            type: 'event',
            source: source,
            id: finalId,
            calendarUrl: eventData.calendarUrl || iCloudConfig?.defaultCalendarUrl, // Guardar a qué calendario pertenece
            lastUpdated: Date.now(), // DEBOUNCE MARKER: Marca de tiempo local para evitar sobrescritura por sync lag
            recurrence: eventData.recurrence,
            recurrenceEnd: eventData.recurrenceEnd,
            icsUrl: eventData.icsUrl || null
        };

        // =========================================================================================
        // EXPANSION LOCAL DE RECURRENCIAS
        // Para que el calendario muestre las recurrencias de eventos locales, generamos las 
        // instancias físicamente en Dexie (igual que hace iCloudService para los de la nube).
        // =========================================================================================
        
        if (source === 'local' && eventData.recurrence && eventData.recurrence !== 'NONE') {
            const baseStart = new Date(eventData.start);
            const baseEnd = new Date(eventData.end);
            const durationMs = baseEnd.getTime() - baseStart.getTime();
            
            // Limite de seguridad: Fecha de fin o 2 años
            const limitDate = eventData.recurrenceEnd ? new Date(eventData.recurrenceEnd) : addYears(baseStart, 2);
            limitDate.setHours(23, 59, 59, 999);
            
            const instancesToSave = [];
            let currentStart = baseStart;
            
            while (currentStart <= limitDate && instancesToSave.length < 500) {
                const currentEnd = new Date(currentStart.getTime() + durationMs);
                
                instancesToSave.push({
                    ...dataToSave,
                    id: currentStart.getTime() === baseStart.getTime() ? finalId : `${finalId}_${currentStart.toISOString()}`,
                    originalId: finalId,
                    recurrenceId: currentStart.getTime() === baseStart.getTime() ? null : currentStart.toISOString(),
                    start: currentStart.toISOString(),
                    end: currentEnd.toISOString()
                });
                
                // Avanzar según la regla
                if (eventData.recurrence === 'DAILY') currentStart = addDays(currentStart, 1);
                else if (eventData.recurrence === 'WEEKLY') currentStart = addWeeks(currentStart, 1);
                else if (eventData.recurrence === 'MONTHLY') currentStart = addMonths(currentStart, 1);
                else if (eventData.recurrence === 'YEARLY') currentStart = addYears(currentStart, 1);
                else break; 
            }
            
            // Si es un edit, primero limpiamos las viejas instancias generadas
            if (eventData.id) {
                const masterId = eventData.originalId || eventData.id;
                const allEvts = await db.events.toArray();
                const oldInstances = allEvts.filter(e => e.originalId === masterId || e.id === masterId);
                const oldIds = oldInstances.map(i => i.id);
                if (oldIds.length > 0) await db.events.bulkDelete(oldIds);
            }
            
            await db.events.bulkPut(instancesToSave);

        } else {
            // Guardado normal (Eventos únicos locales, o cualquier evento de iCloud que será 
            // aplastado en breves por el Smart Sync)
            if (eventData.id) {
                await db.events.update(eventData.id, dataToSave);
            } else {
                await db.events.put(dataToSave);
            }
        }
        setIsModalOpen(false);
        setSelectedEvent(null);
    } catch (error) {
        alert("Error al guardar: " + error.message);
    }
  };



  const requestDelete = () => {
       console.log('[DEBUG DELETE] Requesting delete for:', selectedEvent);
       console.log('[DEBUG DELETE] isRecurring check:', {
           recurrence: selectedEvent.recurrence,
           originalId: selectedEvent.originalId,
           recurrenceId: selectedEvent.recurrenceId,
           hasRecurrence: !!(selectedEvent.recurrence && selectedEvent.recurrence !== 'NONE'),
           hasOriginalId: !!selectedEvent.originalId,
           hasRecurrenceId: !!selectedEvent.recurrenceId
       });

       const isRecurringLike = (selectedEvent.recurrence && selectedEvent.recurrence !== 'NONE') || selectedEvent.originalId || selectedEvent.recurrenceId;
       setShowDeleteOptions(!!isRecurringLike);
       setIsModalOpen(false);
       setIsConfirmOpen(true);
  };

  const executeDeleteEvent = async (scope = 'ALL') => {
      // Scope: ALL (Default/Legacy), SINGLE, FUTURE
      if (selectedEvent && selectedEvent.id) {
          
          let actionCompleted = false;

          // 1. Manejo iCloud (si aplica)
          if (iCloudConfig && selectedEvent.source === 'icloud') {
              try {
                  const service = new ICloudService(iCloudConfig.email, iCloudConfig.password);
                  const targetUrl = selectedEvent.calendarUrl || iCloudConfig.defaultCalendarUrl;
                  
                  // CASO 1: Borrar Solo Esta Instancia
                  if (scope === 'SINGLE' && selectedEvent.originalId) {
                      await service.excludeInstance(targetUrl, selectedEvent.originalId, selectedEvent.start, selectedEvent.icsUrl);
                      actionCompleted = true;
                  } 
                  // CASO 2: Borrar Esta y Futuras
                  else if (scope === 'FUTURE' && selectedEvent.originalId) {
                       // Fecha límite = El día de AYER (para cortar antes de hoy)
                       const cutOffDate = new Date(selectedEvent.start);
                       cutOffDate.setDate(cutOffDate.getDate() - 1);
                       await service.truncateSeries(targetUrl, selectedEvent.originalId, cutOffDate, selectedEvent.icsUrl);
                       actionCompleted = true;
                  }
                  // CASO 3: Borrar Todo (Default)
                  else {
                       // Si es instancia, borrar el Master? O si es Master?
                       // Si scope es ALL, borramos por ID.
                       const idToDelete = selectedEvent.originalId || selectedEvent.id;
                       await service.deleteEvent(targetUrl, idToDelete, selectedEvent.icsUrl);
                       actionCompleted = true;
                  }
                  
                  console.log(`Evento borrado de iCloud (Scope: ${scope})`);
              } catch (e) {
                  console.error("Error borrando de iCloud (ignorado para permitir borrado local):", e);
                  // No retornamos. Continuamos borrando localmente aunque la nube falle o ya no exista.
              }
          }

          // 2. Borrar LOCALMENTE
          if (scope === 'SINGLE') {
              // Borrar solo este registro
              await db.events.delete(selectedEvent.id);
          } else if (scope === 'FUTURE') {
              // Borrar este y todos los que tengan mismo originalId y start >= este start
              const startIso = new Date(selectedEvent.start).toISOString();
              // Buscar futuros
              const allEvts = await db.events.toArray();
              const targetOriginalId = selectedEvent.originalId || selectedEvent.id;
              const related = allEvts.filter(e => e.originalId === targetOriginalId || e.id === targetOriginalId);
              
              const toDelete = related.filter(e => e.start >= startIso).map(e => e.id);
              // Tambien borrar el propio evento si no lo pillo el query
              if (!toDelete.includes(selectedEvent.id)) toDelete.push(selectedEvent.id);
              
              await db.events.bulkDelete(toDelete);
          } else {
              // ALL: Borrar por ID. Y si es Master, borrar sus instancias?
              if (selectedEvent.originalId) {
                 // Es una instancia.
                 const masterId = selectedEvent.originalId;
                 await db.events.delete(masterId); // Borrar Master si existe
                 
                 const allEvts = await db.events.toArray();
                 const instances = allEvts.filter(e => e.originalId === masterId).map(e => e.id);
                 if (instances.length > 0) await db.events.bulkDelete(instances);
              } else {
                 // Es normal o master
                 await db.events.delete(selectedEvent.id);
                 // Y sus instancias si las hubiera
                 const allEvts = await db.events.toArray();
                 const instances = allEvts.filter(e => e.originalId === selectedEvent.id).map(e => e.id);
                 if (instances.length > 0) await db.events.bulkDelete(instances);
              }
          }

          setIsConfirmOpen(false);
          setIsModalOpen(false);
          setSelectedEvent(null);
      }
  };

  // ==================================================================================
  // ☁️ ICLOUD SYNC
  // ==================================================================================

  // Estado para credenciales (Persistencia simple)
  const [iCloudConfig, setICloudConfig] = useState(() => {
    // Config structure: { email, password, enabledCalendars: [{name, url, color}], defaultCalendarUrl }
    const saved = localStorage.getItem('icloud_config');
    return saved ? JSON.parse(saved) : null;
  });

  // Estado para Preferencias Generales
  const [appSettings, setAppSettings] = useState(() => {
    const saved = localStorage.getItem('app_settings');
    return saved ? JSON.parse(saved) : {
        startOfWeek: 'monday', // 'monday' or 'sunday'
        defaultDuration: 60, // minutes
        theme: 'light' // 'light', 'dark', 'auto'
    };
  });

  const updateAppSettings = (newSettings) => {
      const updated = { ...appSettings, ...newSettings };
      setAppSettings(updated);
      localStorage.setItem('app_settings', JSON.stringify(updated));
  };

  // 🌙 SOPORTE MODO OSCURO
  useEffect(() => {
     const applyTheme = (theme) => {
         const root = document.documentElement;
         if (theme === 'dark') {
             root.classList.add('dark');
         } else if (theme === 'light') {
             root.classList.remove('dark');
         } else {
             if (window.matchMedia('(prefers-color-scheme: dark)').matches) {
                 root.classList.add('dark');
             } else {
                 root.classList.remove('dark');
             }
         }
     };

     applyTheme(appSettings.theme);

     if (appSettings.theme === 'auto') {
         const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
         const handleChange = () => applyTheme('auto');
         mediaQuery.addEventListener('change', handleChange);
         return () => mediaQuery.removeEventListener('change', handleChange);
     }
  }, [appSettings.theme]);

  // Onboarding Status
  const [isSyncPromptOpen, setIsSyncPromptOpen] = useState(false);

  // Check Onboarding
  useEffect(() => {
     // Check if we already asked
     const hasAsked = localStorage.getItem('has_asked_icloud_sync');
     if (!hasAsked) {
         // wait a bit for nice UX
         setTimeout(() => setIsSyncPromptOpen(true), 1500);
     }
  }, []);

  const handleOnboardingConfirm = () => {
      setIsSyncPromptOpen(false);
      localStorage.setItem('has_asked_icloud_sync', 'true');
      setSettingsInitialTab('icloud');
      setIsSettingsOpen(true);
  };

  const handleOnboardingCancel = () => {
      setIsSyncPromptOpen(false);
      localStorage.setItem('has_asked_icloud_sync', 'true');
      // User declined.
  };

  // ==================================================================================
  // 🚀 AUTO-UPDATE (PREPARADO PARA ELECTRON-UPDATER)
  // ==================================================================================
  const [updateAvailable, setUpdateAvailable] = useState(null);

  useEffect(() => {
      // 1. Preparado para electron-updater vía IPC (Cuando haya Code Signing)
      if (window.electronAPI && window.electronAPI.onUpdateAvailable) {
          window.electronAPI.onUpdateAvailable((info) => {
              setUpdateAvailable(info.version);
          });
      } else {
          // 2. Mock Fallback (Consulta API GitHub Releases)
          const checkGitHubRelease = async () => {
              try {
                  const currentVersion = "1.0.0"; 
                  const response = await fetch('https://api.github.com/repos/bytrigi/iOS-Agenda-Calendar-for-Windows/releases/latest');
                  if (!response.ok) return;
                  const data = await response.json();
                  const remoteVersion = data.tag_name ? data.tag_name.replace('v', '') : null;
                  
                  if (remoteVersion && remoteVersion !== currentVersion) {
                      setUpdateAvailable(remoteVersion);
                  }
              } catch (e) {
                  console.log("No se pudo comprobar actualizaciones:", e);
              }
          };
          // Se puede descomentar para habilitar el chequeo manual a GitHub
          // checkGitHubRelease();
      }
  }, []);

  const handleUpdateApp = () => {
      if (window.electronAPI && window.electronAPI.triggerUpdate) {
          window.electronAPI.triggerUpdate(); // Llama a electron-updater en Main process
      } else {
          // Fallback manual
          window.open('https://github.com/bytrigi/iOS-Agenda-Calendar-for-Windows/releases/latest');
      }
      setUpdateAvailable(null);
  };

  // 1. LOGIN / FETCH CALENDARS (Step 1 of Sync)
  // Returns list of calendars found for the user to choose
  const fetchICloudCalendars = async (email, password) => {
      const service = new ICloudService(email, password);
      const calendars = await service.getCalendars();
      if (calendars.length === 0) throw new Error("No se encontraron calendarios.");
      return calendars; // [{name, url, color?}, ...]
  };

  // 2. CONFIRM & SYNC EVENTS (Step 2 of Sync)
  // Recibe la lista de calendarios QUE EL USUARIO QUIERE VER
  const handleConfirmSync = async (email, password, selectedCalendars) => {
      // Guardar config
      // Default: el primero de la lista seleccionada o uno con nombre 'Calendar'
      const preferredNames = ['Calendario', 'Calendar', 'Home', 'Casa', 'Personal', 'Work', 'Trabajo'];
      let defaultCal = selectedCalendars.find(c => 
          c.name && preferredNames.some(p => c.name.toLowerCase().includes(p.toLowerCase()))
      );
      if (!defaultCal) defaultCal = selectedCalendars[0];

      const config = { 
          email, 
          password, 
          enabledCalendars: selectedCalendars, 
          defaultCalendarUrl: defaultCal?.url 
      };
      
      localStorage.setItem('icloud_config', JSON.stringify(config));
      setICloudConfig(config);

      // Ahora sí, sincronizamos eventos y tareas
      await syncEventsFromConfig(config);
  };

  // Helper interno para sincronizar usando una config dada
  const syncEventsFromConfig = async (config, silent = false) => {
      if (!config || !config.enabledCalendars || config.enabledCalendars.length === 0) return;

      try {
        if (!silent) console.log("Sincronizando eventos...", config.enabledCalendars.map(c => c.name));
        const service = new ICloudService(config.email, config.password);
        
        // 2. Definir rango
        const now = new Date();
        const startDate = subMonths(startOfMonth(now), 6);
        const endDate = addMonths(startOfMonth(now), 12);
        
        let totalEvents = [];

        // 3. Iterar solo calendarios habilitados
        for (const cal of config.enabledCalendars) {
            // Check VEVENT support
            const supportsEvents = !cal.supportedComponents || cal.supportedComponents.includes('VEVENT');
            if (!supportsEvents) continue;

            try {
                const events = await service.getEvents(cal.url, startDate, endDate);
                // Asignar color si el calendario tiene uno (futuro), o mix.
                // Por ahora usamos el del calendario si lo tuviera, o default.
                // Mapear source = icloud
                const mapped = events.map(evt => ({
                    id: evt.id,
                    title: evt.title || 'Sin título',
                    start: evt.start,
                    end: evt.end,
                    allDay: evt.allDay || false,
                    color: evt.color || cal.color || '#4FACF2', // Usar color parseado de iCloud (hex)
                    description: evt.description || '',
                    source: 'icloud',
                    calendarName: cal.name, // Importante para la UI
                    calendarUrl: cal.url,   // Importante para edits
                    type: 'event',
                    // Fields for Recurring Events / Smart Delete
                    originalId: evt.originalId, 
                    recurrence: evt.recurrence,
                    recurrenceEnd: evt.recurrenceEnd,
                    recurrenceId: evt.recurrenceId,
                    icsUrl: evt.icsUrl
                }));
                totalEvents = [...totalEvents, ...mapped];
            } catch (err) {
                console.error(`Error syncing calendar ${cal.name}:`, err);
            }
        }

        // 4. Mapear y guardar en Dexie
        // FIX: Race Condition. Verificar timestamps locales para de-bouncing (20s cooldown).
        if (totalEvents.length > 0) {
            
            // 4a. Traer eventos locales que coincidan con los IDs entrantes
            const incomingIds = totalEvents.map(e => e.id);
            const localEvents = await db.events.where('id').anyOf(incomingIds).toArray();
            const localMap = new Map(localEvents.map(e => [e.id, e]));
            
            const now = Date.now();

            // 4b. Filtrar eventos de la nube que sean "viejos" (si local fue editado reciéntemente)
                const validEventsToSave = totalEvents.filter(cloudEvent => {
                 const local = localMap.get(cloudEvent.id);
                 // Si fue editado localmente en los últimos 60 segundos, IGNORAR update de la nube (trusted local)
                 if (local && local.lastUpdated && (now - local.lastUpdated < 60000)) {
                     console.log(`Skipping overwrite for event ${cloudEvent.title} due to recent local edit.`);
                     return false;
                 }
                 return true;
            });

            // 4c. Borrar obsoletos (que ya no están en la nube) + Borrar MASTERS locales si llegan INSTANCIAS
            // Estrategia: Si llega un evento con originalId='X', y tenemos localmente un evento con id='X',
            // significa que tenemos el "Master" local y han llegado las "Instancias". Borramos el Master.
            const incomingOriginalIds = new Set(totalEvents.map(e => e.originalId).filter(id => id));
            
            const existingICloudEvents = await db.events.where('source').equals('icloud').toArray();
            const newIdsSet = new Set(totalEvents.map(e => e.id));
            
            const toDeleteIds = existingICloudEvents
                .filter(localEvt => {
                    // 1. Si está en la lista nueva (por ID exacto), MANTENER.
                    if (newIdsSet.has(localEvt.id)) return false;

                    // 2. Si es un MASTER y acaban de llegar sus INSTANCIAS, BORRAR.
                    // (El Master local tiene id=UID, las instancias tienen originalId=UID)
                    if (incomingOriginalIds.has(localEvt.id)) {
                        console.log(`Deleting local Master ${localEvt.title} because instances arrived.`);
                        return true;
                    }
                    
                    // 3. Protección de Lag: Si NO está en la lista nueva, verificar si es "nuevo localmente"
                    if (localEvt.lastUpdated && (now - localEvt.lastUpdated < 60000)) {
                        console.log(`Preventing deletion of recently updated event ${localEvt.title} (Sync Lag Protection)`);
                        return false; 
                    }
                    
                    // 4. Si es viejo y no está en la nube, borrar.
                    return true;
                })
                .map(e => e.id);
            
            if (toDeleteIds.length > 0) {
                console.log("Borrando eventos obsoletos de iCloud:", toDeleteIds);
                await db.events.bulkDelete(toDeleteIds);
            }
            
            if (validEventsToSave.length > 0) {
                 // DEBUG: Inspect what we are saving to see if color is correct
                 validEventsToSave.forEach(e => {
                     if (e.color && e.color.startsWith('#')) {
                         console.log(`[DEBUG SAVE] Saving event ${e.title} with color: ${e.color}`);
                     } else {
                         console.log(`[DEBUG SAVE] Saving event ${e.title} with NO/DEFAULT color: ${e.color}`);
                     }
                 });
                 await db.events.bulkPut(validEventsToSave);
            }
        } else {
             // Si no hay eventos, borrar todos los de iCloud locales?
             // const count = await db.events.where('source').equals('icloud').count();
             // if (count > 0) ...
        }
        
        if (!silent) setSyncAlert({ title: "Sincronización Completada", message: `Se han sincronizado ${totalEvents.length} eventos con tu cuenta de iCloud.`, isError: false });
        return totalEvents;

      } catch (e) {
        console.error("Error Sync Loop:", e);
        if (!silent) setSyncAlert({ title: "Error de Sincronización", message: "Hubo un problema al sincronizar con iCloud. Por favor, verifica tu conexión o credenciales.", isError: true });
      }
  };

  // Wrapper para el botón de Settings (Legacy support si SettingsModal llama directo)
  // Pero SettingsModal será actualizado. Lo dejo como placeholder compatible?
  // Mejor exponer fetchICloudCalendars y handleConfirmSync.


  // Background Sync Loop & Sync on Focus
  const lastSyncTimeRef = useRef(0);

  useEffect(() => {
      if (!iCloudConfig) return; 

      // Función de sync segura con Cooldown de 5 segundos
      const runSmartSync = async (reason) => {
          const now = Date.now();
          if (now - lastSyncTimeRef.current < 5000) {
              // Skip if synced recently
              return;
          }
          
          if (navigator.onLine) {
              console.log(`Smart Sync initiated by: ${reason}`);
              lastSyncTimeRef.current = now;
              await syncEventsFromConfig(iCloudConfig, true);
          }
      };

      // 1. Loop regular (más rápido: 10s)
      const intervalId = setInterval(() => {
          runSmartSync('interval');
      }, 10000); 

      // 2. Sync al volver a la ventana (UX mágica "siempre actualizado")
      const handleFocus = () => {
          runSmartSync('focus');
      };

      window.addEventListener('focus', handleFocus);
      window.addEventListener('visibilitychange', () => {
          if (document.visibilityState === 'visible') handleFocus();
      });

      // Run immediately on mount/login
      runSmartSync('init');

      return () => {
          clearInterval(intervalId);
          window.removeEventListener('focus', handleFocus);
      };
  }, [iCloudConfig]);


  // ==================================================================================
  // NAVEGACIÓN
  // ==================================================================================

  const handleSearchNavigate = (type, item) => {
      setIsSearchOpen(false); 
      if (type === 'event') {
          const eventDate = new Date(item.start);
          setCurrentDate(eventDate);
          setActiveTab('day');
          setTimeout(() => openEditModal(item), 100);
      } else if (type === 'task') { setActiveTab('tasks'); } 
      else if (type === 'note') { setActiveTab('notes'); }
  };
  
  const navigate = (direction) => {
    switch(activeTab) {
      case 'day': setCurrentDate(prev => direction === 1 ? addDays(prev, 1) : subDays(prev, 1)); break;
      case 'week': setCurrentDate(prev => direction === 1 ? addWeeks(prev, 1) : subWeeks(prev, 1)); break;
      case 'month': setCurrentDate(prev => direction === 1 ? addMonths(prev, 1) : subMonths(prev, 1)); break;
      case 'year': setCurrentDate(prev => direction === 1 ? addYears(prev, 1) : subYears(prev, 1)); break;
      default: break;
    }
  };

  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') { e.preventDefault(); setIsSearchOpen(prev => !prev); return; }
      if (isModalOpen || isSearchOpen || isConfirmOpen || isSettingsOpen) return;
      if (e.key === 'ArrowRight') navigate(1);
      if (e.key === 'ArrowLeft') navigate(-1);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activeTab, isModalOpen, isSearchOpen, isConfirmOpen, isSettingsOpen]); 

  const handleDayClick = (dateClicked) => { setCurrentDate(dateClicked); setActiveTab('day'); };
  const goToMonth = (monthIndex) => { const newDate = new Date(currentDate); newDate.setMonth(monthIndex); setCurrentDate(newDate); setActiveTab('month'); };

  // ==================================================================================
  // 👋 GESTOS Y SCROLL (ARREGLADO - MÁS RÁPIDO)
  // ==================================================================================
  
  const startX = useRef(null);
  const lastScrollTime = useRef(0); // Memoria del último cambio

  // SWIPE (TÁCTIL REAL)
  const handleDragStart = (e) => { const clientX = e.targetTouches ? e.targetTouches[0].clientX : e.clientX; startX.current = clientX; };
  const handleDragEnd = (e) => {
    if (!startX.current) return;
    const clientX = e.changedTouches ? e.changedTouches[0].clientX : e.clientX;
    const distance = startX.current - clientX;
    if (distance > 50) navigate(1);
    if (distance < -50) navigate(-1);
    startX.current = null;
  };

  // SCROLL DE RUEDA / TOUCHPAD (VERSIÓN RÁPIDA)
  const handleWheel = (e) => {
    // 1. Bloqueos de seguridad
    if (isModalOpen || isSearchOpen || isSettingsOpen || isConfirmOpen) return; 

    // 2. Control de tiempo (COOLDOWN)
    // En lugar de esperar a que el trackpad pare, simplemente impedimos
    // que se cambie de hoja más de una vez cada 500ms.
    const now = Date.now();
    if (now - lastScrollTime.current < 500) {
        return; // Si hace menos de medio segundo que cambiaste, ignoramos la inercia.
    }

    // 3. Detección del gesto
    // deltaX > 30 es un buen umbral para ignorar roces, pero captar swipes normales.
    if (Math.abs(e.deltaX) > 30) {
        
        if (e.deltaX > 0) navigate(1); 
        else navigate(-1);
        
        // 4. Actualizamos el reloj
        lastScrollTime.current = now;
    }
  };

  const renderContent = () => {
    // Convert 'monday'/'sunday' to 1/0 for date-fns
    const weekStartsOn = appSettings.startOfWeek === 'monday' ? 1 : 0;
    const commonProps = { events, onEventClick: openEditModal, startOfWeek: weekStartsOn };

    switch(activeTab) {
        case 'day': return <DayView date={currentDate} {...commonProps} />;
        case 'week': return <WeekView date={currentDate} {...commonProps} />;
        case 'month': return <MonthView date={currentDate} onDayClick={handleDayClick} {...commonProps} />;
        case 'year': return <YearView date={currentDate} onMonthClick={goToMonth} />;
        case 'tasks': return <TasksView />;
        case 'notes': return <NotesView />;
        default: return <DayView date={currentDate} {...commonProps} />;
    }
  };

  return (
    <PlannerLayout 
        activeTab={activeTab} 
        setActiveTab={setActiveTab} 
        onAddEvent={openCreateModal}
        onSearchClick={() => setIsSearchOpen(true)}
        onSettingsClick={() => setIsSettingsOpen(true)}
    >
        
        <GlobalSearch isOpen={isSearchOpen} onClose={() => setIsSearchOpen(false)} onNavigate={handleSearchNavigate} />
        
        <SettingsModal 
            isOpen={isSettingsOpen} 
            onClose={() => {
                setIsSettingsOpen(false);
                setSettingsInitialTab('general'); // Reset
            }}
            iCloudConfig={iCloudConfig}
            onConnect={handleConfirmSync}
            appSettings={appSettings}
            onUpdateSettings={updateAppSettings}
            initialTab={settingsInitialTab}
        />

        {/* TOAST / NOTIFICACIONES IN-APP BLUR */}
        {toastMessage && (
            <div className="fixed top-14 left-1/2 -translate-x-1/2 z-[99999] animate-fade-in-down pointer-events-none">
                <div className="bg-white/85 dark:bg-slate-800/85 backdrop-blur-xl border border-gray-200/50 dark:border-slate-700/50 shadow-2xl rounded-full px-5 py-2 flex items-center gap-3">
                    <span className="text-sm font-semibold text-gray-800 dark:text-gray-100 drop-shadow-sm">{toastMessage}</span>
                </div>
            </div>
        )}

        {/* ALERTA DE ACTUALIZACIÓN */}
        <ConfirmModal 
            isOpen={!!updateAvailable} 
            onClose={() => setUpdateAvailable(null)} 
            onConfirm={handleUpdateApp} 
            title="¡Nueva versión disponible!" 
            message={`La versión ${updateAvailable} está lista para descargar. ¿Deseas actualizar ahora?`}
            confirmText="Actualizar"
            cancelText="Más tarde"
            confirmColor="bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700"
        />

        {/* ONBOARDING MODAL */}
        <ConfirmModal 
            isOpen={isSyncPromptOpen} 
            onClose={handleOnboardingCancel} 
            onConfirm={handleOnboardingConfirm} 
            title="Bienvenido a iOS Calendar for Windows!" 
            message="¿Deseas vincular tu cuenta de iCloud para sincronizar tu calendario de Apple?"
            confirmText="¡Sí!"
            cancelText="Quizá más tarde"
            confirmColor="bg-blue-500 hover:bg-blue-600 shadow-blue-500/30"
            isWelcome={true}
        />

        {/* SYNC ALERT MODAL */}
        <ConfirmModal 
            isOpen={!!syncAlert} 
            onClose={() => setSyncAlert(null)} 
            onConfirm={() => setSyncAlert(null)} 
            title={syncAlert?.title} 
            message={syncAlert?.message}
            confirmText="Aceptar"
            cancelText="Cerrar"
            confirmColor={syncAlert?.isError ? "bg-red-500 hover:bg-red-600 shadow-red-500/30" : "bg-blue-500 hover:bg-blue-600 shadow-blue-500/30"}
        />

        <EventModal 
            isOpen={isModalOpen} 
            onClose={() => setIsModalOpen(false)} 
            onSave={handleSaveEvent} 
            onDelete={requestDelete} 
            defaultDate={currentDate} 
            eventToEdit={selectedEvent} 
            calendars={iCloudConfig?.enabledCalendars || []}
            defaultDuration={appSettings.defaultDuration}
        />
        <ConfirmModal 
            isOpen={isConfirmOpen} 
            onClose={() => setIsConfirmOpen(false)} 
            onConfirm={executeDeleteEvent} 
            title="¿Borrar evento?" 
            message="Este evento se eliminará permanentemente."
            showRecurringOptions={showDeleteOptions}
        />

        <div className="h-full w-full relative bg-transparent cursor-grab active:cursor-grabbing page-container"
          onTouchStart={handleDragStart} onTouchEnd={handleDragEnd}
          onMouseDown={handleDragStart} onMouseUp={handleDragEnd}
          onWheel={handleWheel} 
        >
            <div key={`${activeTab}-${currentDate.toISOString()}`} className="animate-page-turn shadow-lg rounded-r-xl">
                {renderContent()}
            </div>
        </div>
    </PlannerLayout>
  );
}

export default App;