import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';

const TimeSelect = ({ value, options, onChange, label }) => {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef(null);

  // Cerrar si haces clic fuera
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (containerRef.current && !containerRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className="relative w-20" ref={containerRef}>
      {/* EL BOTÓN QUE SE VE (INPUT FALSO) */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={`
            w-full flex items-center justify-between px-3 py-2 
            bg-white border rounded-lg text-sm font-medium text-gray-700
            transition-all duration-200
            ${isOpen ? 'border-blue-500 ring-2 ring-blue-100' : 'border-gray-200 hover:border-blue-300'}
        `}
      >
        <span>{value}</span>
        {isOpen ? <ChevronUp size={14} className="text-gray-400" /> : <ChevronDown size={14} className="text-gray-400" />}
      </button>

      {/* LA LISTA DESPLEGABLE (EL DROPDOWN) */}
      {isOpen && (
        <div className="
            absolute 
            bottom-full mb-2  /* <--- CLAVE: Se abre hacia ARRIBA (bottom-full) y deja un margen (mb-2) */
            left-0 w-full 
            max-h-48          /* <--- CLAVE: Altura máxima de unos 200px */
            overflow-y-auto   /* <--- CLAVE: Scroll vertical si pasa de la altura */
            bg-white 
            border border-gray-100 
            rounded-xl 
            shadow-2xl 
            z-50              /* <--- CLAVE: Para que flote por encima de todo */
        ">
          <div className="py-1">
             {/* Opción decorativa con el nombre (Horas/Minutos) */}
             <div className="px-3 py-2 text-xs font-bold text-gray-400 uppercase tracking-wider bg-gray-50 border-b border-gray-100 mb-1 sticky top-0">
                {label}
             </div>

             {options.map((option) => (
              <button
                key={option}
                type="button"
                onClick={() => {
                  onChange(option);
                  setIsOpen(false);
                }}
                className={`
                    w-full text-left px-4 py-2 text-sm transition-colors
                    ${value === option ? 'bg-blue-50 text-blue-600 font-bold' : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'}
                `}
              >
                {option}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default TimeSelect;