import React from 'react';
import { CheckSquare, FileText, Settings, Search, Plus } from 'lucide-react';
import CustomTitleBar from './CustomTitleBar';

const PlannerLayout = ({ activeTab, setActiveTab, children, onAddEvent, onSearchClick, onSettingsClick }) => {
  
  const tabs = [
    { id: 'day', label: 'Day', color: 'bg-red-400' },
    { id: 'week', label: 'Week', color: 'bg-yellow-400' },
    { id: 'month', label: 'Month', color: 'bg-green-400' },
    { id: 'year', label: 'Year', color: 'bg-blue-400' },
    { id: 'tasks', label: 'Tasks', color: 'bg-purple-400', icon: <CheckSquare size={16} /> },
    { id: 'notes', label: 'Notes', color: 'bg-pink-400', icon: <FileText size={16} /> },
  ];

  // Función para maximizar/restaurar
  const handleToggleMaximize = () => {
      console.log("Doble click detectado"); // Para depurar si hace falta
      window.electronAPI?.maximize();
  };

  return (
    <div className="h-screen w-screen bg-transparent flex flex-col font-sans relative overflow-hidden p-1">
      
      {/* Bordes de redimensión (Invisibles) */}
      <div className="fixed top-0 left-0 right-0 h-1 z-[9999] cursor-n-resize bg-transparent" style={{ WebkitAppRegion: 'no-drag' }}></div>
      <div className="fixed bottom-0 left-0 right-0 h-2 z-[9999] cursor-s-resize bg-transparent" style={{ WebkitAppRegion: 'no-drag' }}></div>
      <div className="fixed top-0 bottom-0 left-0 w-2 z-[9999] cursor-w-resize bg-transparent" style={{ WebkitAppRegion: 'no-drag' }}></div>
      <div className="fixed top-0 bottom-0 right-0 w-2 z-[9999] cursor-e-resize bg-transparent" style={{ WebkitAppRegion: 'no-drag' }}></div>
      
      {/* Esquinas */}
      <div className="fixed top-0 left-0 w-4 h-4 z-[9999] cursor-nw-resize bg-transparent" style={{ WebkitAppRegion: 'no-drag' }}></div>
      <div className="fixed top-0 right-0 w-4 h-4 z-[9999] cursor-ne-resize bg-transparent" style={{ WebkitAppRegion: 'no-drag' }}></div>
      <div className="fixed bottom-0 left-0 w-4 h-4 z-[9999] cursor-sw-resize bg-transparent" style={{ WebkitAppRegion: 'no-drag' }}></div>
      <div className="fixed bottom-0 right-0 w-4 h-4 z-[9999] cursor-se-resize bg-transparent" style={{ WebkitAppRegion: 'no-drag' }}></div>

      {/* --- EL LIBRO (AGENDA) --- */}
      <div className="relative w-full h-full flex shadow-2xl transition-all duration-500 rounded-xl overflow-hidden" style={{ WebkitAppRegion: 'no-drag' }}>
        
        {/* LOMO DE LA AGENDA */}
        <div className="w-20 bg-[#2d3342] flex flex-col items-center pt-4 space-y-6 z-20 relative shadow-lg">
             <CustomTitleBar />
             <div className="w-2 h-2 rounded-full bg-slate-600/50 mt-2 shadow-inner"></div>
             <div className="w-2 h-2 rounded-full bg-slate-600/50 shadow-inner"></div>
             <div className="w-2 h-2 rounded-full bg-slate-600/50 shadow-inner"></div>
        </div>

        {/* PÁGINA PRINCIPAL */}
        <div className="flex-1 bg-white relative shadow-inner flex flex-col -ml-[1px] rounded-r-xl overflow-hidden">
            
            {/* 1. FRANJA DE ARRASTRE SUPERIOR (6px) 
               Solo sirve para arrastrar. Está pegada al borde superior.
            */}
            <div 
                className="absolute top-0 left-0 right-0 h-[6px] z-[100]" 
                style={{ WebkitAppRegion: 'drag' }}
            ></div>

            {/* 2. ZONA DE DOBLE CLIC (Debajo de la franja)
               Ocupa el espacio del título. Al ser 'no-drag', detecta el click.
            */}
            <div 
                className="absolute top-[6px] left-0 right-0 h-12 z-[50]" 
                style={{ WebkitAppRegion: 'no-drag' }}
                onDoubleClick={handleToggleMaximize}
            >
            </div>

            <div className="flex-1 overflow-hidden relative z-10 pt-4"> 
                {children}
            </div>
        </div>

        {/* --- PESTAÑAS LATERALES --- */}
        <div className="flex flex-col pt-16 relative z-10 -ml-[1px]">
            {tabs.map((tab) => (
                <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`
                        w-12 h-16 mb-1 rounded-r-xl shadow-md flex items-center justify-center 
                        text-[10px] font-bold text-white tracking-widest transition-transform transform origin-left
                        hover:scale-105
                        ${tab.color}
                        ${activeTab === tab.id ? 'translate-x-0 scale-105 z-30 brightness-110 shadow-lg' : '-translate-x-1 opacity-90 brightness-90'}
                    `}
                    style={{ writingMode: 'vertical-rl', textOrientation: 'mixed' }}
                >
                   {tab.icon ? <span className="rotate-90">{tab.icon}</span> : <span className="rotate-180 uppercase">{tab.label}</span>}
                </button>
            ))}

            <div className="mt-auto pb-4 flex flex-col gap-3 pl-1">
                 <button onClick={onSettingsClick} className="w-10 h-10 bg-gray-100 rounded-lg flex items-center justify-center text-gray-500 hover:bg-white hover:text-blue-500 transition shadow"><Settings size={18} /></button>
                 <button onClick={onSearchClick} className="w-10 h-10 bg-gray-100 rounded-lg flex items-center justify-center text-gray-500 hover:bg-white hover:text-blue-500 transition shadow"><Search size={18} /></button>
                 <button onClick={onAddEvent} className="w-10 h-10 bg-blue-600 rounded-lg flex items-center justify-center text-white hover:bg-blue-500 transition shadow-lg mt-2 transform hover:scale-110 active:scale-95"><Plus size={22} /></button>
            </div>
        </div>
      </div>
    </div>
  );
};

export default PlannerLayout;