import React, { useState, useEffect, useRef, useMemo } from 'react';
import { db } from '../db/database';
import { Search, Calendar, CheckCircle, StickyNote, X, ArrowRight } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

const GlobalSearch = ({ isOpen, onClose, onNavigate }) => {
    const [query, setQuery] = useState('');
    const [results, setResults] = useState({ events: [], tasks: [], notes: [] });
    const [selectedIndex, setSelectedIndex] = useState(-1);
    const inputRef = useRef(null);
    const scrollContainerRef = useRef(null);

    const flatResults = useMemo(() => {
        return [
            ...results.events.map(e => ({ type: 'event', item: e })),
            ...results.tasks.map(t => ({ type: 'task', item: t })),
            ...results.notes.map(n => ({ type: 'note', item: n }))
        ];
    }, [results]);

    useEffect(() => {
        setSelectedIndex(-1);
    }, [query]);

    // Enfocar el input siempre que se abra
    useEffect(() => {
        if (isOpen && inputRef.current) {
            setTimeout(() => inputRef.current.focus(), 50);
        }
        if (!isOpen) {
            setQuery(''); // Limpiar al cerrar
            setResults({ events: [], tasks: [], notes: [] });
        }
    }, [isOpen]);

    // Lógica de búsqueda en tiempo real
    useEffect(() => {
        const search = async () => {
            if (!query.trim()) {
                setResults({ events: [], tasks: [], notes: [] });
                return;
            }

            const lowerQuery = query.toLowerCase();

            // Buscamos en las 3 tablas a la vez
            const [foundEvents, foundTasks, foundNotes] = await Promise.all([
                db.events.filter(e => e.title.toLowerCase().includes(lowerQuery)).toArray(),
                db.tasks.filter(t => t.title.toLowerCase().includes(lowerQuery)).toArray(),
                db.notes.filter(n => n.title.toLowerCase().includes(lowerQuery) || n.content.toLowerCase().includes(lowerQuery)).toArray()
            ]);

            setResults({
                events: foundEvents.slice(0, 5), // Limitamos a 5 por categoría
                tasks: foundTasks.slice(0, 5),
                notes: foundNotes.slice(0, 5)
            });
        };

        const timeoutId = setTimeout(search, 150); // Pequeño delay para no saturar
        return () => clearTimeout(timeoutId);
    }, [query]);

    // Cerrar con tecla Escape y navegación con flechas
    useEffect(() => {
        const handleKeyDown = (e) => {
            if (!isOpen) return;
            
            if (e.key === 'Escape') onClose();
            else if (e.key === 'ArrowDown') {
                e.preventDefault();
                setSelectedIndex(prev => (prev < flatResults.length - 1 ? prev + 1 : prev));
            } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                setSelectedIndex(prev => (prev > 0 ? prev - 1 : prev));
            } else if (e.key === 'Enter') {
                e.preventDefault();
                if (selectedIndex >= 0 && selectedIndex < flatResults.length) {
                    const selected = flatResults[selectedIndex];
                    onNavigate(selected.type, selected.item);
                } else if (flatResults.length > 0) {
                    onNavigate(flatResults[0].type, flatResults[0].item);
                }
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [isOpen, onClose, flatResults, selectedIndex, onNavigate]);

    // Scroll automático al elemento seleccionado
    useEffect(() => {
        if (selectedIndex >= 0 && scrollContainerRef.current) {
            const container = scrollContainerRef.current;
            const element = container.querySelector(`[data-index="${selectedIndex}"]`);
            if (element) {
                element.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
            }
        }
    }, [selectedIndex]);

    if (!isOpen) return null;

    const hasResults = flatResults.length > 0;
    let globalItemIndex = 0;

    return (
        <div className="fixed inset-0 z-[200] flex items-start justify-center pt-[15vh] bg-black/20 dark:bg-black/40 backdrop-blur-sm animate-fadeIn">
            
            <div className="w-full max-w-2xl bg-white dark:bg-slate-900 rounded-2xl shadow-2xl overflow-hidden flex flex-col animate-popIn ring-1 ring-black/5 dark:ring-white/10">
                
                {/* BARRA DE BÚSQUEDA */}
                <div className="flex items-center gap-4 p-6 border-b border-gray-100 dark:border-slate-800">
                    <Search size={24} className="text-gray-400 dark:text-gray-500" />
                    <input 
                        ref={inputRef}
                        type="text" 
                        placeholder="Buscar en tu agenda..." 
                        className="flex-1 text-2xl font-medium text-gray-800 dark:text-gray-100 placeholder-gray-300 dark:placeholder-gray-600 outline-none bg-transparent"
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                    />
                    <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-gray-300 dark:text-gray-600 border border-gray-200 dark:border-slate-700 rounded px-2 py-1">ESC</span>
                        <button onClick={onClose}><X size={20} className="text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300" /></button>
                    </div>
                </div>

                {/* RESULTADOS */}
                <div ref={scrollContainerRef} className="max-h-[60vh] overflow-y-auto custom-scrollbar">
                    
                    {!hasResults && query && (
                        <div className="p-10 text-center text-gray-400 dark:text-gray-500">
                            <p>No se encontraron resultados para "{query}"</p>
                        </div>
                    )}

                    {!query && (
                        <div className="p-10 text-center text-gray-300 dark:text-gray-600 text-sm">
                            Escribe para buscar eventos, tareas o notas...
                        </div>
                    )}

                    {/* SECCIÓN EVENTOS */}
                    {results.events.length > 0 && (
                        <div className="p-2">
                            <h3 className="px-4 py-2 text-xs font-bold text-gray-400 dark:text-gray-600 uppercase tracking-widest">Calendario</h3>
                            {results.events.map(event => {
                                const index = globalItemIndex++;
                                const isActive = index === selectedIndex;
                                return (
                                <button 
                                    key={event.id}
                                    data-index={index}
                                    onClick={() => onNavigate('event', event)}
                                    onMouseEnter={() => setSelectedIndex(index)}
                                    className={`w-full flex items-center gap-4 p-3 rounded-xl transition-colors group text-left ${isActive ? 'bg-blue-50 dark:bg-blue-900/30 ring-1 ring-blue-200 dark:ring-blue-700' : 'hover:bg-blue-50/50 dark:hover:bg-blue-900/10'}`}
                                >
                                    <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${event.color || 'bg-blue-100 dark:bg-blue-900/50'} text-gray-700 dark:text-gray-200`}>
                                        <Calendar size={20} />
                                    </div>
                                    <div className="flex-1">
                                        <p className="font-bold text-gray-800 dark:text-gray-200">{event.title}</p>
                                        <p className="text-xs text-gray-500 dark:text-gray-400">
                                            {format(new Date(event.start), "d 'de' MMMM, HH:mm", { locale: es })}
                                        </p>
                                    </div>
                                    <ArrowRight size={16} className={`text-gray-300 dark:text-gray-600 transition-opacity ${isActive ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`} />
                                </button>
                            )})}
                        </div>
                    )}

                    {/* SECCIÓN TAREAS */}
                    {results.tasks.length > 0 && (
                        <div className="p-2 border-t border-gray-50 dark:border-slate-800">
                            <h3 className="px-4 py-2 text-xs font-bold text-gray-400 dark:text-gray-600 uppercase tracking-widest">Tareas</h3>
                            {results.tasks.map(task => {
                                const index = globalItemIndex++;
                                const isActive = index === selectedIndex;
                                return (
                                <button 
                                    key={task.id}
                                    data-index={index}
                                    onClick={() => onNavigate('task', task)}
                                    onMouseEnter={() => setSelectedIndex(index)}
                                    className={`w-full flex items-center gap-4 p-3 rounded-xl transition-colors group text-left ${isActive ? 'bg-green-50 dark:bg-green-900/30 ring-1 ring-green-200 dark:ring-green-700' : 'hover:bg-green-50/50 dark:hover:bg-green-900/10'}`}
                                >
                                    <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${task.completed ? 'bg-green-100 dark:bg-green-900/50 text-green-700 dark:text-green-400' : 'bg-gray-100 dark:bg-slate-800 text-gray-500 dark:text-gray-400'}`}>
                                        <CheckCircle size={20} />
                                    </div>
                                    <div className="flex-1">
                                        <p className={`font-bold text-gray-800 dark:text-gray-200 ${task.completed ? 'line-through opacity-60' : ''}`}>{task.title}</p>
                                        <p className="text-xs text-gray-500 dark:text-gray-400">
                                            {task.completed ? 'Completada' : 'Pendiente'}
                                        </p>
                                    </div>
                                    <ArrowRight size={16} className={`text-gray-300 dark:text-gray-600 transition-opacity ${isActive ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`} />
                                </button>
                            )})}
                        </div>
                    )}

                    {/* SECCIÓN NOTAS */}
                    {results.notes.length > 0 && (
                        <div className="p-2 border-t border-gray-50 dark:border-slate-800">
                            <h3 className="px-4 py-2 text-xs font-bold text-gray-400 dark:text-gray-600 uppercase tracking-widest">Notas</h3>
                            {results.notes.map(note => {
                                const index = globalItemIndex++;
                                const isActive = index === selectedIndex;
                                return (
                                <button 
                                    key={note.id}
                                    data-index={index}
                                    onClick={() => onNavigate('note', note)}
                                    onMouseEnter={() => setSelectedIndex(index)}
                                    className={`w-full flex items-center gap-4 p-3 rounded-xl transition-colors group text-left ${isActive ? 'bg-yellow-50 dark:bg-yellow-900/30 ring-1 ring-yellow-200 dark:ring-yellow-700' : 'hover:bg-yellow-50/50 dark:hover:bg-yellow-900/10'}`}
                                >
                                    <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${note.color.split(' ')[0] || 'bg-yellow-100'} ${note.color.split(' ')[1] || 'dark:bg-yellow-900/50'} text-gray-700 dark:text-gray-200 shadow-sm`}>
                                        <StickyNote size={20} />
                                    </div>
                                    <div className="flex-1 overflow-hidden">
                                        <p className="font-bold text-gray-800 dark:text-gray-200 truncate">{note.title}</p>
                                        <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{note.content || 'Sin contenido'}</p>
                                    </div>
                                    <ArrowRight size={16} className={`text-gray-300 dark:text-gray-600 transition-opacity ${isActive ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`} />
                                </button>
                            )})}
                        </div>
                    )}
                </div>
                
                {/* FOOTER */}
                <div className="bg-gray-50 dark:bg-slate-800/50 p-3 flex justify-between items-center text-[10px] text-gray-400 dark:text-gray-500 font-bold uppercase tracking-wider px-6">
                    <span>Buscador Global</span>
                    <div className="flex gap-4">
                        <span className="flex items-center gap-1">⇅ Navegar</span>
                        <span className="flex items-center gap-1">↵ Abrir</span>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default GlobalSearch;