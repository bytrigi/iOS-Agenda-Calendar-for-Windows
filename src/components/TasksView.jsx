import React, { useState } from 'react';
import { db } from '../db/database';
import { useLiveQuery } from 'dexie-react-hooks';
import { Plus, Trash2, Check, Circle, ChevronDown, ChevronRight, CornerDownRight } from 'lucide-react';
import ConfirmModal from './ConfirmModal'; // <--- IMPORTAMOS ALERTA

const TasksView = () => {
    const [newTask, setNewTask] = useState('');
    const [expandedTaskId, setExpandedTaskId] = useState(null);
    const [newSubtaskTitle, setNewSubtaskTitle] = useState('');
    
    // ESTADO ALERTA
    const [isConfirmOpen, setIsConfirmOpen] = useState(false);

    // 1. Cargar tareas
    const tasks = useLiveQuery(() => 
        db.tasks.orderBy('createdAt').reverse().toArray()
    ) || [];

    const pendingTasks = tasks.filter(t => !t.completed);
    const completedTasks = tasks.filter(t => t.completed);

    // --- ACCIONES TAREA PRINCIPAL ---

    const handleAddTask = async (e) => {
        if ((e.key === 'Enter' || e.type === 'click') && newTask.trim()) {
            try {
                await db.tasks.add({
                    id: crypto.randomUUID(),
                    title: newTask,
                    completed: false,
                    subtasks: [], 
                    createdAt: new Date()
                });
                setNewTask(''); 
            } catch (error) {
                console.error("Error al añadir tarea:", error);
            }
        }
    };

    const toggleTask = async (task) => {
        await db.tasks.update(task.id, { completed: !task.completed });
    };

    const deleteTask = async (id) => {
        await db.tasks.delete(id);
    };

    // --- LÓGICA BORRADO MASIVO ---

    // 1. Pedir confirmación
    const handleClearRequest = () => {
        if (completedTasks.length > 0) {
            setIsConfirmOpen(true);
        }
    };

    // 2. Ejecutar borrado
    const executeClearCompleted = async () => {
        const idsToDelete = completedTasks.map(t => t.id);
        await db.tasks.bulkDelete(idsToDelete);
        setIsConfirmOpen(false);
    };

    // --- ACCIONES SUBTAREAS ---
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
                    await db.tasks.update(parentId, { subtasks, completed: false });
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

    return (
        <div className="flex flex-col h-full bg-white p-8 font-sans">
            
            <ConfirmModal 
                isOpen={isConfirmOpen}
                onClose={() => setIsConfirmOpen(false)}
                onConfirm={executeClearCompleted}
                title="¿Limpiar completadas?"
                message={`Se borrarán permanentemente ${completedTasks.length} tareas completadas.`}
            />

            {/* CABECERA */}
            <div className="mb-8">
                <h2 className="text-4xl font-serif font-bold text-gray-800 mb-2">Tareas</h2>
                <p className="text-gray-400 text-sm mb-6 uppercase tracking-widest">
                    {pendingTasks.length} PENDIENTES
                </p>

                <div className="flex items-center gap-3 bg-gray-50 p-4 rounded-xl shadow-sm border border-gray-100 focus-within:ring-2 focus-within:ring-blue-100 transition-all">
                    <Plus className="text-gray-400" />
                    <input 
                        type="text" 
                        placeholder="Añadir una tarea nueva..." 
                        className="flex-1 bg-transparent border-none outline-none text-gray-700 placeholder-gray-400 font-medium text-lg select-text"
                        value={newTask}
                        onChange={(e) => setNewTask(e.target.value)}
                        onKeyDown={handleAddTask}
                    />
                    <button onClick={handleAddTask} className="bg-blue-600 text-white p-2 rounded-lg hover:bg-blue-700 transition active:scale-95">
                        <Plus size={20} />
                    </button>
                </div>
            </div>

            {/* LISTA */}
            <div className="flex-1 overflow-y-auto pr-2 no-scrollbar space-y-3">
                
                {/* PENDIENTES */}
                {pendingTasks.map(task => {
                    const isExpanded = expandedTaskId === task.id;
                    const subtasks = task.subtasks || [];
                    const completedSubs = subtasks.filter(s => s.completed).length;

                    return (
                        <div key={task.id} className={`group bg-white border border-gray-100 rounded-xl shadow-sm transition-all animate-fadeIn overflow-hidden ${isExpanded ? 'ring-1 ring-blue-100 shadow-md' : 'hover:shadow-md'}`}>
                            <div className="flex items-center gap-4 p-4">
                                <button onClick={() => toggleExpand(task.id)} className={`text-gray-300 hover:text-blue-500 transition-colors p-1 rounded-md ${isExpanded ? 'bg-blue-50 text-blue-600' : ''}`}>
                                    {isExpanded ? <ChevronDown size={20} /> : <ChevronRight size={20} />}
                                </button>
                                <button onClick={() => toggleTask(task)} className="w-6 h-6 rounded-full border-2 border-gray-300 flex items-center justify-center text-transparent hover:border-blue-500 hover:text-blue-500 transition-all">
                                    <Circle size={18} />
                                </button>
                                <div className="flex-1 select-text">
                                    <span className="text-gray-700 font-medium text-lg block">{task.title}</span>
                                    {subtasks.length > 0 && !isExpanded && (
                                        <span className="text-[10px] text-gray-400 uppercase tracking-wider font-bold">
                                            {completedSubs}/{subtasks.length} Subtareas
                                        </span>
                                    )}
                                </div>
                                <button onClick={() => deleteTask(task.id)} className="text-gray-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity p-2">
                                    <Trash2 size={18} />
                                </button>
                            </div>

                            {isExpanded && (
                                <div className="bg-gray-50/50 border-t border-gray-100 p-4 pl-14 space-y-3 animate-fadeIn">
                                    {subtasks.map(sub => (
                                        <div key={sub.id} className="flex items-center gap-3 group/sub">
                                            <CornerDownRight size={14} className="text-gray-300" />
                                            <button onClick={() => toggleSubtask(task.id, sub.id)} className={`w-4 h-4 rounded border flex items-center justify-center transition-all ${sub.completed ? 'bg-blue-400 border-blue-400 text-white' : 'border-gray-300 text-transparent hover:border-blue-400'}`}>
                                                <Check size={10} strokeWidth={4} />
                                            </button>
                                            <span className={`flex-1 text-sm select-text ${sub.completed ? 'text-gray-400 line-through' : 'text-gray-600'}`}>{sub.title}</span>
                                            <button onClick={() => deleteSubtask(task.id, sub.id)} className="text-gray-300 hover:text-red-400 opacity-0 group-hover/sub:opacity-100 transition-opacity">
                                                <XIconSmall />
                                            </button>
                                        </div>
                                    ))}
                                    <div className="flex items-center gap-3 mt-2">
                                        <div className="w-4 flex justify-center"><Plus size={14} className="text-gray-400" /></div>
                                        <input 
                                            type="text"
                                            placeholder="Añadir paso..."
                                            className="flex-1 bg-transparent border-b border-transparent focus:border-blue-200 outline-none text-sm text-gray-600 placeholder-gray-400 py-1 select-text"
                                            value={newSubtaskTitle}
                                            onChange={(e) => setNewSubtaskTitle(e.target.value)}
                                            onKeyDown={(e) => handleAddSubtask(task.id, e)}
                                        />
                                        <button onClick={(e) => handleAddSubtask(task.id, e)} className="text-xs font-bold text-blue-500 hover:text-blue-700 uppercase">
                                            Añadir
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>
                    );
                })}

                {/* COMPLETADAS */}
                {completedTasks.length > 0 && (
                    <div className="mt-8 pt-4 border-t border-dashed border-gray-200">
                        <div className="flex justify-between items-end mb-4">
                            <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest">Completadas</h3>
                            <button 
                                onClick={handleClearRequest} // <--- CAMBIADO
                                className="text-[10px] font-bold text-red-400 hover:text-red-600 uppercase tracking-wider hover:underline transition-all"
                            >
                                Borrar completadas
                            </button>
                        </div>
                        <div className="space-y-2 opacity-60">
                            {completedTasks.map(task => (
                                <div key={task.id} className="group flex items-center gap-4 p-3 rounded-lg hover:bg-gray-50 transition-colors">
                                    <button onClick={() => toggleTask(task)} className="w-6 h-6 rounded-full bg-blue-500 border-2 border-blue-500 flex items-center justify-center text-white">
                                        <Check size={14} strokeWidth={3} />
                                    </button>
                                    <div className="flex-1">
                                        <span className="text-gray-400 line-through select-text">{task.title}</span>
                                        {task.subtasks && task.subtasks.length > 0 && (
                                            <span className="text-[9px] text-gray-300 block ml-1">
                                                {task.subtasks.length} subtareas archivadas
                                            </span>
                                        )}
                                    </div>
                                    <button onClick={() => deleteTask(task.id)} className="text-gray-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity">
                                        <Trash2 size={16} />
                                    </button>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
                
                {tasks.length === 0 && (
                    <div className="h-full flex flex-col items-center justify-center text-gray-300 opacity-50 pb-20">
                        <Check size={64} className="mb-4" />
                        <p>No tienes tareas pendientes</p>
                    </div>
                )}
            </div>
        </div>
    );
};

const XIconSmall = () => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <line x1="18" y1="6" x2="6" y2="18"></line>
        <line x1="6" y1="6" x2="18" y2="18"></line>
    </svg>
);

export default TasksView;