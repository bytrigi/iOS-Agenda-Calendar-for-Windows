import axios from 'axios';
import { XMLParser } from 'fast-xml-parser';
import ICAL from 'ical.js';

export class ICloudService {
  constructor(username, password) {
    this.username = username;
    this.password = password;
    this.auth = { username, password };
    this.baseUrl = 'https://caldav.icloud.com';
    this.parser = new XMLParser({
        ignoreAttributes: false,
        attributeNamePrefix: "",
        removeNsprefix: true
    });
  }

  // Helper para peticiones XML (USANDO EL PROXY DE ELECTRON)
  async request(method, url, data = null, headers = {}) {
    try {
      console.log(`[iCloudService] ${method} ${url}`);
      
      const config = {
        method,
        url,
        auth: this.auth,
        data,
        headers: {
          'Content-Type': 'application/xml', // iCloud prefiere sin charset en el content-type a veces
          'Accept': 'text/xml, application/xml',
          'Depth': '1', // Default, pero anulable
          ...headers
        }
      };

      // Usar el puente de Electron si existe (Producción/Dev)
      if (window.electronAPI && window.electronAPI.icloudRequest) {
          const result = await window.electronAPI.icloudRequest(config);
          
          if (!result.success) {
              console.error('[iCloudService Proxy Error]', result);
              // Si falla con objetos, intentamos mostrar algo legible
              const errorMsg = result.error + (result.status ? ` (Status: ${result.status})` : '');
              throw new Error(errorMsg);
          }
          return result.data;
      } else {
          // Fallback para desarrollo navegador puro (probablemente fallará CORS)
          console.warn('⚠️ Usando Axios directo (puede fallar por CORS).');
          const response = await axios(config);
          return response.data;
      }

    } catch (error) {
      if (error.message && error.message.includes('412')) {
          console.warn('iCloud Precondition Failed (412) - Handled by App fallback.');
      } else {
          console.error('iCloud Request Error:', error.message);
      }
      throw error;
    }
  }

  // Helper para asegurarse de obtener el texto de un nodo XML
  // fast-xml-parser devuelve un objeto si el nodo tiene atributos (ej: xmlns)
  _getText(node) {
      if (!node) return '';
      if (typeof node === 'string') return node;
      if (typeof node === 'object') {
          return node['#text'] || '';
      }
      return '';
  }

  // 1. Descubrir la URL del "Principal" (Usuario)
  async getPrincipalUrl() {
    console.log('[iCloudService] Getting Principal URL...');
    const xmlBody = `
      <d:propfind xmlns:d="DAV:">
        <d:prop>
          <d:current-user-principal />
        </d:prop>
      </d:propfind>
    `;

    // IMPORTANTE: Depth 0 para descubrir principal
    const responseXml = await this.request('PROPFIND', this.baseUrl, xmlBody, { 'Depth': '0' });
    console.log('[iCloudService] Principal Response XML:', responseXml); // DEBUG
    
    const parsed = this.parser.parse(responseXml);
    console.log('[iCloudService] Parsed Principal:', JSON.stringify(parsed, null, 2)); // DEBUG
    
    try {
        const response = parsed.multistatus && parsed.multistatus.response;
        const propStat = Array.isArray(response) ? response[0] : response;
        const props = propStat.propstat.prop;
        const principal = props['current-user-principal'];
        
        // Usar helper para extraer href, ya que puede ser objeto
        const href = this._getText(principal.href);
        
        console.log('[iCloudService] Found Principal HREF:', href); // DEBUG
        
        if (!href) throw new Error("Principal HREF is undefined");
        return href; 
    } catch (e) {
        console.error("Error parsing principal URL", e);
        throw new Error("No se pudo obtener el Principal URL de iCloud.");
    }
  }

