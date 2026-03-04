import React, { useState } from 'react';
import { db } from '../db/database';
import { useLiveQuery } from 'dexie-react-hooks';
import { Plus, X, Trash2, Pin } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { es } from 'date-fns/locale';
import ConfirmModal from './ConfirmModal'; // <--- IMPORTAMOS LA NUEVA ALERTA

const NotesView = () => {
    // ESTADO GENERAL
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingNote, setEditingNote] = useState(null);

    // ESTADO PARA LA ALERTA DE BORRADO
    const [isDeleteAlertOpen, setIsDeleteAlertOpen] = useState(false);

    // CAMPOS FORMULARIO
    const [title, setTitle] = useState('');
    const [content, setContent] = useState('');
    const [color, setColor] = useState('bg-gray-100 dark:bg-slate-800 text-gray-800 dark:text-gray-100');
    const [isPinned, setIsPinned] = useState(false);

    // COLORES DISPONIBLES
    const colors = [
        { id: 'neutral', class: 'bg-gray-100 dark:bg-slate-800 text-gray-800 dark:text-gray-100' },
        { id: 'yellow', class: 'bg-yellow-100 dark:bg-yellow-900 text-yellow-900 dark:text-yellow-100' },
        { id: 'blue',   class: 'bg-blue-100 dark:bg-blue-900 text-blue-900 dark:text-blue-100' },
        { id: 'pink',   class: 'bg-pink-100 dark:bg-pink-900 text-pink-900 dark:text-pink-100' },
        { id: 'green',  class: 'bg-green-100 dark:bg-green-900 text-green-900 dark:text-green-100' },
        { id: 'purple', class: 'bg-purple-100 dark:bg-purple-900 text-purple-900 dark:text-purple-100' },
    ];

    // 1. CARGAR NOTAS
    const notes = useLiveQuery(async () => {
        const allNotes = await db.notes.toArray();
        return allNotes.sort((a, b) => {
            if (a.pinned === b.pinned) {
                return new Date(b.createdAt) - new Date(a.createdAt);
            }
            return a.pinned ? -1 : 1;
        });
    }) || [];

    // --- MANEJO DEL MODAL DE NOTA ---
    const openNewNote = () => {
        setEditingNote(null);
        setTitle('');
        setContent('');
        setColor('bg-gray-100 dark:bg-slate-800 text-gray-800 dark:text-gray-100');
        setIsPinned(false);
        setIsModalOpen(true);
    };

    const openEditNote = (note) => {
        setEditingNote(note);
        setTitle(note.title);
        setContent(note.content);
        setColor(note.color);
        setIsPinned(note.pinned);
        setIsModalOpen(true);
    };

    const handleSave = async () => {
        if (!title.trim() && !content.trim()) return;

        const noteData = {
            title: title || 'Sin título',
            content,
            color,
            pinned: isPinned,
            createdAt: editingNote ? editingNote.createdAt : new Date()
        };

        if (editingNote) {
            await db.notes.update(editingNote.id, noteData);
        } else {
            await db.notes.add({ ...noteData, id: crypto.randomUUID() });
        }
        setIsModalOpen(false);
    };

    // --- LÓGICA DE BORRADO ---
    
    // 1. Cuando pulsas la papelera, SOLO abrimos la alerta
    const handleDeleteClick = () => {
        setIsDeleteAlertOpen(true);
    };

    // 2. Si confirmas en la alerta, se ejecuta esto
    const confirmDelete = async () => {
        if (editingNote) {
            await db.notes.delete(editingNote.id);
            setIsDeleteAlertOpen(false); // Cerramos alerta
            setIsModalOpen(false);       // Cerramos modal de nota
        }
    };

    return (
        <div className="flex flex-col h-full bg-white dark:bg-slate-900 p-8 font-sans overflow-hidden">
            
            {/* CABECERA */}
            <div className="mb-8 flex justify-between items-end">
                <div>
                    <h2 className="text-4xl font-serif font-bold text-gray-800 dark:text-gray-100 mb-2">Mis Notas</h2>
                    <p className="text-gray-400 dark:text-gray-500 text-sm uppercase tracking-widest">
                        {notes.length} notas • Ordenado por fecha
                    </p>
                </div>
            </div>

            {/* GRID DE NOTAS */}
            <div className="flex-1 overflow-y-auto pr-2 no-scrollbar pb-10">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 auto-rows-[250px]">
                    
                    {/* BOTÓN NUEVA NOTA */}
                    <div 
                        onClick={openNewNote}
                        className="border-2 border-dashed border-gray-200 dark:border-slate-700/50 rounded-3xl flex flex-col items-center justify-center cursor-pointer hover:border-blue-400 hover:bg-blue-50/30 dark:hover:bg-blue-900/10 transition-all group h-full min-h-[250px]"
                    >
                        <div className="w-16 h-16 rounded-full bg-gray-50 dark:bg-slate-800 group-hover:bg-blue-100 dark:group-hover:bg-blue-900/50 flex items-center justify-center mb-4 transition-colors">
                            <Plus size={32} className="text-gray-400 dark:text-gray-600 group-hover:text-blue-500 dark:group-hover:text-blue-400" />
                        </div>
                        <span className="font-bold text-gray-400 dark:text-gray-500 group-hover:text-blue-500 dark:group-hover:text-blue-400 text-lg">Nueva Nota</span>
                    </div>

                    {/* LISTA DE NOTAS */}
                    {notes.map(note => (
                        <div 
                            key={note.id}
                            onClick={() => openEditNote(note)}
                            className={`relative p-6 rounded-3xl cursor-pointer transition-transform hover:-translate-y-1 hover:shadow-lg flex flex-col h-full min-h-[250px] ${note.color}`}
                        >
                            {note.pinned && (
                                <div className="absolute top-4 right-4 text-red-500 dark:text-red-400 transform rotate-12 drop-shadow-sm">
                                    <Pin size={24} fill="currentColor" />
                                </div>
                            )}

                            <h3 className="text-xl font-bold mb-3 pr-6 line-clamp-2 leading-normal pb-1">
                                {note.title}
                            </h3>
                            
                            <p className="opacity-80 text-sm flex-1 leading-relaxed overflow-hidden whitespace-pre-wrap line-clamp-6">
                                {note.content}
                            </p>

                            <div className="mt-4 pt-4 border-t border-black/5 flex justify-between items-center text-xs font-bold text-black/40 uppercase tracking-wide">
                                <span>
                                    {formatDistanceToNow(new Date(note.createdAt), { addSuffix: true, locale: es })}
                                </span>
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* MODAL DE EDICIÓN */}
            {isModalOpen && (
                <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/40 p-4 animate-fadeIn" style={{ WebkitAppRegion: 'no-drag' }}>
                    
                    {/* AQUÍ ESTÁ NUESTRA NUEVA ALERTA DE BORRADO DENTRO DEL MODAL */}
                    <ConfirmModal 
                        isOpen={isDeleteAlertOpen}
                        onClose={() => setIsDeleteAlertOpen(false)}
                        onConfirm={confirmDelete}
                        title="¿Borrar nota?"
                        message="Esta nota se eliminará permanentemente."
                    />

                    <div 
                        className={`w-full max-w-2xl rounded-3xl shadow-2xl overflow-hidden flex flex-col h-[80vh] ${color.replace('/95', '').replace('/80', '')}`}
                        style={{ transform: 'translate3d(0,0,0)', backfaceVisibility: 'hidden' }}
                    >
                        
                        <div className="flex justify-between items-center p-6 border-b border-black/5 dark:border-white/10 flex-shrink-0 relative z-20">
                            <div className="flex gap-2">
                                {colors.map(c => (
                                    <button
                                        key={c.id}
                                        onClick={() => setColor(c.class)}
                                        className={`w-6 h-6 rounded-full border-2 transition-transform hover:scale-110 ${c.class.split(' ')[0]} dark:${c.class.split(' ')[1]} ${color === c.class ? 'border-black/40 dark:border-white/40 scale-110' : 'border-black/5 dark:border-white/5'}`}
                                    />
                                ))}
                            </div>
                            
                            <div className="flex gap-2 items-center">
                                <button 
                                    onClick={() => setIsPinned(!isPinned)}
                                    className={`p-2 rounded-full transition-colors ${isPinned ? 'bg-white/50 dark:bg-black/20 text-red-600 dark:text-red-400' : 'hover:bg-black/5 dark:hover:bg-white/5 opacity-50'}`}
                                    title="Fijar nota"
                                >
                                    <Pin size={20} fill={isPinned ? "currentColor" : "none"} />
                                </button>

                                {editingNote && (
                                    <button 
                                        onClick={handleDeleteClick} 
                                        className="p-2 rounded-full hover:bg-red-500/20 text-red-600/70 hover:text-red-600 transition"
                                    >
                                        <Trash2 size={20} />
                                    </button>
                                )}
                                
                                <button onClick={() => setIsModalOpen(false)} className="p-2 rounded-full hover:bg-black/10 dark:hover:bg-white/10 opacity-50 transition">
                                    <X size={24} />
                                </button>
                            </div>
                        </div>

                        {/* Cuerpo Modal */}
                        <div className="p-8 flex-1 flex flex-col gap-4 overflow-hidden relative z-10">
                            
                            <input 
                                type="text" 
                                placeholder="Título de la nota"
                                className="bg-transparent text-3xl font-bold placeholder-gray-500/50 dark:placeholder-gray-400/50 border-none outline-none w-full select-text flex-shrink-0 pt-0 pb-3 leading-normal"
                                value={title}
                                onChange={(e) => setTitle(e.target.value)}
                            />
                            
                            <textarea 
                                placeholder="Escribe aquí tus ideas..." 
                                className="bg-transparent text-lg opacity-90 placeholder-gray-500/50 dark:placeholder-gray-400/50 border-none outline-none w-full flex-1 resize-none select-text leading-relaxed overflow-y-auto pr-2 custom-scrollbar"
                                value={content}
                                spellCheck="false" 
                                onChange={(e) => setContent(e.target.value)}
                            />
                        </div>

                        {/* Footer Modal */}
                        <div className="p-6 border-t border-black/5 dark:border-white/10 flex justify-end flex-shrink-0 relative z-20">
                            <button 
                                onClick={handleSave}
                                className="bg-black/80 dark:bg-black/40 hover:bg-black dark:hover:bg-black/60 text-white px-8 py-3 rounded-xl font-bold transition-transform active:scale-95 shadow-lg"
                            >
                                Guardar Nota
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default NotesView;