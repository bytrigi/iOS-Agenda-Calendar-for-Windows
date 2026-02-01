import Dexie from 'dexie';

export const db = new Dexie('PlannerDB_Final');

db.version(2).stores({
  // AÑADIMOS 'reminder' AL FINAL
  events: '++id, title, start, end, allDay, color, description, reminder, source, calendarName', // Añadido source y calendarName
  tasks: 'id, title, completed, createdAt',
  notes: 'id, title, content, color, pinned, createdAt'
});