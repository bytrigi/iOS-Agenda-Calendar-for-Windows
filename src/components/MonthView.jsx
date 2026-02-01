import React, { useMemo } from 'react';
import { startOfMonth, endOfMonth, startOfWeek, endOfWeek, eachWeekOfInterval, eachDayOfInterval, format, isSameMonth, isSameDay, differenceInCalendarDays, max, min, startOfDay, endOfDay } from 'date-fns';
import { es } from 'date-fns/locale';

// CONFIGURACIÓN VISUAL
const MAX_VISIBLE_EVENTS = 4; 
const ROW_HEIGHT_CLASS = 'h-15'; // Altura fija de la celda

const MonthView = ({ date, onDayClick, onEventClick, events = [] }) => {
    const monthStart = startOfMonth(date);
    const monthEnd = endOfMonth(date);
    const calendarStart = startOfWeek(monthStart, { weekStartsOn: 1 });
    const calendarEnd = endOfWeek(monthEnd, { weekStartsOn: 1 });

    const weeks = eachWeekOfInterval({ start: calendarStart, end: calendarEnd }, { weekStartsOn: 1 });
    const weekDaysNames = ['lun', 'mar', 'mié', 'jue', 'vie', 'sáb', 'dom'];

    return (
        <div className="flex flex-col h-full bg-white/60 p-4 overflow-hidden font-sans">
             <h2 className="text-3xl font-serif font-bold text-gray-800 mb-4 capitalize pl-2">
                {format(date, 'MMMM yyyy', { locale: es })}
            </h2>

            {/* Header Días */}
            <div className="grid grid-cols-7 mb-2 border-b border-gray-200 pb-2">
                {weekDaysNames.map(d => (
                    <div key={d} className="text-center text-xs font-bold text-gray-400 uppercase tracking-widest">{d}</div>
                ))}
            </div>

            {/* Grid de Semanas */}
            <div className="flex-1 flex flex-col overflow-y-auto no-scrollbar gap-1">
                {weeks.map((weekStart, weekIdx) => {
                    const weekEnd = endOfWeek(weekStart, { weekStartsOn: 1 });
                    const daysInWeek = eachDayOfInterval({ start: weekStart, end: weekEnd });

                    // LOGICA DE SLOTS (Row Index)
                    const layout = useMemo(() => {
                         const weekStartOfDay = startOfDay(weekStart);
                         const weekEndOfDay = endOfDay(weekEnd);
                         
                         // 1. Filtrar y ordenar
                         const weekEvents = events.filter(e => {
                             const start = new Date(e.start); const end = new Date(e.end);
                             return start <= weekEndOfDay && end >= weekStartOfDay;
                         }).sort((a,b) => (new Date(a.start) - new Date(b.start)) || (new Date(b.end) - new Date(a.end)) - (new Date(a.end) - new Date(a.start)));

                         // 2. Asignar Slots
                         const slots = []; // slots[rowIndex][dayIndex] = true
                         const result = [];

                         weekEvents.forEach(event => {
                             const eventStart = max([startOfDay(new Date(event.start)), weekStartOfDay]);
                             const eventEnd = min([endOfDay(new Date(event.end)), weekEndOfDay]);
                             
                             const colStart = differenceInCalendarDays(eventStart, weekStartOfDay);
                             const span = differenceInCalendarDays(eventEnd, eventStart) + 1;

                             // Buscar fila libre
                             let rowIndex = 0;
                             let found = false;
                             while (!found) {
                                 if (!slots[rowIndex]) slots[rowIndex] = [];
                                 let isRowClear = true;
                                 for (let d = 0; d < span; d++) {
                                     if (slots[rowIndex][colStart + d]) { isRowClear = false; break; }
                                 }
                                 if (isRowClear) found = true;
                                 else rowIndex++;
                             }

                             // Marcar ocupado
                             for (let d = 0; d < span; d++) slots[rowIndex][colStart + d] = true;

                             result.push({ event, colStart: colStart + 1, span, rowIndex });
                         });

                         // 3. Contar eventos por día (para el "+X")
                         const eventsPerDay = Array(7).fill(0);
                         result.forEach(item => {
                             for(let i=0; i < item.span; i++) {
                                 const dayIndex = (item.colStart - 1) + i;
                                 if (dayIndex >= 0 && dayIndex < 7) eventsPerDay[dayIndex]++;
                             }
                         });

                         return { items: result, eventsPerDay };

                    }, [events, weekStart, weekEnd]);

                    return (
                        <div key={weekIdx} className={`flex-1 ${ROW_HEIGHT_CLASS} relative min-h-[100px]`}>
                             {/* CAPA 1: Grid de Días (Fondo) */}
                             <div className="absolute inset-0 grid grid-cols-7 gap-1 z-0">
                                {daysInWeek.map((dayItem, dayIdx) => {
                                    const isCurrentMonth = isSameMonth(dayItem, monthStart);
                                    const isToday = isSameDay(dayItem, new Date());
                                    const totalEvents = layout.eventsPerDay[dayIdx];
                                    const overflowCount = totalEvents > MAX_VISIBLE_EVENTS ? totalEvents - (MAX_VISIBLE_EVENTS - 1) : 0; 
                                    // Nota: Si hay overflow, mostramos MAX-1 eventos + el indicador.
                                    // O simplificamos: mostramos MAX eventos y si hay más, tapamos el último con el "+X"? 
                                    // Estrategia simple: Si total > MAX, renderizamos MAX, pero el indicador "+X" se pinta encima.

                                    return (
                                        <div 
                                            key={dayIdx}
                                            onClick={() => onDayClick && onDayClick(dayItem)}
                                            className={`
                                                border border-gray-200/60 rounded-lg p-1 relative flex flex-col cursor-pointer transition-all
                                                ${!isCurrentMonth ? 'bg-gray-50/50 text-gray-300' : 'bg-white hover:border-blue-400 hover:shadow-md'}
                                            `}
                                        >
                                             <div className="flex justify-between items-start">
                                                <span className={`text-xs font-semibold ml-1 mt-1 ${isToday ? 'text-white bg-red-500 w-5 h-5 rounded-full flex items-center justify-center shadow-sm' : ''}`}>
                                                    {format(dayItem, 'd')}
                                                </span>
                                                {/* Indicador Overflow */}
                                                {totalEvents > MAX_VISIBLE_EVENTS && (
                                                    <span className="text-[9px] font-bold text-gray-400 mr-1 mt-1">
                                                        +{totalEvents - MAX_VISIBLE_EVENTS}
                                                    </span>
                                                )}
                                             </div>
                                        </div>
                                    );
                                })}
                             </div>

                             {/* CAPA 2: Grid de Eventos (Frente) */}
                             {/* Usamos un grid que empieza debajo de la fecha (aprox 24px) */}
                             <div className="absolute inset-x-0 top-7 bottom-0 grid grid-cols-7 gap-1 px-1 pointer-events-none z-10">
                                {layout.items.map((item, idx) => {
                                    // Si excede el máximo visible, no renderizar (o dejarlo oculto)
                                    if (item.rowIndex >= MAX_VISIBLE_EVENTS) return null;

                                    return (
                                        <div
                                            key={item.event.id + idx}
                                            style={{ 
                                                gridColumn: `${item.colStart} / span ${item.span}`,
                                                top: `${8 + item.rowIndex * 20}px`, 
                                                height: '18px',
                                                position: 'absolute',
                                                left: '2px',
                                                right: '2px'
                                            }}
                                            className={`
                                                text-[10px] px-1.5 rounded-sm font-bold shadow-sm pointer-events-auto cursor-pointer flex items-center
                                                ${item.event.color} text-gray-700 hover:brightness-95 transition-transform hover:scale-[1.01]
                                                truncate leading-none
                                            `}
                                            title={item.event.title}
                                            onClick={(e) => { 
                                                e.stopPropagation(); 
                                                if (onEventClick) onEventClick(item.event);
                                            }}
                                        >
                                            <span className="truncate w-full">{item.event.title}</span>
                                        </div>
                                    );
                                })}
                             </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

export default MonthView;