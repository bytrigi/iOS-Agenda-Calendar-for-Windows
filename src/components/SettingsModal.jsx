import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { X, Cloud, Loader2, CheckCircle, AlertCircle } from 'lucide-react';

const SettingsModal = ({ isOpen, onClose, onSyncICloud }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncStatus, setSyncStatus] = useState('idle'); // idle, success, error

  if (!isOpen) return null;

  const handleSync = async () => {
    if (!email || !password) return;
    setIsSyncing(true);
    setSyncStatus('idle');
    try {
      await onSyncICloud(email, password);
      setSyncStatus('success');
      setTimeout(() => setSyncStatus('idle'), 3000);
    } catch (error) {
      console.error(error);
      setSyncStatus('error');
    } finally {
      setIsSyncing(false);
    }
  };

  // Render using Portal to ensure it sits on top of everything (escapes overflow/transforms)
  return createPortal(
    <div className="fixed inset-0 z-[99999] flex items-center justify-center bg-black/40 backdrop-blur-sm" style={{ WebkitAppRegion: 'no-drag' }}>
      
      {/* Click fuera para cerrar - aseguramos que capture el click */}
      <div className="absolute inset-0 cursor-default" onClick={onClose}></div>

      {/* Modal Card */}
      <div 
        className="relative bg-white w-full max-w-md rounded-2xl shadow-2xl border border-gray-100 overflow-hidden transform scale-100" 
        style={{ WebkitAppRegion: 'no-drag' }}
      >
        
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
          <h2 className="text-lg font-bold text-gray-800 flex items-center gap-2">
            <Cloud size={20} className="text-blue-500" />
            Configuración
          </h2>
          <button 
            onClick={onClose} 
            className="p-1 rounded-full hover:bg-gray-200 text-gray-500 transition cursor-pointer"
            type="button"
          >
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-6 bg-white">
          
          {/* Sección iCloud */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-gray-700 uppercase tracking-wide">Sincronización iCloud</h3>
                <span className="text-[10px] bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-bold">BETA</span>
            </div>
            
            <div className="space-y-3">
                <div>
                    <label className="block text-xs font-semibold text-gray-500 mb-1">Apple ID</label>
                    <input 
                        type="email" 
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="ejemplo@icloud.com"
                        className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-100 focus:border-blue-400 outline-none transition select-text"
                    />
                </div>
                <div>
                    <label className="block text-xs font-semibold text-gray-500 mb-1">
                        Contraseña de Aplicación
                        <span className="text-gray-300 font-normal ml-1">(No tu contraseña normal)</span>
                    </label>
                    <input 
                        type="password" 
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="xxxx-xxxx-xxxx-xxxx"
                        className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-100 focus:border-blue-400 outline-none transition select-text"
                    />
                    <a href="https://appleid.apple.com" target="_blank" rel="noreferrer" className="text-[10px] text-blue-500 hover:underline mt-1 block text-right">
                        Generar en appleid.apple.com
                    </a>
                </div>
            </div>

            {/* Mensajes de Estado */}
            {syncStatus === 'error' && (
                <div className="flex items-center gap-2 text-xs text-red-600 bg-red-50 p-2 rounded-lg border border-red-100">
                    <AlertCircle size={14} />
                    <span>Error al conectar. Verifica la contraseña específica.</span>
                </div>
            )}
            {syncStatus === 'success' && (
                <div className="flex items-center gap-2 text-xs text-green-600 bg-green-50 p-2 rounded-lg border border-green-100">
                    <CheckCircle size={14} />
                    <span>¡Sincronización completada con éxito!</span>
                </div>
            )}

            <button 
                onClick={handleSync}
                disabled={isSyncing || !email || !password}
                className={`
                    w-full flex items-center justify-center gap-2 py-2.5 rounded-xl font-bold text-sm shadow-lg transition-all
                    ${isSyncing ? 'bg-blue-400 cursor-wait' : 'bg-blue-600 hover:bg-blue-700 active:scale-95'}
                    text-white disabled:opacity-50 disabled:cursor-not-allowed
                `}
            >
                {isSyncing ? <Loader2 size={18} className="animate-spin" /> : <Cloud size={18} />}
                {isSyncing ? 'Conectando con Apple...' : 'Sincronizar Calendarios'}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
};

export default SettingsModal;