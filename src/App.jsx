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
  
  // ESTADOS MODALES
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

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

  const openCreateModal = () => { setSelectedEvent(null); setIsModalOpen(true); };
  const openEditModal = (event) => { setSelectedEvent(event); setIsModalOpen(true); };

  const handleSaveEvent = async (eventData) => {
    try {
        let finalId = eventData.id || crypto.randomUUID();
        let source = eventData.source || 'local';

        // LOGICA DE GUARDADO EN ICLOUD
        // Si tenemos config de iCloud y el evento es de iCloud (o nuevo y iCloud está conectado)
        if (iCloudConfig && (!eventData.source || eventData.source === 'icloud')) {
            try {
                const service = new ICloudService(iCloudConfig.email, iCloudConfig.password);
                
                // Usamos la URL del calendario guardada en el evento (si existe) o la default
                const targetCalendarUrl = eventData.calendarUrl || iCloudConfig.defaultCalendarUrl;

                if (eventData.id && eventData.source === 'icloud') {
                    // ACTUALIZAR (UPDATE)
                    // Usamos updateEvent que hace PUT directo (sin If-None-Match)
                    await service.updateEvent(targetCalendarUrl, { ...eventData });
                    console.log('Evento actualizado en iCloud:', eventData.id);
                    source = 'icloud';
                    // Mantener ID original
                    finalId = eventData.id;
                } else {
                    // CREAR (NEW)
                    const cloudEvent = await service.createEvent(targetCalendarUrl, { ...eventData, id: finalId });
                    console.log('Evento creado en iCloud:', cloudEvent);
                    finalId = cloudEvent.id; 
                    source = 'icloud';
                }

            } catch (cloudError) {
                console.error('Error sincronizando con iCloud:', cloudError);
                // Si falla actualización por 412/404, quizá deberíamos intentar crear? 
                // Por ahora, fallback a local y alerta.
                alert('Error al sincronizar con iCloud. Se guardará localmente.\n' + cloudError.message);
                source = 'local'; 
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
            calendarUrl: eventData.calendarUrl || iCloudConfig?.defaultCalendarUrl // Guardar a qué calendario pertenece
        };

        if (eventData.id) {
            await db.events.update(eventData.id, dataToSave);
        } else {
            // Usamos put en lugar de add para asegurar idempotencia si el ID ya existe
            await db.events.put(dataToSave);
        }
        setIsModalOpen(false);
        setSelectedEvent(null);
    } catch (error) {
        alert("Error al guardar: " + error.message);
    }
  };



  const handleRequestDelete = () => { setIsModalOpen(false); setIsConfirmOpen(true); };
  const executeDeleteEvent = async () => {
      if (selectedEvent && selectedEvent.id) {
          await db.events.delete(selectedEvent.id);
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
      setIsSettingsOpen(true);
  };

  const handleOnboardingCancel = () => {
      setIsSyncPromptOpen(false);
      localStorage.setItem('has_asked_icloud_sync', 'true');
      // User declined.
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

      // Ahora sí, sincronizamos eventos solo de estos calendarios
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
                    color: cal.color || 'bg-blue-100', // Podríamos guardar color en el calendario
                    description: evt.description || '',
                    source: 'icloud',
                    calendarName: cal.name, // Importante para la UI
                    calendarUrl: cal.url,   // Importante para edits
                    type: 'event'
                }));
                totalEvents = [...totalEvents, ...mapped];
            } catch (err) {
                console.error(`Error syncing calendar ${cal.name}:`, err);
            }
        }

        // 4. Mapear y guardar en Dexie
        // NOTA: Deberíamos borrar los eventos antiguos de iCloud antes de insertar los nuevos para evitar zombies si se borraron en la nube.
        // Estrategia simple: Borrar todos los de source='icloud' y reinsertar.
        if (totalEvents.length > 0) {
            // Borrado masivo de icloud events antiguo (opcional pero recomendado para sync limpia)
            // await db.events.where('source').equals('icloud').delete(); // Dexie req compound index or manual filter logic
            // Para MVP, solo hacemos put (update/insert). Si se borró en nube, aquí seguirá existiendo (known issue).
            // Fix robusto: Traer todos IDs locales de iCloud, comparar con nuevos, borrar sobrantes.
            
            // Implementación simple de limpieza:
            const existingICloudKeys = await db.events.where('source').equals('icloud').primaryKeys();
            const newIds = new Set(totalEvents.map(e => e.id));
            const toDelete = existingICloudKeys.filter(k => !newIds.has(k));
            
            if (toDelete.length > 0) await db.events.bulkDelete(toDelete);
            
            await db.events.bulkPut(totalEvents);
        } else {
             // Si no hay eventos, borrar todos los de iCloud locales?
             // const count = await db.events.where('source').equals('icloud').count();
             // if (count > 0) ...
        }
        
        if (!silent) alert(`¡Sincronizado! ${totalEvents.length} eventos.`);
        return totalEvents;

      } catch (e) {
        console.error("Error Sync Loop:", e);
        if (!silent) alert("Error al sincronizar: " + e.message);
      }
  };

  // Wrapper para el botón de Settings (Legacy support si SettingsModal llama directo)
  // Pero SettingsModal será actualizado. Lo dejo como placeholder compatible?
  // Mejor exponer fetchICloudCalendars y handleConfirmSync.


  // Background Sync Loop & Sync on Focus
  const lastSyncTimeRef = useRef(0);

  useEffect(() => {
      if (!iCloudConfig) return; 

      // Función de sync segura con Cooldown de 10 segundos
      const runSmartSync = async (reason) => {
          const now = Date.now();
          if (now - lastSyncTimeRef.current < 10000) {
              // Skip if synced recently
              return;
          }
          
          if (navigator.onLine) {
              console.log(`Smart Sync initiated by: ${reason}`);
              lastSyncTimeRef.current = now;
              await syncEventsFromConfig(iCloudConfig, true);
          }
      };

      // 1. Loop regular (más rápido: 30s)
      const intervalId = setInterval(() => {
          runSmartSync('interval');
      }, 30000); 

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
    const commonProps = { events, onEventClick: openEditModal };
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
            onClose={() => setIsSettingsOpen(false)} 
            onFetchCalendars={fetchICloudCalendars}
            onConfirmSync={handleConfirmSync}
            initialConfig={iCloudConfig}
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

        <EventModal 
            isOpen={isModalOpen} 
            onClose={() => setIsModalOpen(false)} 
            onSave={handleSaveEvent} 
            onDelete={handleRequestDelete} 
            defaultDate={currentDate} 
            eventToEdit={selectedEvent} 
            calendars={iCloudConfig?.enabledCalendars || []}
        />
        <ConfirmModal isOpen={isConfirmOpen} onClose={() => setIsConfirmOpen(false)} onConfirm={executeDeleteEvent} title="¿Borrar evento?" message="Este evento se eliminará permanentemente." />

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