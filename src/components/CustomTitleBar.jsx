import React from 'react';

const CustomTitleBar = () => {
  
  const handleClose = () => window.electronAPI?.close();
  const handleMinimize = () => window.electronAPI?.minimize();
  const handleMaximize = () => window.electronAPI?.maximize();

  return (
    // justify-start y pl-3 para "esquinarlos" a la izquierda, pero manteniendo el gap
    <div className="flex gap-2 w-full justify-center px-2" style={{ WebkitAppRegion: 'no-drag' }}>
      
      {/* Botón CERRAR (Rojo) */}
      <button 
        onClick={handleClose}
        className="group w-3 h-3 flex-shrink-0 aspect-square rounded-full bg-[#FF5F57] hover:bg-[#FF5F57]/80 flex items-center justify-center transition-colors shadow-inner border border-black/10 relative overflow-hidden"
      >
        {/* Icono centrado absoluto para precisión */}
        <span className="opacity-0 group-hover:opacity-100 text-[8px] font-bold text-white/90 leading-none absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 mt-[0.5px]">✕</span>
      </button>

      {/* Botón MINIMIZAR (Amarillo) */}
      <button 
        onClick={handleMinimize}
        className="group w-3 h-3 flex-shrink-0 aspect-square rounded-full bg-[#FEBC2E] hover:bg-[#FEBC2E]/80 flex items-center justify-center transition-colors shadow-inner border border-black/10 relative overflow-hidden"
      >
        {/* El guión a veces necesita ajuste vertical fino */}
        <span className="opacity-0 group-hover:opacity-100 text-[10px] font-bold text-white/90 leading-none absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 -mt-[1px]">−</span>
      </button>

      {/* Botón MAXIMIZAR (Verde - Cuadrado RELLENO MÁS PEQUEÑO) */}
      <button 
        onClick={handleMaximize}
        className="group w-3 h-3 flex-shrink-0 aspect-square rounded-full bg-[#28C840] hover:bg-[#28C840]/80 flex items-center justify-center transition-colors shadow-inner border border-black/10 relative overflow-hidden"
      >
        {/* CAMBIO: w-[5px] h-[5px] en vez de w-1.5 (6px) */}
        <div className="opacity-0 group-hover:opacity-100 w-[5px] h-[5px] bg-white/90 rounded-[0.5px] absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2"></div>
      </button>
      
    </div>
  );
};

export default CustomTitleBar;