import React, { useState, useEffect, useRef } from 'react';
import { X, Trash2, Clock, AlignLeft, Bell, Calendar as CalendarIcon, ChevronDown, Check } from 'lucide-react';

import DatePicker, { registerLocale } from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";
import { es } from 'date-fns/locale/es';
registerLocale('es', es);

// --- COMPONENTE SELECT PERSONALIZADO (APPLE STYLE) ---
// Ahora acepta la prop 'direction' para abrirse hacia arriba o abajo
const CustomSelect = ({ value, options, onChange, icon: Icon, align = 'left', compact = false, direction = 'down' }) => {
    const [isOpen, setIsOpen] = useState(false);
    const containerRef = useRef(null);

    // Cerrar al hacer clic fuera
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (containerRef.current && !containerRef.current.contains(event.target)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    // Encontrar la etiqueta del valor seleccionado
    const selectedLabel = options.find(opt => opt.value == value)?.label || value;

    return (
        <div className="relative w-full" ref={containerRef}>
            {/* BOTÓN ACTIVADOR */}
            <button 
                type="button"
                onClick={() => setIsOpen(!isOpen)}
                className={`
                    w-full flex items-center justify-between bg-white border border-gray-200 
                    transition-all hover:border-blue-300 focus:ring-2 focus:ring-blue-50/50 outline-none
                    ${isOpen ? 'border-blue-400 ring-2 ring-blue-50/50' : ''}
                    ${compact ? 'rounded-md py-1 px-2 text-xs' : 'rounded-xl p-2.5 text-sm'}
                `}
            >
                <div className="flex items-center gap-2 overflow-hidden">
                    {Icon && <Icon size={compact ? 14 : 16} className="text-gray-400 flex-shrink-0" />}
                    <span className={`font-medium text-gray-700 truncate ${compact ? 'text-xs' : 'text-sm'}`}>
                        {compact ? value.toString().padStart(2, '0') : selectedLabel}
                    </span>
                </div>
                <ChevronDown size={compact ? 12 : 14} className={`text-gray-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
            </button>

            {/* MENÚ DESPLEGABLE */}
            {isOpen && (
                <div 
                    className={`
                        absolute z-[60] bg-white rounded-2xl shadow-[0_10px_40px_-10px_rgba(0,0,0,0.2)] 
                        overflow-hidden border border-gray-50 animate-fadeIn
                        ${align === 'right' ? 'right-0' : 'left-0'}
                        ${direction === 'up' ? 'bottom-full mb-1' : 'top-full mt-2'} 
                    `}
                    style={{ 
                        minWidth: compact ? '80px' : '100%', 
                        maxHeight: '200px', // Scroll si es muy largo
                        width: 'max-content'
                    }}
                >
                    <div className="overflow-y-auto max-h-[200px] p-1.5 space-y-0.5 no-scrollbar">
                        {options.map((opt) => (
                            <button
                                key={opt.value}
                                type="button"
                                onClick={() => { onChange(opt.value); setIsOpen(false); }}
                                className={`
                                    w-full text-left flex items-center justify-between px-3 py-1.5 rounded-lg transition-colors
                                    ${compact ? 'text-xs' : 'text-sm'}
                                    ${value == opt.value ? 'bg-blue-50 text-blue-600 font-bold' : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'}
                                `}
                            >
                                <span>{opt.label}</span>
                                {value == opt.value && <Check size={12} />}
                            </button>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
};

const EventModal = ({ isOpen, onClose, onSave, onDelete, defaultDate, eventToEdit, calendars }) => {
  const [title, setTitle] = useState('');
  const [start, setStart] = useState(new Date());
  const [end, setEnd] = useState(new Date());
  const [allDay, setAllDay] = useState(false);
  const [color, setColor] = useState('bg-blue-100');
  const [description, setDescription] = useState('');
  const [reminder, setReminder] = useState(0);
  const [selectedCalendarUrl, setSelectedCalendarUrl] = useState('');

  const reminderOptions = [
      { value: 0, label: 'Sin recordatorio' },
      { value: 5, label: '5 min antes' },
      { value: 10, label: '10 min antes' },
      { value: 15, label: '15 min antes' },
      { value: 30, label: '30 min antes' },
      { value: 60, label: '1 hora antes' },
      { value: 1440, label: '1 día antes' },
      { value: 4320, label: '3 días antes' },
      { value: 7200, label: '5 días antes' },
      { value: 10080, label: '1 semana antes' },

  ];

  const colors = [
    'bg-blue-100', 'bg-red-100', 'bg-green-100', 
    'bg-yellow-100', 'bg-purple-100', 'bg-orange-100'
  ];

  useEffect(() => {
    if (isOpen) {
      if (eventToEdit) {
        setTitle(eventToEdit.title);
        setStart(new Date(eventToEdit.start));
        setEnd(new Date(eventToEdit.end));
        setAllDay(eventToEdit.allDay || false);
        setColor(eventToEdit.color || 'bg-blue-100');
        setDescription(eventToEdit.description || '');
        setReminder(eventToEdit.reminder || 0);
        setSelectedCalendarUrl(eventToEdit.calendarUrl || (calendars?.[0]?.url) || '');
      } else {
        setTitle('');
        const d = defaultDate || new Date();
        const startD = new Date(d);
        // Ajustar a la siguiente hora en punto para mejor UX
        startD.setHours(startD.getHours() + 1, 0, 0, 0); 
        const endD = new Date(startD);
        endD.setHours(endD.getHours() + 1);
        
        setStart(startD);
        setEnd(endD);
        setAllDay(false);
        setColor('bg-blue-100');
        setDescription('');
        setReminder(0);
        // Default select first available calendar if exists
        setSelectedCalendarUrl(calendars?.[0]?.url || '');
      }
    }
  }, [isOpen, eventToEdit, defaultDate, calendars]);

  if (!isOpen) return null;

  const handleSave = () => {
    onSave({
      id: eventToEdit?.id,
      title,
      start: start.toISOString(),
      end: end.toISOString(),
      allDay,
      color,
      description,
      reminder: parseInt(reminder),
      calendarUrl: selectedCalendarUrl
    });
  };

  // --- SELECTOR DE TIEMPO INTEGRADO ---
  const TimeSelector = ({ date, onChange }) => {
      // Arrays para las opciones
      const hours = Array.from({ length: 24 }, (_, i) => ({ value: i, label: i.toString().padStart(2, '0') }));
      const minutes = Array.from({ length: 12 }, (_, i) => ({ value: i * 5, label: (i * 5).toString().padStart(2, '0') }));

      const handleHourChange = (val) => {
          const newDate = new Date(date);
          newDate.setHours(parseInt(val));
          onChange(newDate);
      };

      const handleMinuteChange = (val) => {
          const newDate = new Date(date);
          newDate.setMinutes(parseInt(val));
          onChange(newDate);
      };

      return (
          <div className="w-full flex items-center justify-between border-t border-gray-100 pt-3 mt-1 pb-1">
              <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest pl-1">Hora</span>
              
              <div className="flex gap-2 items-center">
                  {/* Custom Select para HORAS (Direction UP para no cortarse) */}
                  <div className="w-16">
                    <CustomSelect 
                        value={date.getHours()} 
                        options={hours} 
                        onChange={handleHourChange} 
                        compact={true}
                        align="right"
                        direction="up" 
                    />
                  </div>
                  
                  <span className="text-gray-300 font-bold text-xs">:</span>
                  
                  {/* Custom Select para MINUTOS (Direction UP) */}
                  <div className="w-16">
                    <CustomSelect 
                        value={date.getMinutes()} 
                        options={minutes} 
                        onChange={handleMinuteChange} 
                        compact={true}
                        align="right"
                        direction="up"
                    />
                  </div>
              </div>
          </div>
      );
  };

  // Input del DatePicker
  const CustomInput = React.forwardRef(({ value, onClick }, ref) => (
    <button 
        className="flex-1 bg-white border border-gray-200 rounded-lg text-gray-700 text-xs p-2 flex items-center justify-between hover:border-blue-400 transition-all focus:ring-2 focus:ring-blue-50/50 outline-none w-full group shadow-sm" 
        onClick={onClick} 
        ref={ref}
        type="button"
    >
      <span className="font-semibold text-gray-600 group-hover:text-gray-800 transition-colors">{value}</span>
      <CalendarIcon size={14} className="text-gray-400 group-hover:text-blue-500 transition-colors ml-2" />
    </button>
  ));

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/10 backdrop-blur-[2px] animate-fadeIn" style={{ WebkitAppRegion: 'no-drag' }}>
      
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden transform transition-all scale-100 animate-popIn flex flex-col max-h-[85vh]">
        
        {/* HEADER */}
        <div className="flex justify-between items-center px-5 py-4 border-b border-gray-100 flex-shrink-0 bg-white z-20">
          <h2 className="text-lg font-serif font-bold text-gray-800">
            {eventToEdit ? 'Editar' : 'Nuevo Evento'}
          </h2>
          <div className="flex gap-2">
            {eventToEdit && (
              <button onClick={onDelete} className="p-1.5 text-red-400 hover:bg-red-50 rounded-full transition">
                <Trash2 size={16} />
              </button>
            )}
            <button onClick={onClose} className="p-1.5 text-gray-400 hover:bg-gray-100 rounded-full transition">
              <X size={18} />
            </button>
          </div>
        </div>

        {/* BODY */}
        <div className="px-5 py-4 space-y-5 flex-1 overflow-y-auto no-scrollbar">
          
          <div>
            <input 
              type="text" 
              placeholder="Añadir título" 
              className="w-full text-xl font-bold text-gray-800 placeholder-gray-300 border-none outline-none bg-transparent focus:ring-0"
              value={title}
              onChange={e => setTitle(e.target.value)}
              autoFocus
            />
          </div>

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-gray-500">
                <Clock size={16} />
                <span className="text-xs font-medium">Todo el día</span>
            </div>
            <button 
                onClick={() => setAllDay(!allDay)}
                className={`w-9 h-5 rounded-full p-0.5 transition-colors duration-300 ${allDay ? 'bg-blue-500' : 'bg-gray-200'}`}
            >
                <div className={`w-4 h-4 bg-white rounded-full shadow-sm transform transition-transform duration-300 ${allDay ? 'translate-x-4' : 'translate-x-0'}`} />
            </button>
          </div>

          <div className="space-y-3 bg-gray-50/50 p-3 rounded-xl border border-gray-100">
             
             {/* INICIO */}
             <div className="flex items-center gap-3">
                <span className="text-[10px] font-bold text-gray-400 w-8 uppercase tracking-wider">De</span>
                <div className="flex-1">
                    <DatePicker 
                        selected={start} 
                        onChange={(date) => setStart(date)} 
                        dateFormat={allDay ? "d 'de' MMM" : "d MMM, HH:mm"}
                        locale="es"
                        customInput={<CustomInput />}
                        portalId="root" 
                        popperClassName="z-[9999]"
                        popperPlacement="bottom-start"
                        showYearDropdown
                        scrollableYearDropdown
                        yearDropdownItemNumber={10} 
                    >
                        {!allDay && <TimeSelector date={start} onChange={setStart} />}
                    </DatePicker>
                </div>
             </div>

             {/* FIN */}
             <div className="flex items-center gap-3">
                <span className="text-[10px] font-bold text-gray-400 w-8 uppercase tracking-wider">A</span>
                <div className="flex-1">
                    <DatePicker 
                        selected={end} 
                        onChange={(date) => setEnd(date)} 
                        dateFormat={allDay ? "d 'de' MMM" : "d MMM, HH:mm"}
                        locale="es"
                        minDate={start}
                        customInput={<CustomInput />}
                        portalId="root"
                        popperClassName="z-[9999]"
                        popperPlacement="bottom-start"
                        showYearDropdown
                        scrollableYearDropdown
                        yearDropdownItemNumber={10}
                    >
                        {!allDay && <TimeSelector date={end} onChange={setEnd} />}
                    </DatePicker>
                </div>
             </div>
          </div>

          {/* CALENDARIO SELECTOR (Si hay calendarios disponibles) */}
          {calendars && calendars.length > 0 && (
             <div className="w-full">
                <CustomSelect 
                    value={selectedCalendarUrl} 
                    options={calendars.map(c => ({ value: c.url, label: c.name }))}
                    onChange={(val) => setSelectedCalendarUrl(val)}
                    icon={CalendarIcon}
                />
             </div>
          )}

          {/* RECORDATORIO */}

          {/* RECORDATORIO */}
          <div className="w-full">
             <CustomSelect 
                value={reminder} 
                options={reminderOptions} 
                onChange={(val) => setReminder(val)}
                icon={Bell}
             />
          </div>

          {/* Categoría */}
          <div>
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">Categoría</p>
            <div className="flex gap-2 overflow-x-auto no-scrollbar p-1 -ml-1">
                {colors.map(c => (
                    <button
                        key={c}
                        onClick={() => setColor(c)}
                        className={`
                            w-5 h-5 rounded-full transition-all flex-shrink-0 
                            hover:scale-110 hover:shadow-sm cursor-pointer
                            ${c} 
                            ${color === c ? 'ring-2 ring-offset-1 ring-gray-300 shadow-sm scale-110' : ''}
                        `}
                    />
                ))}
            </div>
          </div>

          <div className="flex items-start gap-3 border-t border-gray-100 pt-3">
             <AlignLeft size={16} className="text-gray-300 mt-1" />
             <textarea 
                placeholder="Notas..."
                className="flex-1 bg-transparent border-none outline-none text-xs text-gray-600 placeholder-gray-300 resize-none h-16 leading-relaxed focus:ring-0"
                value={description}
                onChange={e => setDescription(e.target.value)}
             />
          </div>
          
        </div>

        <div className="px-5 py-4 border-t border-gray-100 flex justify-end flex-shrink-0 bg-white z-20">
            <button 
                onClick={handleSave}
                className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-2 rounded-lg font-bold text-xs shadow-lg shadow-blue-600/30 transition-transform active:scale-95 w-full md:w-auto"
            >
                {eventToEdit ? 'Actualizar' : 'Guardar'}
            </button>
        </div>

      </div>
    </div>
  );
};

export default EventModal;