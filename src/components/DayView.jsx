import React, { useEffect, useRef, useState } from 'react';
import { format, isSameDay, startOfDay, endOfDay, max, min, differenceInMinutes } from 'date-fns';
import { es } from 'date-fns/locale';
import { db } from '../db/database';
import { useLiveQuery } from 'dexie-react-hooks';
import { Circle, CheckCircle2, ListTodo, Plus, X, ChevronDown, ChevronRight, CornerDownRight, Check, Trash2 } from 'lucide-react';

const DayView = ({ date, events, onEventClick }) => {
    const scrollRef = useRef(null);
    
    // ESTADOS UI
    const [showTasks, setShowTasks] = useState(false);
    const [quickTask, setQuickTask] = useState('');
    
    // ESTADOS SUBTAREAS
    const [expandedTaskId, setExpandedTaskId] = useState(null);
    const [newSubtaskTitle, setNewSubtaskTitle] = useState('');

    // 1. CARGAR TAREAS PENDIENTES
    const tasks = useLiveQuery(async () => {
        const allTasks = await db.tasks.toArray();
        return allTasks
            .filter(t => !t.completed) 
            .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    }) || [];

    // Scroll automático a las 8:00 AM
    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = 560; 
        }
    }, [date]);

    // --- LÓGICA DE TAREAS ---

    const toggleTask = async (task) => {
        await db.tasks.update(task.id, { completed: !task.completed });
    };

    const handleAddQuickTask = async (e) => {
        if ((e.key === 'Enter' || e.type === 'click') && quickTask.trim()) {
            await db.tasks.add({
                id: crypto.randomUUID(),
                title: quickTask,
                completed: false,
                subtasks: [],
                createdAt: new Date()
            });
            setQuickTask('');
        }
    };

    // --- LÓGICA DE SUBTAREAS (Importada de TasksView) ---

    const handleAddSubtask = async (parentId, e) => {
        if ((e.key === 'Enter' || e.type === 'click') && newSubtaskTitle.trim()) {
            await db.transaction('rw', db.tasks, async () => {
                const parentTask = await db.tasks.get(parentId);
                if (parentTask) {
                    const subtasks = parentTask.subtasks || [];
                    subtasks.push({
                        id: crypto.randomUUID(),
                        title: newSubtaskTitle,
                        completed: false
                    });
                    await db.tasks.update(parentId, { subtasks });
                }
            });
            setNewSubtaskTitle(''); 
        }
    };

    const toggleSubtask = async (parentId, subtaskId) => {
        await db.transaction('rw', db.tasks, async () => {
            const parentTask = await db.tasks.get(parentId);
            if (parentTask && parentTask.subtasks) {
                const newSubtasks = parentTask.subtasks.map(s => 
                    s.id === subtaskId ? { ...s, completed: !s.completed } : s
                );
                // Comprobación automática de completado
                const allSubtasksCompleted = newSubtasks.every(s => s.completed);
                await db.tasks.update(parentId, { 
                    subtasks: newSubtasks,
                    completed: allSubtasksCompleted
                });
            }
        });
    };

    const deleteSubtask = async (parentId, subtaskId) => {
        await db.transaction('rw', db.tasks, async () => {
            const parentTask = await db.tasks.get(parentId);
            if (parentTask && parentTask.subtasks) {
                const newSubtasks = parentTask.subtasks.filter(s => s.id !== subtaskId);
                await db.tasks.update(parentId, { subtasks: newSubtasks });
            }
        });
    };

    const toggleExpand = (id) => {
        if (expandedTaskId === id) {
            setExpandedTaskId(null); 
        } else {
            setExpandedTaskId(id); 
            setNewSubtaskTitle(''); 
        }
    };

    // --- LÓGICA DE EVENTOS ---
    const hours = Array.from({ length: 24 }, (_, i) => i);

    // Filtramos eventos que INTERSECTAN con el día actual (00:00 - 23:59)
    const dayStart = startOfDay(date);
    const dayEnd = endOfDay(date);
    
    const dayEvents = events.filter(event => {
        if (event.allDay) return false;
        const eventStart = new Date(event.start);
        const eventEnd = new Date(event.end);
        // Intersección estricta para visualización
        return eventStart < dayEnd && eventEnd > dayStart;
    });

    const allDayEvents = events.filter(event => {
        if (!event.allDay) return false;
        const currentViewDate = startOfDay(date);
        const eventStart = startOfDay(new Date(event.start));
        const eventEnd = startOfDay(new Date(event.end));
        return currentViewDate >= eventStart && currentViewDate <= eventEnd;
    }).sort((a, b) => {
        const startDiff = new Date(a.start) - new Date(b.start);
        if (startDiff !== 0) return startDiff;
        return (new Date(b.end) - new Date(b.start)) - (new Date(a.end) - new Date(a.start));
    });

    const getEventStyle = (event) => {
        const start = new Date(event.start);
        const end = new Date(event.end);
        const startMinutes = start.getHours() * 60 + start.getMinutes();
        const durationMinutes = (end - start) / (1000 * 60);

        return {
            top: `${(startMinutes / 60) * 80}px`,
            height: `${(durationMinutes / 60) * 80}px`,
            left: '60px',
            right: '10px'
        };
    };

    const hexToRgba = (hex, alpha) => {
        if (!hex) return `rgba(79, 172, 242, ${alpha})`;
        let c;
        if (/^#([A-Fa-f0-9]{3}){1,2}$/.test(hex)) {
            c = hex.substring(1).split('');
            if (c.length === 3) {
                c = [c[0], c[0], c[1], c[1], c[2], c[2]];
            }
            c = '0x' + c.join('');
            return 'rgba(' + [(c >> 16) & 255, (c >> 8) & 255, c & 255].join(',') + ',' + alpha + ')';
        }
        return hex;
    };

    const getEventColor = (color) => {
        if (!color) return '#4FACF2';
        if (color.startsWith('#')) return color;
        if (color.includes('blue')) return '#4FACF2';
        if (color.includes('red')) return '#EA426A';
        if (color.includes('green')) return '#308014';
        if (color.includes('yellow')) return '#FFCC00';
        if (color.includes('purple')) return '#A020F0';
        if (color.includes('orange')) return '#FF7D40';
        return '#4FACF2';
    };

    // COMPROBACIÓN: ¿Es hoy?
    const isToday = isSameDay(date, new Date());

    return (
        <div className="flex h-full relative">
            
            {/* --- ZONA CALENDARIO --- */}
            <div className="flex-1 flex flex-col h-full bg-white relative transition-all duration-300">
                
                {/* Cabecera */}
                <div className="p-6 border-b border-gray-100 flex justify-between items-end bg-white z-10 sticky top-0 shadow-[0_4px_20px_-10px_rgba(0,0,0,0.05)]">
                    <div>
                        {/* FECHA: Rojo si es hoy, Negro si no */}
                        <h2 className={`text-5xl font-serif font-bold capitalize leading-none ${isToday ? 'text-red-500' : 'text-gray-800'}`}>
                            {format(date, 'EEEE', { locale: es })}
                        </h2>
                        <p className={`text-xl mt-1 font-light ${isToday ? 'text-red-400' : 'text-gray-400'}`}>
                            {format(date, 'd MMMM yyyy', { locale: es })}
                        </p>
                    </div>
                    
                    <div className="flex items-end gap-6">
                        <div className="text-right">
                            <span className="text-4xl font-bold text-gray-800 block leading-none">
                                {dayEvents.length + allDayEvents.length}
                            </span>
                            <span className="text-xs text-gray-400 uppercase tracking-widest font-bold">Eventos</span>
                        </div>

                        <button 
                            onClick={() => setShowTasks(!showTasks)}
                            className={`p-2 rounded-xl transition-all ${showTasks ? 'bg-blue-100 text-blue-600' : 'bg-gray-100 text-gray-400 hover:text-gray-600'}`}
                        >
                            <ListTodo size={24} />
                        </button>
                    </div>
                </div>

                {allDayEvents.length > 0 && (
                    <div className="px-14 py-2 border-b border-gray-100 bg-gray-50/30 flex flex-wrap gap-2 z-10 relative flex-shrink-0">
                        <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest self-center mr-2">Todo el día</span>
                        {allDayEvents.map(event => (
                            <button
                                key={event.id}
                                onClick={(e) => { e.stopPropagation(); onEventClick(event); }}
                                className={`px-3 py-1 rounded-md text-xs font-bold shadow-sm border-l-4 border-black/10 hover:brightness-95 transition-transform hover:scale-105 text-white`}
                                style={{ backgroundColor: getEventColor(event.color) }}
                            >
                                {event.title}
                            </button>
                        ))}
                    </div>
                )}

                {/* Grid Horas */}
                <div ref={scrollRef} className="flex-1 overflow-y-auto relative no-scrollbar">
                    {hours.map(hour => (
                        <div key={hour} className="group flex h-[80px] border-b border-gray-50 relative">
                            <div className="w-[60px] text-right pr-4 py-2 text-xs font-bold text-gray-300 group-hover:text-blue-400 transition-colors select-none">
                                {hour}:00
                            </div>
                            <div className="flex-1 relative">
                                <div className="absolute top-1/2 left-0 right-0 border-t border-dotted border-gray-50 w-full h-0" />
                            </div>
                        </div>
                    ))}

                    {dayEvents.map(event => {
                         // CLAMPING: Visualización recortada al día actual
                        const eventStart = new Date(event.start);
                        const eventEnd = new Date(event.end);
                        
                        const visualStart = max([dayStart, eventStart]);
                        const visualEnd = min([dayEnd, eventEnd]);

                        const startMinutes = visualStart.getHours() * 60 + visualStart.getMinutes();
                        const durationMinutes = differenceInMinutes(visualEnd, visualStart);
                        
                        return (
                        <div
                            key={event.id}
                            onClick={(e) => { e.stopPropagation(); onEventClick(event); }}
                            style={{
                                top: `${(startMinutes / 60) * 80}px`,
                                height: `${(durationMinutes / 60) * 80}px`,
                                left: '60px',
                                right: '10px',
                                backgroundColor: hexToRgba(getEventColor(event.color), 0.15),
                                borderLeftColor: getEventColor(event.color),
                                color: getEventColor(event.color),
                            }}
                            className={`absolute rounded-lg p-3 cursor-pointer shadow-sm hover:shadow-md transition-all border-l-4 hover:brightness-95 overflow-hidden flex flex-col justify-center animate-popIn`}
                        >
                            <div className="font-bold text-sm leading-tight line-clamp-1" style={{ color: getEventColor(event.color), filter: 'brightness(0.7)' }}>{event.title}</div>
                            <div className="text-xs opacity-80 mt-1 font-medium" style={{ color: getEventColor(event.color), filter: 'brightness(0.7)' }}>
                                {format(new Date(event.start), 'HH:mm')} - {format(new Date(event.end), 'HH:mm')}
                            </div>
                        </div>
                    )})}

                    {/* Línea roja hora actual (Solo si es hoy) */}
                    {isToday && (
                        <div 
                            className="absolute left-[60px] right-0 border-t-2 border-red-400 z-20 pointer-events-none flex items-center"
                            style={{ top: `${(new Date().getHours() * 60 + new Date().getMinutes()) / 60 * 80}px` }}
                        >
                            <div className="w-2 h-2 bg-red-400 rounded-full -ml-1 shadow-sm"></div>
                        </div>
                    )}
                </div>
            </div>

            {/* --- ZONA TAREAS LATERAL --- */}
            {showTasks && (
                <div className="w-80 bg-gray-50/80 backdrop-blur-sm flex flex-col border-l border-gray-100 shadow-xl animate-slideInRight z-20 absolute right-0 h-full md:relative md:shadow-none">
                    
                    <div className="p-6 pb-4 flex justify-between items-center">
                        <h3 className="text-sm font-bold text-gray-400 uppercase tracking-widest flex items-center gap-2">
                            <CheckCircle2 size={16} />
                            Pendientes
                        </h3>
                        <button onClick={() => setShowTasks(false)} className="text-gray-400 hover:text-red-400">
                            <X size={16} />
                        </button>
                    </div>

                    {/* INPUT RÁPIDO */}
                    <div className="px-4 mb-4">
                        <div className="flex items-center gap-2 bg-white p-2 rounded-xl border border-gray-200 focus-within:ring-2 focus-within:ring-blue-100 transition-all shadow-sm">
                            <Plus size={16} className="text-gray-400" />
                            <input 
                                type="text" 
                                placeholder="Añadir tarea..."
                                className="flex-1 bg-transparent border-none outline-none text-sm text-gray-700 placeholder-gray-400"
                                value={quickTask}
                                onChange={(e) => setQuickTask(e.target.value)}
                                onKeyDown={handleAddQuickTask}
                            />
                            <button 
                                onClick={handleAddQuickTask}
                                className="bg-blue-100 hover:bg-blue-200 text-blue-600 p-1 rounded-md transition-colors"
                            >
                                <Plus size={14} />
                            </button>
                        </div>
                    </div>

                    {/* LISTA CON SUBTAREAS */}
                    <div className="flex-1 overflow-y-auto px-4 pb-6 no-scrollbar space-y-3">
                        {tasks.length === 0 ? (
                            <div className="text-center mt-10 opacity-40">
                                <p className="text-sm text-gray-400">¡Todo al día!</p>
                            </div>
                        ) : (
                            tasks.map(task => {
                                const isExpanded = expandedTaskId === task.id;
                                const subtasks = task.subtasks || [];
                                const completedSubs = subtasks.filter(s => s.completed).length;

                                return (
                                    <div key={task.id} className={`group bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden transition-all ${isExpanded ? 'ring-1 ring-blue-100' : 'hover:shadow-md'}`}>
                                        
                                        {/* CABECERA TAREA */}
                                        <div className="flex items-start p-3 gap-3">
                                            {/* Botón expandir */}
                                            <button 
                                                onClick={() => toggleExpand(task.id)}
                                                className={`mt-0.5 text-gray-300 hover:text-blue-500 transition-colors p-0.5 rounded ${isExpanded ? 'text-blue-500 bg-blue-50' : ''}`}
                                            >
                                                {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                                            </button>

                                            <button 
                                                onClick={() => toggleTask(task)}
                                                className="mt-0.5 text-gray-300 hover:text-blue-500 transition-colors"
                                            >
                                                <Circle size={18} />
                                            </button>
                                            
                                            <div className="flex-1 min-w-0">
                                                <span className="text-sm font-medium text-gray-700 leading-tight block cursor-pointer" onClick={() => toggleExpand(task.id)}>
                                                    {task.title}
                                                </span>
                                                {subtasks.length > 0 && !isExpanded && (
                                                    <p className="text-[10px] text-gray-400 mt-1">
                                                        {completedSubs}/{subtasks.length} pasos
                                                    </p>
                                                )}
                                            </div>
                                        </div>

                                        {/* SUBTAREAS DESPLEGABLES */}
                                        {isExpanded && (
                                            <div className="bg-gray-50/50 border-t border-gray-100 p-3 pl-10 space-y-2">
                                                {subtasks.map(sub => (
                                                    <div key={sub.id} className="flex items-center gap-2 group/sub">
                                                        <CornerDownRight size={12} className="text-gray-300" />
                                                        <button 
                                                            onClick={() => toggleSubtask(task.id, sub.id)}
                                                            className={`w-3 h-3 rounded border flex items-center justify-center transition-all ${sub.completed ? 'bg-blue-400 border-blue-400 text-white' : 'border-gray-300 text-transparent hover:border-blue-400'}`}
                                                        >
                                                            <Check size={8} strokeWidth={4} />
                                                        </button>
                                                        <span className={`flex-1 text-xs ${sub.completed ? 'text-gray-400 line-through' : 'text-gray-600'}`}>
                                                            {sub.title}
                                                        </span>
                                                        <button 
                                                            onClick={() => deleteSubtask(task.id, sub.id)}
                                                            className="text-gray-300 hover:text-red-400 opacity-0 group-hover/sub:opacity-100 transition-opacity"
                                                        >
                                                            <X size={12} />
                                                        </button>
                                                    </div>
                                                ))}

                                                {/* AÑADIR SUBTAREA */}
                                                <div className="flex items-center gap-2 mt-2 pt-1">
                                                    <Plus size={12} className="text-gray-400" />
                                                    <input 
                                                        type="text"
                                                        placeholder="Nuevo paso..."
                                                        className="flex-1 bg-transparent border-b border-transparent focus:border-blue-200 outline-none text-xs text-gray-600 placeholder-gray-400 py-0.5"
                                                        value={newSubtaskTitle}
                                                        onChange={(e) => setNewSubtaskTitle(e.target.value)}
                                                        onKeyDown={(e) => handleAddSubtask(task.id, e)}
                                                    />
                                                    <button 
                                                        onClick={(e) => handleAddSubtask(task.id, e)}
                                                        className="text-[10px] font-bold text-blue-500 uppercase hover:text-blue-700"
                                                    >
                                                        Add
                                                    </button>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                );
                            })
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

export default DayView;