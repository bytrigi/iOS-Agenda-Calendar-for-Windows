import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, Cloud, Loader2, CheckCircle, AlertCircle, Calendar as CalendarIcon, ArrowLeft } from 'lucide-react';

const SettingsModal = ({ isOpen, onClose, onFetchCalendars, onConfirmSync, initialConfig }) => {
  const [step, setStep] = useState('auth'); // 'auth' | 'selection'
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  
  const [availableCalendars, setAvailableCalendars] = useState([]);
  const [selectedCalendarMap, setSelectedCalendarMap] = useState({});

  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState(null);
  const [successMsg, setSuccessMsg] = useState(null);

  // Cargar config inicial al abrir
  useEffect(() => {
     if (isOpen && initialConfig) {
         setEmail(initialConfig.email || '');
         setPassword(initialConfig.password || '');
         // Si ya tenía calendarios activados, podríamos intentar ir directo al paso 2, 
         // pero mejor volver a autenticar o al menos mostrar el botón de "Gestionar"
     }
  }, [isOpen, initialConfig]);

  if (!isOpen) return null;

  const handleConnect = async () => {
    if (!email || !password) return;
    setIsLoading(true);
    setErrorMsg(null);
    try {
      const calendars = await onFetchCalendars(email, password);
      
      setAvailableCalendars(calendars);
      
      // Pre-seleccionar: Si teníamos config previa, mantener. Si no, todos activados por defecto.
      const initialMap = {};
      const prevEnabledUrls = initialConfig?.enabledCalendars?.map(c => c.url) || [];
      const hasPrev = prevEnabledUrls.length > 0;

      calendars.forEach(cal => {
          // Si hay config previa, solo activar los que estaban. Si es nueva (no prev), activar todos.
          if (hasPrev) {
             initialMap[cal.url] = prevEnabledUrls.includes(cal.url);
          } else {
             initialMap[cal.url] = true; 
          }
      });
      setSelectedCalendarMap(initialMap);

      setStep('selection');
    } catch (error) {
      console.error(error);
      setErrorMsg("Error al conectar: " + (error.message || 'Verifica tus credenciales'));
    } finally {
      setIsLoading(false);
    }
  };

  const handleSaveSelection = async () => {
      setIsLoading(true);
      try {
          // Filtrar objetos de calendario completos
          const selectedList = availableCalendars.filter(cal => selectedCalendarMap[cal.url]);
          
          if (selectedList.length === 0) {
              setErrorMsg("Debes seleccionar al menos un calendario.");
              setIsLoading(false);
              return;
          }

          await onConfirmSync(email, password, selectedList);
          
          setSuccessMsg("¡Configuración guardada y sincronizando!");
          setTimeout(() => {
              onClose();
              setSuccessMsg(null);
              setStep('auth'); // Reset para la próxima
          }, 1500);

      } catch (error) {
          setErrorMsg("Error al guardar: " + error.message);
      } finally {
          setIsLoading(false);
      }
  };

  const toggleCalendar = (url) => {
      setSelectedCalendarMap(prev => ({ ...prev, [url]: !prev[url] }));
  };

  return createPortal(
    <div className="fixed inset-0 z-[99999] flex items-center justify-center bg-black/40 backdrop-blur-sm" style={{ WebkitAppRegion: 'no-drag' }}>
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
            Configuración iCloud
          </h2>
          <button onClick={onClose} className="p-1 rounded-full hover:bg-gray-200 text-gray-500 transition cursor-pointer">
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 bg-white min-h-[300px]">
          
          {step === 'auth' && (
              <div className="space-y-4 animate-in fade-in slide-in-from-right-4 duration-300">
                <div className="p-3 bg-blue-50 rounded-lg text-xs text-blue-700 leading-relaxed border border-blue-100">
                    Introduce tu Apple ID y una <b>Contraseña de Aplicación</b>. 
                    <br/>
                    Tus credenciales se guardan localmente para mantener la sincronización.
                </div>

                <div className="space-y-3">
                    <div>
                        <label className="block text-xs font-semibold text-gray-500 mb-1">Apple ID</label>
                        <input 
                            type="email" 
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            placeholder="ejemplo@icloud.com" // Fixed typo
                            className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-100 focus:border-blue-400 outline-none transition select-text"
                        />
                    </div>
                    <div>
                        <label className="block text-xs font-semibold text-gray-500 mb-1">
                            Contraseña de Aplicación
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

                <button 
                    onClick={handleConnect}
                    disabled={isLoading || !email || !password}
                    className="w-full h-10 flex items-center justify-center gap-2 rounded-xl font-bold text-sm shadow-sm transition-all bg-blue-600 hover:bg-blue-700 text-white disabled:opacity-50 mt-4"
                >
                    {isLoading ? <Loader2 size={18} className="animate-spin" /> : 'Conectar y Buscar Calendarios'}
                </button>
              </div>
          )}

          {step === 'selection' && (
              <div className="space-y-4 animate-in fade-in slide-in-from-right-4 duration-300">
                  <div className="flex items-center gap-2 mb-2">
                      <button onClick={() => setStep('auth')} className="text-gray-400 hover:text-gray-600">
                          <ArrowLeft size={18} />
                      </button>
                      <h3 className="text-sm font-bold text-gray-700">Selecciona los calendarios</h3>
                  </div>
                  
                  <div className="max-h-[250px] overflow-y-auto space-y-2 border border-gray-100 rounded-xl p-2 bg-gray-50 custom-scrollbar">
                      {availableCalendars.map((cal) => (
                          <div 
                            key={cal.url} 
                            onClick={() => toggleCalendar(cal.url)}
                            className={`
                                flex items-center justify-between p-3 rounded-lg cursor-pointer transition border
                                ${selectedCalendarMap[cal.url] ? 'bg-white border-blue-200 shadow-sm' : 'bg-transparent border-transparent hover:bg-gray-100'}
                            `}
                          >
                              <div className="flex items-center gap-3">
                                  <div className="w-3 h-3 rounded-full" style={{ backgroundColor: cal.color || '#3b82f6' }}></div>
                                  <span className={`text-sm ${selectedCalendarMap[cal.url] ? 'font-semibold text-gray-800' : 'text-gray-500'}`}>
                                      {cal.name}
                                  </span>
                              </div>
                              {selectedCalendarMap[cal.url] && <CheckCircle size={16} className="text-blue-500" />}
                          </div>
                      ))}
                  </div>

                  <button 
                      onClick={handleSaveSelection}
                      disabled={isLoading}
                      className="w-full h-10 flex items-center justify-center gap-2 rounded-xl font-bold text-sm shadow-sm transition-all bg-green-600 hover:bg-green-700 text-white disabled:opacity-50 mt-2"
                  >
                      {isLoading ? <Loader2 size={18} className="animate-spin" /> : 'Guardar y Sincronizar'}
                  </button>
              </div>
          )}

          {/* Estado Global */}
          {errorMsg && (
              <div className="mt-4 flex items-center gap-2 text-xs text-red-600 bg-red-50 p-2 rounded-lg border border-red-100 animate-in fade-in slide-in-from-bottom-2">
                  <AlertCircle size={14} />
                  <span>{errorMsg}</span>
              </div>
          )}
          {successMsg && (
              <div className="mt-4 flex items-center gap-2 text-xs text-green-600 bg-green-50 p-2 rounded-lg border border-green-100 animate-in fade-in slide-in-from-bottom-2">
                  <CheckCircle size={14} />
                  <span>{successMsg}</span>
              </div>
          )}

        </div>
      </div>
    </div>,
    document.body
  );
};

export default SettingsModal;