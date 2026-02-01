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
        const dataToSave = {
            title: eventData.title || 'Sin título',
            start: new Date(eventData.start).toISOString(),
            end: new Date(eventData.end).toISOString(),
            color: eventData.color,
            description: eventData.description,
            allDay: !!eventData.allDay,
            reminder: eventData.reminder || 0,
            type: 'event'
        };

        if (eventData.id) {
            await db.events.update(eventData.id, dataToSave);
        } else {
            await db.events.add({ ...dataToSave, id: crypto.randomUUID() });
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

  const handleICloudSync = async (email, password) => {
      const service = new ICloudService(email, password);
      
      // 1. Obtener calendarios
      const calendars = await service.getCalendars();
      if (calendars.length === 0) throw new Error("No se encontraron calendarios de iCloud.");
      
      // 2. Definir rango: 6 meses atrás -> 1 año futuro
      const now = new Date();
      const startDate = subMonths(startOfMonth(now), 6);
      const endDate = addMonths(startOfMonth(now), 12);
      
      let totalEvents = [];

      // 3. Iterar y obtener eventos
      for (const cal of calendars) {
          const events = await service.getEvents(cal.url, startDate, endDate);
          totalEvents = [...totalEvents, ...events];
      }

      // 4. Mapear y guardar en Dexie
      const mappedEvents = totalEvents.map(evt => ({
        id: evt.id, // UID de Apple
        title: evt.title || 'Sin título',
        start: evt.start,
        end: evt.end,
        allDay: evt.allDay || false,
        color: 'bg-blue-100', // Color distintivo para iCloud
        description: evt.description || '',
        source: 'icloud',
        calendarName: 'iCloud',
        type: 'event'
      }));

      if (mappedEvents.length > 0) {
          await db.events.bulkPut(mappedEvents);
      }
      
      return mappedEvents;
  };


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
            notificationsEnabled={notificationsEnabled}

            onToggleNotifications={toggleNotifications}
            onSyncICloud={handleICloudSync}
        />

        <EventModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} onSave={handleSaveEvent} onDelete={handleRequestDelete} defaultDate={currentDate} eventToEdit={selectedEvent} />
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