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

  // Helper para peticiones XML
  async request(method, url, data = null, headers = {}) {
    try {
      const response = await axios({
        method,
        url,
        auth: this.auth,
        data,
        headers: {
          'Content-Type': 'application/xml; charset=utf-8',
          'Depth': '1',
          ...headers
        }
      });
      return response.data;
    } catch (error) {
      console.error('iCloud Request Error:', error.response?.status, error.message);
      if (error.response?.data) {
          console.error('Response Data:', error.response.data);
      }
      throw error;
    }
  }

  // 1. Descubrir la URL del "Principal" (Usuario)
  async getPrincipalUrl() {
    const xmlBody = `
      <d:propfind xmlns:d="DAV:">
        <d:prop>
          <d:current-user-principal />
        </d:prop>
      </d:propfind>
    `;

    const responseXml = await this.request('PROPFIND', this.baseUrl, xmlBody);
    const parsed = this.parser.parse(responseXml);
    
    // fast-xml-parser structure: multistatus.response...
    try {
        // La estructura puede variar, buscamos con cuidado
        const response = parsed.multistatus && parsed.multistatus.response;
        const propStat = Array.isArray(response) ? response[0] : response;
        const props = propStat.propstat.prop;
        const principal = props['current-user-principal'];
        const href = principal.href;
        return href; 
    } catch (e) {
        console.error("Error parsing principal URL", e);
        throw new Error("No se pudo obtener el Principal URL de iCloud.");
    }
  }

  // 2. Obtener Calendarios del Home Set
  async getCalendars() {
    const principalUrl = await this.getPrincipalUrl();
    const fullPrincipalUrl = `${this.baseUrl}${principalUrl}`;

    const homeSetBody = `
      <d:propfind xmlns:d="DAV:" xmlns:c="urn:ietf:params:xml:ns:caldav">
        <d:prop>
          <c:calendar-home-set />
        </d:prop>
      </d:propfind>
    `;
    const homeSetXml = await this.request('PROPFIND', fullPrincipalUrl, homeSetBody);
    const homeSetParsed = this.parser.parse(homeSetXml);
    
    let homeUrl = '';
    try {
         const response = homeSetParsed.multistatus.response;
         // Puede ser array o objeto
         const propStat = Array.isArray(response) ? response[0] : response;
         const props = Array.isArray(propStat.propstat) ? propStat.propstat[0].prop : propStat.propstat.prop;
         
         const calendarHomeSet = props['calendar-home-set'];
         homeUrl = calendarHomeSet.href;
    } catch(e) {
        throw new Error("Error obteniendo calendar-home-set");
    }

    const fullHomeUrl = `${this.baseUrl}${homeUrl}`;

    const calendarsBody = `
      <d:propfind xmlns:d="DAV:" xmlns:c="urn:ietf:params:xml:ns:caldav" xmlns:cs="http://calendarserver.org/ns/">
        <d:prop>
          <d:displayname />
          <d:resourcetype />
          <cs:getctag />
        </d:prop>
      </d:propfind>
    `;

    const calendarsXml = await this.request('PROPFIND', fullHomeUrl, calendarsBody, { Depth: '1' });
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
                const href = resp.href;
                const displayName = props.displayname || 'Calendario Sin Nombre';
                const ctag = props.getctag || '';
                
                calendars.push({
                    name: displayName,
                    url: `${this.baseUrl}${href}`,
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
          <c:calendar-data />
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
            const calendarData = props['calendar-data']; 
            
            const jcal = ICAL.parse(calendarData);
            const comp = new ICAL.Component(jcal);
            const vevents = comp.getAllSubcomponents('vevent');

            for (const vevent of vevents) {
                const event = new ICAL.Event(vevent);
                
                events.push({
                    id: event.uid || crypto.randomUUID(),
                    title: event.summary || 'Sin Título',
                    start: event.startDate.toJSDate().toISOString(),
                    end: event.endDate.toJSDate().toISOString(),
                    description: event.description || '',
                    allDay: event.startDate.isDate,
                    location: event.location || '',
                    type: 'icloud',
                    calendarUrl: calendarUrl
                });
            }

        } catch (e) {
            console.warn("Error parsing event from stream", e);
        }
    }

    return events;
  }
}

