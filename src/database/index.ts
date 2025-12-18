import Database from 'better-sqlite3';
import { config } from '../config';
import * as fs from 'fs';
import * as path from 'path';

// Crear directorio de datos si no existe
const dataDir = path.dirname(config.database.path);
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

export const db = new Database(config.database.path);

// Habilitar claves foráneas
db.pragma('foreign_keys = ON');

// Inicializar esquema de base de datos
export function initDatabase() {
  // Tabla de usuarios
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      telegram_id INTEGER UNIQUE NOT NULL,
      first_name TEXT NOT NULL,
      last_name TEXT,
      username TEXT,
      phone TEXT,
      is_lead BOOLEAN DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Tabla de conversaciones (historial de chat)
  db.exec(`
    CREATE TABLE IF NOT EXISTS conversations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      role TEXT CHECK(role IN ('user', 'assistant', 'system')) NOT NULL,
      content TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id)
    )
  `);

  // Tabla de leads (clientes potenciales)
  db.exec(`
    CREATE TABLE IF NOT EXISTS leads (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      status TEXT CHECK(status IN ('new', 'contacted', 'qualified', 'converted', 'lost')) DEFAULT 'new',
      source TEXT DEFAULT 'telegram',
      notes TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id)
    )
  `);

  // Tabla de consultas de productos
  db.exec(`
    CREATE TABLE IF NOT EXISTS product_inquiries (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      product_name TEXT NOT NULL,
      query TEXT NOT NULL,
      response TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id)
    )
  `);

  // Índices para mejor rendimiento
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_conversations_user_id ON conversations(user_id);
    CREATE INDEX IF NOT EXISTS idx_leads_user_id ON leads(user_id);
    CREATE INDEX IF NOT EXISTS idx_leads_status ON leads(status);
    CREATE INDEX IF NOT EXISTS idx_product_inquiries_user_id ON product_inquiries(user_id);
  `);

  console.log('✅ Base de datos inicializada correctamente');
}

// Función para cerrar la base de datos
export function closeDatabase() {
  db.close();
  console.log('Base de datos cerrada');
}
