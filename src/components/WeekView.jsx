import React from 'react';
import { startOfWeek, addDays, format, isSameDay, differenceInMinutes, startOfDay, differenceInCalendarDays, endOfDay, isBefore, isAfter, max, min } from 'date-fns';
import { es } from 'date-fns/locale';

const WeekView = ({ date, events = [], onEventClick }) => {
    const hours = Array.from({ length: 24 }, (_, i) => i);
    const startDate = startOfWeek(date, { weekStartsOn: 1 });
    const weekDays = Array.from({ length: 7 }, (_, i) => addDays(startDate, i));
    
    // Altura por hora (80px = h-20)
    const HOUR_HEIGHT = 80;

    // Calcular posición del evento
    const getEventStyle = (event) => {
        const start = new Date(event.start);
        const end = new Date(event.end);
        const startMinutes = start.getHours() * 60 + start.getMinutes();
        const duration = differenceInMinutes(end, start);

        return {
            top: `${startMinutes * (HOUR_HEIGHT / 60)}px`,
            height: `${duration * (HOUR_HEIGHT / 60)}px`,
            left: '2px',
            right: '2px'
        };
    };

    return (
        <div className="flex flex-col h-full bg-white relative font-sans">
            
            {/* CABECERA DE DÍAS */}
            <div className="flex-none bg-white z-30 shadow-sm relative border-b border-gray-200">
                <div className="flex">
                    <div className="w-14 border-r border-gray-100 bg-gray-50"></div> 
                    {weekDays.map((day) => {
                        const isToday = isSameDay(day, new Date());
                        return (
                            <div key={day.toString()} className={`flex-1 flex flex-col items-center justify-center py-3 border-r border-gray-100 ${isToday ? 'bg-blue-50/20' : ''}`}>
                                <span className={`text-xs font-bold uppercase tracking-wider ${isToday ? 'text-blue-600' : 'text-gray-400'}`}>
                                    {format(day, 'EEE', { locale: es })}
                                </span>
                                <div className={`w-8 h-8 flex items-center justify-center rounded-full mt-1 text-lg font-serif ${isToday ? 'bg-blue-600 text-white shadow-md' : 'text-gray-700'}`}>
                                    {format(day, 'd')}
                                </div>
                            </div>
                        );
                    })}
                </div>
                
{/* Sección All Day con CSS Grid */}
                <div className="flex border-t border-gray-100 min-h-[2.5rem] relative">
                     {/* Label lateral */}
                     <div className="w-14 border-r border-gray-200 bg-gray-50/50 text-[10px] flex items-center justify-center text-gray-400 font-bold tracking-tighter p-1 text-center leading-tight z-20">
                        ALL DAY
                     </div>
                     
                     {/* Contenedor Grid */}
                     <div className="flex-1 bg-white relative grid grid-cols-7 gap-y-1 auto-rows-min p-1">
                        
                        {/* 1. Fondo de columnas (Guías visuales) - Absolute para estar detrás */}
                        <div className="absolute inset-0 grid grid-cols-7 pointer-events-none z-0">
                           {weekDays.map((day, i) => (
                               <div key={i} className={`border-r border-gray-100 h-full ${isSameDay(day, new Date()) ? 'bg-blue-50/10' : ''}`}></div>
                           ))}
                        </div>

                        {/* 2. Eventos Continuos - Z-Index superior */}
                        {events
                            .filter(e => e.allDay)
                            .sort((a, b) => {
                                const startDiff = new Date(a.start) - new Date(b.start);
                                if (startDiff !== 0) return startDiff;
                                const durationA = new Date(a.end) - new Date(a.start);
                                const durationB = new Date(b.end) - new Date(b.start);
                                return durationB - durationA;
                            })
                            .map(event => {
                            const eventStart = new Date(event.start);
                            const eventEnd = new Date(event.end);
                            const weekStart = weekDays[0];
                            const weekEnd = weekDays[6];

                            // Si el evento no toca esta semana, null
                            if (eventEnd < weekStart || eventStart > weekEnd) return null;

                            // Calcular inicio y fin visuales dentro de la semana (Clamping)
                            const visualStart = eventStart < weekStart ? weekStart : eventStart;
                            const visualEnd = eventEnd > weekEnd ? weekEnd : eventEnd;

                            // Calcular columna de inicio (1-7) y span
                            const colStart = differenceInCalendarDays(visualStart, weekStart) + 1;
                            const span = differenceInCalendarDays(visualEnd, visualStart) + 1;

                            return (
                                <button
                                    key={event.id}
                                    onClick={(e) => { e.stopPropagation(); onEventClick(event); }}
                                    className={`
                                        relative z-10 rounded-md px-2 py-1 text-[10px] font-bold truncate shadow-sm 
                                        hover:brightness-95 transition-all text-left
                                        ${event.color} text-gray-700
                                    `}
                                    style={{ gridColumn: `${colStart} / span ${span}` }}
                                    title={event.title}
                                >
                                    {event.title}
                                </button>
                            );
                        })}
                     </div>
                </div>
            </div>

            {/* GRID SCROLLABLE */}
            <div className="flex-1 overflow-y-auto relative no-scrollbar bg-white">
                <div className="flex relative min-h-full">
                    
                    {/* COLUMNA HORAS (Izquierda) */}
                    <div className="w-14 flex-shrink-0 border-r border-gray-200 bg-gray-50/50 sticky left-0 z-20">
                        {hours.map(h => (
                            <div key={h} className="h-20 text-right pr-2 pt-1 text-xs text-gray-400 font-mono border-b border-transparent relative">
                                <span className="-top-2 relative">{h}:00</span>
                            </div>
                        ))}
                    </div>

                    {/* COLUMNAS DE DÍAS (Fondo y Eventos) */}
                    <div className="flex-1 flex relative">
                        {/* Líneas de horas (Fondo) */}
                        <div className="absolute inset-0 flex flex-col pointer-events-none z-0">
                            {hours.map(h => <div key={h} className="h-20 border-b border-dashed border-gray-100 w-full"></div>)}
                        </div>

                        {/* Columnas verticales */}
                        {weekDays.map((day, i) => {
                            // Filtramos eventos que se intersectan con este día
                            const dayStart = startOfDay(day);
                            const dayEnd = endOfDay(day);

                            const dayEvents = events.filter(e => {
                                if (e.allDay) return false;
                                const eventStart = new Date(e.start);
                                const eventEnd = new Date(e.end);
                                // Intersección: (StartA <= EndB) and (EndA >= StartB)
                                // Usamos < y > estricto para evitar eventos de 0ms que toquen el borde
                                return eventStart < dayEnd && eventEnd > dayStart; 
                            });

                            return (
                                <div key={i} className={`flex-1 border-r border-gray-100 relative z-10 ${isSameDay(day, new Date()) ? 'bg-blue-50/5' : ''}`}>
                                    
                                    {/* RENDERIZAR EVENTOS DEL DÍA */}
                                    {dayEvents.map(event => {
                                        // CLAMPING: Recortar visualmente el evento para que quepa en este día
                                        const eventStart = new Date(event.start);
                                        const eventEnd = new Date(event.end);
                                        
                                        const visualStart = max([dayStart, eventStart]);
                                        const visualEnd = min([dayEnd, eventEnd]);

                                        const startMinutes = visualStart.getHours() * 60 + visualStart.getMinutes();
                                        const duration = differenceInMinutes(visualEnd, visualStart);
                                        
                                        return (
                                        <div
                                            key={event.id}
                                            className={`absolute rounded-md border-l-2 px-1 text-[10px] shadow-sm cursor-pointer hover:brightness-95 transition-all overflow-hidden ${event.color} opacity-90`}
                                            style={{
                                                top: `${startMinutes * (HOUR_HEIGHT / 60)}px`,
                                                height: `${duration * (HOUR_HEIGHT / 60)}px`,
                                                left: '2px',
                                                right: '2px'
                                            }}
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                if (onEventClick) onEventClick(event); 
                                            }}
                                        >
                                            <div className="font-bold truncate leading-tight">{event.title}</div>
                                            <div className="truncate opacity-80 scale-90 origin-top-left">
                                                {format(new Date(event.start), 'HH:mm')}
                                            </div>
                                        </div>
                                    )})}

                                    {/* Línea de hora actual (si es hoy) */}
                                    {isSameDay(day, new Date()) && (
                                        <div 
                                            className="absolute w-full border-t-2 border-red-400 z-50 pointer-events-none opacity-50"
                                            style={{ top: `${(new Date().getHours() * 60 + new Date().getMinutes()) * (80 / 60)}px` }}
                                        ></div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default WeekView;