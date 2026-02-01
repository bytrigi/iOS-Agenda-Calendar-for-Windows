import React from 'react';

const ConfirmModal = ({ isOpen, onClose, onConfirm, title, message }) => {
  if (!isOpen) return null;

  return (
    // Overlay con z-index muy alto para estar por encima de todo (incluso de otros modales)
    <div className="absolute inset-0 z-[100] flex items-center justify-center bg-black/20 backdrop-blur-[2px] animate-fadeIn">
      
      {/* Caja de la alerta */}
      <div className="bg-white/95 backdrop-blur-xl rounded-2xl shadow-2xl p-6 w-[300px] transform scale-100 animate-popIn text-center border border-white/20">
        
        <h3 className="text-lg font-bold text-gray-900 mb-2">
          {title || '¿Estás seguro?'}
        </h3>
        
        <p className="text-sm text-gray-500 mb-6 leading-relaxed">
          {message || 'Esta acción no se puede deshacer.'}
        </p>

        <div className="flex gap-3 justify-center">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl font-semibold text-sm transition-colors active:scale-95"
          >
            Cancelar
          </button>
          
          <button
            onClick={() => {
              onConfirm();
              onClose();
            }}
            className="flex-1 px-4 py-2 bg-red-500 hover:bg-red-600 text-white rounded-xl font-semibold text-sm transition-colors shadow-md shadow-red-500/30 active:scale-95"
          >
            Borrar
          </button>
        </div>
      </div>
    </div>
  );
};

export default ConfirmModal;