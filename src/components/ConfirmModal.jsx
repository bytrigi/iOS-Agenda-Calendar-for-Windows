import React from 'react';

const ConfirmModal = ({ isOpen, onClose, onConfirm, title, message, confirmText = 'Borrar', cancelText = 'Cancelar', confirmColor = 'bg-red-500 hover:bg-red-600', isWelcome = false }) => {
  if (!isOpen) return null;

  return (
    // Overlay con z-index muy alto
    <div className="absolute inset-0 z-[100] flex items-center justify-center bg-black/20 backdrop-blur-[2px] animate-fadeIn">
      
      {/* Caja de la alerta */}
      <div className={`
          bg-white/95 backdrop-blur-xl rounded-2xl shadow-2xl p-6 transform scale-100 animate-popIn text-center border border-white/20
          ${isWelcome ? 'w-[340px]' : 'w-[300px]'}
      `}>
        
        <h3 className={`font-bold text-gray-900 mb-2 ${isWelcome ? 'text-xl' : 'text-lg'}`}>
          {title || '¿Estás seguro?'}
        </h3>
        
        <p className={`text-gray-500 mb-6 leading-relaxed ${isWelcome ? 'text-base font-medium' : 'text-sm'}`}>
          {message || 'Esta acción no se puede deshacer.'}
        </p>

        <div className="flex gap-3 justify-center">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded-xl font-bold text-sm transition-colors active:scale-95"
          >
            {cancelText}
          </button>
          
          <button
            onClick={() => {
              onConfirm();
              onClose();
            }}
            className={`
                flex-1 px-4 py-2 text-white rounded-xl font-bold text-sm transition-colors shadow-md active:scale-95
                ${confirmColor}
            `}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ConfirmModal;