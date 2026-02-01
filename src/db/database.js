import Dexie from 'dexie';

export const db = new Dexie('PlannerDB_Final');

db.version(1).stores({
  // AÑADIMOS 'reminder' AL FINAL
  events: 'id, title, start, end, color, description, allDay, reminder', 
  tasks: 'id, title, completed, createdAt',
  notes: 'id, title, content, color, pinned, createdAt'
});