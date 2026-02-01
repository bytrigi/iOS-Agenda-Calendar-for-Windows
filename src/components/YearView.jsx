import React from 'react';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, startOfWeek, endOfWeek, isSameMonth, isSameDay } from 'date-fns';
import { es } from 'date-fns/locale';

const YearView = ({ date, onMonthClick }) => {
    const year = date.getFullYear();
    const months = Array.from({ length: 12 }, (_, i) => new Date(year, i, 1));
    const realToday = new Date(); // La fecha real de hoy

    return (
        <div className="h-full overflow-y-auto p-6 bg-white/40 no-scrollbar">
            <h2 className="text-5xl font-serif font-bold text-center mb-8 text-gray-800">{year}</h2>
            
            <div className="grid grid-cols-3 gap-8 pb-10"> 
                {months.map((monthDate, i) => {
                    const start = startOfWeek(startOfMonth(monthDate), { weekStartsOn: 1 });
                    const end = endOfWeek(endOfMonth(monthDate), { weekStartsOn: 1 });
                    const days = eachDayOfInterval({ start, end });

                    // Chequeamos si este mes es el mes actual real para colorear el título
                    const isCurrentMonth = isSameMonth(monthDate, realToday);

                    return (
                        <div 
                            key={i} 
                            onClick={() => onMonthClick(i)}
                            className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 hover:shadow-lg hover:scale-[1.02] transition-all cursor-pointer h-[300px] flex flex-col"
                        >
                            <h3 className={`text-lg font-bold mb-3 text-center capitalize ${isCurrentMonth ? 'text-red-500' : 'text-gray-700'}`}>
                                {format(monthDate, 'MMMM', { locale: es })}
                            </h3>
                            
                            <div className="grid grid-cols-7 text-center gap-y-2 flex-1 content-start">
                                {['L','M','X','J','V','S','D'].map(d => (
                                    <span key={d} className="text-[10px] text-gray-300 font-bold">{d}</span>
                                ))}
                                {days.map((d, idx) => {
                                    // Comprobaciones
                                    const isToday = isSameDay(d, realToday); 
                                    const isMonthDay = isSameMonth(d, monthDate); // ¿Pertenece este día al mes que estamos pintando?

                                    return (
                                        <span key={idx} className={`
                                            text-[11px] flex items-center justify-center h-6 w-6 mx-auto rounded-full
                                            ${!isMonthDay ? 'text-transparent' : 'text-gray-600'}
                                            
                                            /* CORRECCIÓN AQUÍ: Solo pintamos de rojo si es hoy Y pertenece al mes */
                                            ${isToday && isMonthDay ? 'bg-red-500 text-white font-bold shadow-md' : ''}
                                        `}>
                                            {isMonthDay ? format(d, 'd') : ''}
                                        </span>
                                    );
                                })}
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

export default YearView;