  // 2. Obtener Calendarios del Home Set
  async getCalendars() {
    console.log('[iCloudService] Getting Calendars...');
    const principalUrl = await this.getPrincipalUrl();
    const fullPrincipalUrl = `${this.baseUrl}${principalUrl}`;
    console.log('[iCloudService] Full Principal URL:', fullPrincipalUrl); // DEBUG

    const homeSetBody = `
      <d:propfind xmlns:d="DAV:" xmlns:c="urn:ietf:params:xml:ns:caldav">
        <d:prop>
          <c:calendar-home-set />
        </d:prop>
      </d:propfind>
    `;
    
    // IMPORTANTE: Depth 0 para propiedades de usuario
    const homeSetXml = await this.request('PROPFIND', fullPrincipalUrl, homeSetBody, { 'Depth': '0' });
    const homeSetParsed = this.parser.parse(homeSetXml);
    console.log('[iCloudService] Parsed Home Set:', JSON.stringify(homeSetParsed, null, 2)); // DEBUG
    
    let homeUrl = '';
    try {
         const response = homeSetParsed.multistatus.response;
         // Puede ser array o objeto
         const propStat = Array.isArray(response) ? response[0] : response;
         const props = Array.isArray(propStat.propstat) ? propStat.propstat[0].prop : propStat.propstat.prop;
         
         const calendarHomeSet = props['calendar-home-set'];
         homeUrl = this._getText(calendarHomeSet.href);
         console.log('[iCloudService] Found Home URL:', homeUrl); // DEBUG
    } catch(e) {
        console.error(e);
        throw new Error("Error obteniendo calendar-home-set");
    }

    if (!homeUrl) throw new Error("Home URL is invalid");

    // Si la URL ya es absoluta (empieza por http), no añadir baseUrl
    const fullHomeUrl = homeUrl.startsWith('http') ? homeUrl : `${this.baseUrl}${homeUrl}`;
    console.log('[iCloudService] Full Home URL:', fullHomeUrl); // DEBUG

    const calendarsBody = `
      <d:propfind xmlns:d="DAV:" xmlns:c="urn:ietf:params:xml:ns:caldav" xmlns:cs="http://calendarserver.org/ns/">
        <d:prop>
          <d:displayname />
          <d:resourcetype />
          <cs:getctag />
        </d:prop>
      </d:propfind>
    `;

    // Depth 1 para ver hijos (calendarios) es correcto aquí
    const calendarsXml = await this.request('PROPFIND', fullHomeUrl, calendarsBody, { 'Depth': '1' });
    const calendarsParsed = this.parser.parse(calendarsXml);
    
    const calendars = [];
    let responses = calendarsParsed.multistatus.response || [];
    if (!Array.isArray(responses)) responses = [responses];

    for (const resp of responses) {
        try {
            const propstats = Array.isArray(resp.propstat) ? resp.propstat : [resp.propstat];
            // Buscamos el propstat con status 200 OK, pero generalmente el primero tiene los props
            const props = propstats[0].prop;
            
            const resourceType = props.resourcetype;
            
            // force array check or existance check
            if (resourceType && resourceType.calendar !== undefined) {
                const href = this._getText(resp.href);
                const displayName = this._getText(props.displayname) || 'Calendario Sin Nombre';
                const ctag = this._getText(props.getctag) || '';
                
                // Algunos href son relativos, otros absolutos. Chequear.
                let calendarUrl = href;
                if (!href.startsWith('http')) {
                    // Si es relativo, hay que tener cuidado. A veces es relativo al root, a veces al home.
                    // Generalmente iCloud devuelve paths absolutos desde el root (ej: /123/calendars/work/)
                    // Si empieza por /, usamos baseUrl. Si no, quizá haya que componer con fullHomeUrl.
                    // Pero para iCloud suele ser safe usar baseUrl + href si href empieza por /
                    calendarUrl = `${this.baseUrl}${href}`;
                }

                calendars.push({
                    name: displayName,
                    url: calendarUrl,
                    ctag,
                    source: 'icloud'
                });
            }
        } catch (e) {
            // Ignorar
        }
    }
    
    return calendars;
  }



