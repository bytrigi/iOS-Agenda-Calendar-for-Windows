import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, Cloud, Loader2, CheckCircle, AlertCircle, Calendar as CalendarIcon, ArrowLeft, Settings, Info, Monitor, Clock, Layout } from 'lucide-react';

const SettingsModal = ({ isOpen, onClose, iCloudConfig, onConnect, appSettings, onUpdateSettings, initialTab = 'general' }) => {
  const [activeTab, setActiveTab] = useState(initialTab); // 'general' | 'icloud' | 'about'

  const [localSettings, setLocalSettings] = useState(appSettings || { startOfWeek: 'monday', defaultDuration: 60, theme: 'light' });
  const [hasChanges, setHasChanges] = useState(false);

  useEffect(() => {
      if (isOpen) {
          setLocalSettings(appSettings || { startOfWeek: 'monday', defaultDuration: 60, theme: 'light' });
          setHasChanges(false);
          setActiveTab(initialTab);
      }
  }, [isOpen, appSettings, initialTab]);

  const handleLocalSettingChange = (updates) => {
      const newSettings = { ...localSettings, ...updates };
      setLocalSettings(newSettings);
      
      // Determine if there are actual changes
      const current = appSettings || { startOfWeek: 'monday', defaultDuration: 60, theme: 'light' };
      const isDiff = newSettings.theme !== current.theme || 
                     newSettings.startOfWeek !== current.startOfWeek || 
                     newSettings.defaultDuration !== current.defaultDuration;
      
      setHasChanges(isDiff);
  };

  const handleApplySettings = () => {
      onUpdateSettings(localSettings);
      setHasChanges(false);
  };

  // ESTATE ICLOUD (Lifted from previous version)
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
     if (isOpen && iCloudConfig) {
         setEmail(iCloudConfig.email || '');
         setPassword(iCloudConfig.password || '');
     }
  }, [isOpen, iCloudConfig]);

  if (!isOpen) return null;

  // --- ICLOUD LOGIC ---
  const handleConnectClick = async () => {
    if (!email || !password) return;
    setIsLoading(true);
    setErrorMsg(null);
    try {
      // Importante: fetchICloudCalendars se pasa como prop pero en App.jsx se llama 'fetchICloudCalendars'.
      // Wait, en App.jsx pasamos: onConnect={handleConfirmSync}
      // PERO falta onFetchCalendars en App.jsx?
      // Revisando App.jsx... en mi ultimo edit NO pasé onFetchCalendars. ERROR.
      // App.jsx tiene `onConnect` que es `handleConfirmSync`.
      // Necesitamos una función para obtener calendarios PRIMERO.
      // En la versión anterior de SettingsModal, recibia `onFetchCalendars`.
      // Tengo que volver a añadir esa prop en App.jsx o importarla servicio directo?
      // Mejor importar servicio directo aqui si tenemos credenciales? 
      // No, App.jsx tiene la logica `fetchICloudCalendars`. 
      // VOY A ASUMIR QUE TENGO QUE CORREGIR APP.JSX LUEGO O USAR LA LOGICA AQUI.
      // Para no romper, voy a importar ICloudService aqui tambien?
      // O le pido al usuario que espere? No.
      // Voy a arreglar el modal para que use ICloudService directamente para el fetch, 
      // y luego llame a onConnect del padre para guardar.
      // Eso simplifica App.jsx.
      
      const { ICloudService } = await import('../services/iCloudService');
      const service = new ICloudService(email, password);
      const calendars = await service.getCalendars();
      
      if (calendars.length === 0) throw new Error("No se encontraron calendarios.");

      setAvailableCalendars(calendars);
      
      // Pre-seleccionar
      const initialMap = {};
      const prevEnabledUrls = iCloudConfig?.enabledCalendars?.map(c => c.url) || [];
      const hasPrev = prevEnabledUrls.length > 0;

      calendars.forEach(cal => {
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
          const selectedList = availableCalendars.filter(cal => selectedCalendarMap[cal.url]);
          if (selectedList.length === 0) {
              setErrorMsg("Debes seleccionar al menos un calendario.");
              setIsLoading(false);
              return;
          }

          // onConnect es handleConfirmSync(email, password, selectedList)
          await onConnect(email, password, selectedList);
          
          setSuccessMsg("¡Configuración guardada!");
          setTimeout(() => {
              setSuccessMsg(null);
              setStep('auth'); 
              // No cerramos modal para que el usuario explore otras tabs si quiere
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

  // --- RENDER CONTENT ---

  return createPortal(
    <div className="fixed inset-0 z-[99999] flex items-center justify-center bg-black/40 backdrop-blur-sm" style={{ WebkitAppRegion: 'no-drag' }}>
      <div className="absolute inset-0 cursor-default" onClick={onClose}></div>

      {/* Modal Card (Larger) */}
      <div 
        className="relative bg-white dark:bg-slate-900 w-full max-w-2xl h-[500px] rounded-2xl shadow-2xl border border-gray-100 dark:border-slate-800 overflow-hidden flex flex-row animate-in fade-in zoom-in-95 duration-200" 
        style={{ WebkitAppRegion: 'no-drag' }}
      >
        
        {/* SIDEBAR */}
        <div className="w-1/3 bg-gray-50 dark:bg-slate-800/50 border-r border-gray-100 dark:border-slate-800 flex flex-col p-4">
            <h2 className="text-xl font-serif font-bold text-gray-800 dark:text-gray-100 mb-6 px-2">Ajustes</h2>
            
            <nav className="space-y-1">
                <button 
                    onClick={() => setActiveTab('general')}
                    className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${activeTab === 'general' ? 'bg-white dark:bg-slate-700 shadow-sm text-gray-900 dark:text-white' : 'text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-slate-800'}`}
                >
                    <Settings size={18} />
                    General
                </button>
                <button 
                    onClick={() => setActiveTab('icloud')}
                    className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${activeTab === 'icloud' ? 'bg-white dark:bg-slate-700 shadow-sm text-gray-900 dark:text-white' : 'text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-slate-800'}`}
                >
                    <Cloud size={18} />
                    iCloud
                </button>
                <button 
                    onClick={() => setActiveTab('about')}
                    className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${activeTab === 'about' ? 'bg-white dark:bg-slate-700 shadow-sm text-gray-900 dark:text-white' : 'text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-slate-800'}`}
                >
                    <Info size={18} />
                    Acerca de
                </button>
            </nav>

            <div className="mt-auto pt-4 border-t border-gray-200 dark:border-slate-700 flex flex-col gap-2">
                 <button onClick={onClose} className="text-xs text-center text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 font-medium px-2 py-1">
                     Esc / Cerrar
                 </button>
            </div>
        </div>

        {/* CONTENT */}
        <div className="flex-1 flex flex-col relative">
            <div className="flex-1 overflow-y-auto p-8 custom-scrollbar">
                
                {/* --- TAB: GENERAL --- */}
                {activeTab === 'general' && (
                    <div className="space-y-8 animate-in fade-in slide-in-from-right-4 duration-300">
                        <div>
                            <h3 className="text-lg font-bold text-gray-800 dark:text-gray-100 mb-1">Apariencia</h3>
                            <p className="text-sm text-gray-400 dark:text-gray-500 mb-4">Personaliza cómo se ve tu calendario.</p>
                            
                            <div className="flex gap-2 bg-gray-100 dark:bg-slate-800/50 p-1 rounded-lg w-max border border-gray-200 dark:border-slate-700/50">
                                {['light', 'dark', 'auto'].map(theme => (
                                    <button
                                        key={theme}
                                        onClick={() => handleLocalSettingChange({ theme })}
                                        className={`px-4 py-1.5 rounded-md text-xs font-semibold capitalize transition-all ${localSettings?.theme === theme ? 'bg-white dark:bg-slate-700 shadow text-gray-900 dark:text-white' : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'}`}
                                    >
                                        {theme === 'auto' ? 'Automático' : theme === 'light' ? 'Claro' : 'Oscuro'}
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div>
                            <h3 className="text-lg font-bold text-gray-800 dark:text-gray-100 mb-1">Calendario</h3>
                            <p className="text-sm text-gray-400 dark:text-gray-500 mb-4">Configuración de la rejilla y eventos.</p>
                            
                            <div className="space-y-4">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        <Layout size={16} className="text-gray-400"/>
                                        <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Inicio de semana</span>
                                    </div>
                                    <select 
                                        value={localSettings?.startOfWeek || 'monday'}
                                        onChange={(e) => handleLocalSettingChange({ startOfWeek: e.target.value })}
                                        className="bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 text-gray-700 dark:text-gray-200 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block p-2 outline-none"
                                    >
                                        <option value="monday">Lunes</option>
                                        <option value="sunday">Domingo</option>
                                    </select>
                                </div>

                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        <Clock size={16} className="text-gray-400"/>
                                        <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Duración por defecto</span>
                                    </div>
                                    <select 
                                        value={localSettings?.defaultDuration || 60}
                                        onChange={(e) => handleLocalSettingChange({ defaultDuration: Number(e.target.value) })}
                                        className="bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 text-gray-700 dark:text-gray-200 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block p-2 outline-none"
                                    >
                                        <option value={15}>15 minutos</option>
                                        <option value={30}>30 minutos</option>
                                        <option value={45}>45 minutos</option>
                                        <option value={60}>1 hora</option>
                                        <option value={90}>1.5 horas</option>
                                        <option value={120}>2 horas</option>
                                    </select>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* --- TAB: ICLOUD --- */}
                {activeTab === 'icloud' && (
                    <div className="space-y-4 animate-in fade-in slide-in-from-right-4 duration-300">
                        <div className="flex items-center gap-2 mb-4">
                            <Cloud className="text-blue-500" size={24} />
                            <div>
                                <h3 className="text-lg font-bold text-gray-800">Sincronización iCloud</h3>
                                <p className="text-xs text-gray-400">Gestiona tus calendarios conectados.</p>
                            </div>
                        </div>

                        {step === 'auth' && (
                            <div className="space-y-4">
                                <div className="p-3 bg-blue-50 rounded-lg text-xs text-blue-700 leading-relaxed border border-blue-100">
                                    Introduce tu Apple ID y una <b>Contraseña de Aplicación</b>. 
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
                                    onClick={handleConnectClick}
                                    disabled={isLoading || !email || !password}
                                    className="w-full h-10 flex items-center justify-center gap-2 rounded-xl font-bold text-sm shadow-sm transition-all bg-blue-600 hover:bg-blue-700 text-white disabled:opacity-50 mt-2"
                                >
                                    {isLoading ? <Loader2 size={18} className="animate-spin" /> : 'Conectar y Buscar Calendarios'}
                                </button>
                            </div>
                        )}

                        {step === 'selection' && (
                            <div className="space-y-4">
                                <div className="flex items-center gap-2 mb-2">
                                    <button onClick={() => setStep('auth')} className="text-gray-400 hover:text-gray-600">
                                        <ArrowLeft size={18} />
                                    </button>
                                    <h3 className="text-sm font-bold text-gray-700">Selecciona los calendarios</h3>
                                </div>
                                
                                <div className="max-h-[220px] overflow-y-auto space-y-2 border border-gray-100 rounded-xl p-2 bg-gray-50 custom-scrollbar">
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

                        {/* MENSAJES DE ESTADO DENTRO DE LA TAB */}
                        {errorMsg && (
                            <div className="mt-4 flex items-center gap-2 text-xs text-red-600 bg-red-50 p-2 rounded-lg border border-red-100">
                                <AlertCircle size={14} />
                                <span>{errorMsg}</span>
                            </div>
                        )}
                        {successMsg && (
                            <div className="mt-4 flex items-center gap-2 text-xs text-green-600 bg-green-50 p-2 rounded-lg border border-green-100">
                                <CheckCircle size={14} />
                                <span>{successMsg}</span>
                            </div>
                        )}
                    </div>
                )}

                {/* --- TAB: ABOUT --- */}
                {activeTab === 'about' && (
                    <div className="flex flex-col items-center justify-center h-full text-center space-y-4 animate-in fade-in zoom-in-95 duration-300">
                         <div>
                             <img src="./logo.png" alt="Logo" className="w-16 h-16"/>
                         </div>
                         <div>
                             <h3 className="text-xl font-bold text-gray-800 dark:text-gray-100">iOS Calendar for Windows</h3>
                             <p className="text-sm text-gray-400 dark:text-gray-500">Versión 1.0.0</p>
                         </div>
                         <div className="text-xs text-gray-400 dark:text-gray-500 max-w-xs mt-8">
                             Esta aplicación es un proyecto diseñado para integrar el ecosistema de calendario de Apple en Windows.
                         </div>
                    </div>
                )}

            </div>
            
            {/* FOOTER ACTION BUTTON */}
            {hasChanges && (
                <div className="absolute bottom-6 right-8 animate-in slide-in-from-bottom-4 fade-in z-50">
                    <button 
                        onClick={handleApplySettings} 
                        className="bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold py-2.5 px-6 rounded-lg shadow-lg shadow-blue-600/20 transition-all hover:scale-105"
                    >
                        Aplicar Cambios
                    </button>
                </div>
            )}
        </div>

        {/* CLOSE BUTTON ABSOLUTE TOP RIGHT */}
        <button onClick={onClose} className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 transition">
             <X size={20} />
        </button>

      </div>
    </div>,
    document.body
  );
};

export default SettingsModal;