  // 3. Obtener Eventos de un calendario (REPORT)
  async getEvents(calendarUrl, startDate, endDate) {
    const startStr = startDate.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
    const endStr = endDate.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';

    const reportBody = `
      <c:calendar-query xmlns:d="DAV:" xmlns:c="urn:ietf:params:xml:ns:caldav">
        <d:prop>
          <d:getetag />
          <c:calendar-data>
            <c:expand start="${startStr}" end="${endStr}" />
          </c:calendar-data>
        </d:prop>
        <c:filter>
          <c:comp-filter name="VCALENDAR">
            <c:comp-filter name="VEVENT">
                <c:time-range start="${startStr}" end="${endStr}" />
            </c:comp-filter>
          </c:comp-filter>
        </c:filter>
      </c:calendar-query>
    `;

    const reportXml = await this.request('REPORT', calendarUrl, reportBody);
    const parsed = this.parser.parse(reportXml);
    
    const events = [];
    let responses = parsed.multistatus && parsed.multistatus.response;
    if (!responses) return [];
    if (!Array.isArray(responses)) responses = [responses];

    for (const resp of responses) {
        try {
            const propstats = Array.isArray(resp.propstat) ? resp.propstat : [resp.propstat];
            const props = propstats[0].prop;
            // Usar _getText para sacar el string VCALENDAR, fast-xml-parser puede devolver objeto
            const calendarData = this._getText(props['calendar-data']); 
            
            if (!calendarData) {
                console.warn('[iCloudService] Evento sin data, saltando...');
                continue;
            }

            const jcal = ICAL.parse(calendarData);
            const comp = new ICAL.Component(jcal);
            const vevents = comp.getAllSubcomponents('vevent');

            for (const vevent of vevents) {
                const event = new ICAL.Event(vevent);
                
                let start = event.startDate.toJSDate();
                let end = event.endDate.toJSDate();
                const allDay = event.startDate.isDate;

                // CORRECCIÓN: Eventos de todo el día
                // iCal protocol define DTEND como exclusivo (el día siguiente a las 00:00).
                // Si es all-day, restamos 1 segundo para que caiga en el día correcto visualmente (23:59:59)
                if (allDay) {
                     end = new Date(end.getTime() - 1);
                }

                // PARSEO COLOR PLANMORE
                let color = '#EA426A'; // Default fallback
                if (event.description) {
                    // DEBUG: Ver qué llega realmente
                    if (event.description.includes('COLOR')) {
                         console.log(`[DEBUG] Description for ${event.summary}:`, event.description);
                    }
                    
                    const colorMatch = event.description.match(/<COLOR:(#[A-Fa-f0-9]{6})>/);
                    if (colorMatch) {
                        color = colorMatch[1];
                        console.log(`[DEBUG] Color parsed: ${color}`);
                    }
                }

                // ID COMPUESTO PARA RECURRENCIA
                // Si es un evento recurrente expandido, el UID es el mismo para todas las instancias.
                // Dexie necesita IDs únicos. Usamos: UID_STARTISO
                // Verificamos si es recurrente mirando recurrenceId o si vevent tiene propiedad 'recurrence-id'
                const recurrenceId = event.recurrenceId;
                let finalId = event.uid || crypto.randomUUID();
                
                // Si tiene recurrenceId (es una excepción o instancia específica) o si viene de una expansión
                // Generamos ID único para almacenamiento local
                if (recurrenceId || vevent.getFirstProperty('recurrence-id')) {
                    finalId = `${event.uid}_${start.toISOString()}`;
                } 
                // También si detectamos que es parte de una serie (aunque ical.js a veces no lo marca explícitamente en el objeto Event simple)
                // Al usar <expand>, el servidor manda VEVENTs sueltos.
                // Estrategia segura: Si ya existe ese UID en el array 'events' (procesado en este loop), es recurrencia.
                // Pero como 'events' está vacío al principio del loop, esto no basta.
                // Mejor: Usamos siempre composite ID si detectamos que es recurrente.
                // Ojo: Para update/delete necesitamos el UID original. Guardamos 'originalUid'.
                
                // EXTRAER RRULE (FREQ y UNTIL) para UI
                let recurrence = 'NONE';
                let recurrenceEnd = null;
                
                if (event.component && event.component.hasProperty('rrule')) {
                    const rrule = event.component.getFirstProperty('rrule').getValue();
                    // rrule es un objeto ICAL.Recur
                    if (rrule && rrule.freq) {
                        recurrence = rrule.freq.toString(); // "WEEKLY", "DAILY", etc.
                        if (rrule.until) {
                            recurrenceEnd = rrule.until.toJSDate().toISOString();
                        }
                    }
                }

                events.push({
                    id: finalId,
                    originalId: event.uid, // Para saber cuál borrar/editar en el server
                    title: event.summary || 'Sin Título',
                    start: start.toISOString(),
                    end: end.toISOString(),
                    description: event.description || '',
                    allDay: allDay,
                    location: event.location || '',
                    type: 'icloud',
                    color: color,
                    calendarUrl: calendarUrl,
                    recurrenceId: recurrenceId ? recurrenceId.toString() : null,
                    recurrence: recurrence,
                    recurrenceEnd: recurrenceEnd
                });
            }

        } catch (e) {
            console.warn("Error parsing event from stream", e);
        }
    }

    return events;
  }

  // 4. Crear Evento (PUT)
  async createEvent(calendarUrl, eventData) {
    const uid = eventData.id || crypto.randomUUID();
    
    // Formatear fechas para iCal
    // Si es todo el dia: YYYYMMDD (LOCAL, para evitar shift UTC)
    // Si no: YYYYMMDDTHHMMSSZ (UTC)
    const formatDate = (date, isAllDay = false) => {
        const d = new Date(date);
        
        if (isAllDay) {
            // USAR FECHA LOCAL: getFullYear, getMonth, getDate
            const year = d.getFullYear();
            const month = String(d.getMonth() + 1).padStart(2, '0');
            const day = String(d.getDate()).padStart(2, '0');
            return `${year}${month}${day}`;
        }
        
        // CORRECCIÓN: Usar "Floating Time" (Hora Local sin Z) para que visualmente cuadre en todos lados
        // (8:30 input -> 8:30 en iCloud, ignorando zonas horarias complejas)
        const year = d.getFullYear();
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        const hours = String(d.getHours()).padStart(2, '0');
        const minutes = String(d.getMinutes()).padStart(2, '0');
        const seconds = String(d.getSeconds()).padStart(2, '0');
        
        return `${year}${month}${day}T${hours}${minutes}${seconds}`;
    };

    // Ajuste para final de todo el día para iCal (Exclusivo, día siguiente)
    let startStr = formatDate(eventData.start, eventData.allDay);
    let endStr = formatDate(eventData.end, eventData.allDay);
    
    if (eventData.allDay) {
        // En UI, "Todo el día" para el 1 de Feb suele guardarse como: Start: Feb 1 00:00, End: Feb 1 23:59 (aprox)
        // Para iCal, necesitamos Start: 20260201, End: 20260202 (Exclusivo)
        
        // Si el string de Fin es igual al de Inicio (ej: 20260201 para ambos), significa que 
        // la fecha de fin cae en el mismo día. Sumamos 1 día para cumplir el estándar.
        // O si la diferencia en tiempo es pequeña.
        
        // Re-calculamos END basándonos en START + duración real (mínimo 1 día)
        const s = new Date(eventData.start);
        const e = new Date(eventData.end);
        
        // Si diff < 24h, o si los strings son iguales, forzamos +1 día desde Start
        if (endStr === startStr || (e - s < 86400000)) {
            const nextDay = new Date(s);
            nextDay.setDate(s.getDate() + 1);
            
            const year = nextDay.getFullYear();
            const month = String(nextDay.getMonth() + 1).padStart(2, '0');
            const day = String(nextDay.getDate()).padStart(2, '0');
            endStr = `${year}${month}${day}`;
        }
    }

    // INYECCIÓN COLOR PLANMORE
    let description = eventData.description || '';
    if (eventData.color && eventData.color.startsWith('#')) {
        description = description.replace(/<COLOR:#[A-Fa-f0-9]{6}>/g, '').trim();
        description = `<COLOR:${eventData.color}>\n` + description;
    }

    // INYECCIÓN RECURRENCIA (RRULE)
    let rruleLine = '';
    if (eventData.recurrence && eventData.recurrence !== 'NONE') {
        rruleLine = `RRULE:FREQ=${eventData.recurrence}`;
        
        // Agregar UNTIL si existe (YYYYMMDD)
        if (eventData.recurrenceEnd) {
             const untilDate = new Date(eventData.recurrenceEnd);
             const y = untilDate.getFullYear();
             const m = String(untilDate.getMonth() + 1).padStart(2, '0');
             const d = String(untilDate.getDate()).padStart(2, '0');
             const untilStr = `${y}${m}${d}`; // Floating date, matching DTSTART type usually
             rruleLine += `;UNTIL=${untilStr}`;
        }
    }

    const vcalendar = `BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//PlannerApp//v1.0//EN
BEGIN:VEVENT
UID:${uid}
DTSTAMP:${formatDate(new Date())}
DTSTART;VALUE=${eventData.allDay ? 'DATE' : 'DATE-TIME'}:${startStr}
DTEND;VALUE=${eventData.allDay ? 'DATE' : 'DATE-TIME'}:${endStr}
SUMMARY:${(eventData.title || 'Sin Título').replace(/\r?\n/g, '\\n')}
DESCRIPTION:${description.replace(/\r?\n/g, '\\n')}
LOCATION:${(eventData.location || '').replace(/\r?\n/g, '\\n')}
${rruleLine}
END:VEVENT
END:VCALENDAR`;

    // PUT to calendarUrl + uid + .ics
    const eventUrl = `${calendarUrl.replace(/\/$/, '')}/${uid}.ics`;
    
    console.log('[iCloudService] Creating Event at:', eventUrl);
    
    await this.request('PUT', eventUrl, vcalendar, {
        'Content-Type': 'text/calendar; charset=utf-8',
        'If-None-Match': '*' 
    });

    return { ...eventData, id: uid, description };
  }

  // 5. Actualizar Evento (PUT sin checks)
  async updateEvent(calendarUrl, eventData) {
      const uid = eventData.id;
      if (!uid) throw new Error("Evento sin ID para actualizar");

    // Formatear fechas para iCal (mismo helper que en create)
    const formatDate = (date, isAllDay = false) => {
        const d = new Date(date);
        if (isAllDay) {
            const year = d.getFullYear();
            const month = String(d.getMonth() + 1).padStart(2, '0');
            const day = String(d.getDate()).padStart(2, '0');
            return `${year}${month}${day}`;
        }
        // Floating time para Update también
        const year = d.getFullYear();
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        const hours = String(d.getHours()).padStart(2, '0');
        const minutes = String(d.getMinutes()).padStart(2, '0');
        const seconds = String(d.getSeconds()).padStart(2, '0');
        
        return `${year}${month}${day}T${hours}${minutes}${seconds}`;
    };

    let startStr = formatDate(eventData.start, eventData.allDay);
    let endStr = formatDate(eventData.end, eventData.allDay);
    
    // Misma lógica de ajuste de día siguiente para AllDay
    if (eventData.allDay) {
        const s = new Date(eventData.start);
        const e = new Date(eventData.end);
        if (endStr === startStr || (e - s < 86400000)) {
            const nextDay = new Date(s);
            nextDay.setDate(s.getDate() + 1);
            const year = nextDay.getFullYear();
            const month = String(nextDay.getMonth() + 1).padStart(2, '0');
            const day = String(nextDay.getDate()).padStart(2, '0');
            endStr = `${year}${month}${day}`;
        }
    }

    // INYECCIÓN COLOR PLANMORE (UPDATE)
    let description = eventData.description || '';
    if (eventData.color && eventData.color.startsWith('#')) {
        // Remove existing color tag if any
        description = description.replace(/<COLOR:#[A-Fa-f0-9]{6}>/g, '').trim();
        // Append new color tag
        description = `<COLOR:${eventData.color}>\n` + description;
    }
    
    console.log(`[DEBUG UPDATE] Generating VCALENDAR for ${eventData.title}. Color: ${eventData.color}. Final Desc: ${JSON.stringify(description)}`);

    // INYECCIÓN RECURRENCIA (RRULE) para Updates
    let rruleLine = '';
    // OJO: Si actualizamos una instancia específica, NO debemos enviar RRULE, eso sería para la serie.
    // Pero si estamos editando la serie (master), sí.
    // Por simplicidad, asumimos que si se pasa recurrence != NONE, se quiere aplicar la regla.
    if (eventData.recurrence && eventData.recurrence !== 'NONE') {
        rruleLine = `RRULE:FREQ=${eventData.recurrence}`;
        
        // Agregar UNTIL si existe (YYYYMMDD)
        if (eventData.recurrenceEnd) {
             const untilDate = new Date(eventData.recurrenceEnd);
             const y = untilDate.getFullYear();
             const m = String(untilDate.getMonth() + 1).padStart(2, '0');
             const d = String(untilDate.getDate()).padStart(2, '0');
             const untilStr = `${y}${m}${d}`;
             rruleLine += `;UNTIL=${untilStr}`;
        }
    }

    const vcalendar = `BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//PlannerApp//v1.0//EN
BEGIN:VEVENT
UID:${uid}
DTSTAMP:${formatDate(new Date())}
DTSTART;VALUE=${eventData.allDay ? 'DATE' : 'DATE-TIME'}:${startStr}
DTEND;VALUE=${eventData.allDay ? 'DATE' : 'DATE-TIME'}:${endStr}
SUMMARY:${(eventData.title || 'Sin Título').replace(/\r?\n/g, '\\n')}
DESCRIPTION:${description.replace(/\r?\n/g, '\\n')}
LOCATION:${(eventData.location || '').replace(/\r?\n/g, '\\n')}
${rruleLine}
END:VEVENT
END:VCALENDAR`;

      const eventUrl = `${calendarUrl.replace(/\/$/, '')}/${uid}.ics`;
      console.log('[iCloudService] Updating Event at:', eventUrl);

      // PUT SIN If-None-Match para sobrescribir
      await this.request('PUT', eventUrl, vcalendar, {
          'Content-Type': 'text/calendar; charset=utf-8'
      });
      
      return { ...eventData, description };
  }

  // 6. Borrar Evento (DELETE)
  async deleteEvent(calendarUrl, eventId) {
      if (!eventId) throw new Error("Evento sin ID para borrar");
      
      const eventUrl = `${calendarUrl.replace(/\/$/, '')}/${eventId}.ics`;
      console.log('[iCloudService] Deleting Event at:', eventUrl);

      await this.request('DELETE', eventUrl);
      return true;
  }

  // 7. Excluir Instancia (Smart Delete: Solo esta)
  async excludeInstance(calendarUrl, uid, dateToExclude) {
      const eventUrl = `${calendarUrl.replace(/\/$/, '')}/${uid}.ics`;
      console.log('[iCloudService] Excluding instance:', dateToExclude, 'for UID:', uid);

      // 1. Fetch raw ICS
      const icsData = await this.request('GET', eventUrl);
      
      // 2. Format EXDATE (YYYYMMDD) - Assumes Floating/AllDay match
      const d = new Date(dateToExclude);
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      const exDateStr = `${y}${m}${day}`;
      
      // 3. Inject EXDATE before END:VEVENT
      // Check if EXDATE already exists to append or add new line
      // Simple approach: Always add a new EXDATE line. iCal clients handle multiple lines.
      // Use VALUE=DATE for broad compatibility if original is date-only, but let's try generic.
      // Better: EXDATE;VALUE=DATE:20260113
      
      let newIcs = icsData.replace(/END:VEVENT/, `EXDATE;VALUE=DATE:${exDateStr}\nEND:VEVENT`);
      
      // 4. Update DTSTAMP
      const nowStr = new Date().toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
      newIcs = newIcs.replace(/DTSTAMP:.*(\r\n|\n|\r)/, `DTSTAMP:${nowStr}\n`);

      // 5. Save
      await this.request('PUT', eventUrl, newIcs, {
          'Content-Type': 'text/calendar; charset=utf-8'
      });
  }

  // 8. Truncar Serie (Smart Delete: Esta y futuras)
  async truncateSeries(calendarUrl, uid, lastValidDate) {
      const eventUrl = `${calendarUrl.replace(/\/$/, '')}/${uid}.ics`;
      console.log('[iCloudService] Truncating series at:', lastValidDate, 'for UID:', uid);
      
      // 1. Fetch raw
      let icsData = await this.request('GET', eventUrl);
      
      // 2. Calc UNTIL date (YYYYMMDD)
      const d = new Date(lastValidDate);
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      const untilStr = `${y}${m}${day}`;
      
      // 3. Replace or Append UNTIL in RRULE
      // Regex search for RRULE:.*
      const rruleMatch = icsData.match(/RRULE:(.*)(\r\n|\n|\r)/);
      if (rruleMatch) {
          let currentRrule = rruleMatch[1];
          // Remove existing UNTIL if any
          currentRrule = currentRrule.replace(/;?UNTIL=[^;]+/, '');
          // Append new UNTIL
          currentRrule += `;UNTIL=${untilStr}`;
          
          icsData = icsData.replace(/RRULE:.*(\r\n|\n|\r)/, `RRULE:${currentRrule}\n`);
      }
      
       // 4. Update DTSTAMP
      const nowStr = new Date().toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
      icsData = icsData.replace(/DTSTAMP:.*(\r\n|\n|\r)/, `DTSTAMP:${nowStr}\n`);

      // 5. Save
      await this.request('PUT', eventUrl, icsData, {
          'Content-Type': 'text/calendar; charset=utf-8'
      });
  }
}

