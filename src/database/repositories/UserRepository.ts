import { db } from '../index';
import { User } from '../../types';

export class UserRepository {
  private static normalizePhone(phone: string): string {
    return phone.replace(/\D/g, '');
  }

  static findByTelegramId(telegramId: number): User | undefined {
    const row = db.prepare('SELECT * FROM users WHERE telegram_id = ?').get(telegramId) as any;
    return row ? this.mapRowToUser(row) : undefined;
  }

  static create(telegramId: number, firstName: string, lastName?: string, username?: string): User {
    const result = db.prepare(`
      INSERT INTO users (telegram_id, first_name, last_name, username)
      VALUES (?, ?, ?, ?)
    `).run(telegramId, firstName, lastName, username);

    return this.findByTelegramId(telegramId)!;
  }

  static findOrCreateByPhone(phone: string, name?: string): User {
    const normalized = this.normalizePhone(phone);
    const numericId = parseInt(normalized, 10);
    let user = this.findByTelegramId(numericId);
    if (!user) {
      user = this.create(numericId, name || 'Cliente', undefined, 'whatsapp');
      this.updatePhone(numericId, phone);
    }
    return user;
  }

  static findOrCreate(telegramId: number, firstName: string, lastName?: string, username?: string): User {
    let user = this.findByTelegramId(telegramId);
    if (!user) {
      user = this.create(telegramId, firstName, lastName, username);
    }
    return user;
  }

  static markAsLead(telegramId: number): void {
    db.prepare('UPDATE users SET is_lead = 1 WHERE telegram_id = ?').run(telegramId);
  }

  static updatePhone(telegramId: number, phone: string): void {
    db.prepare('UPDATE users SET phone = ? WHERE telegram_id = ?').run(phone, telegramId);
  }

  static updateLastIncoming(telegramId: number, when: Date): void {
    db.prepare('UPDATE users SET last_incoming_at = ? WHERE telegram_id = ?').run(when.toISOString(), telegramId);
  }

  static setLastIncomingByPhone(phone: string, when: Date): void {
    const normalized = this.normalizePhone(phone);
    const numericId = parseInt(normalized, 10);
    db.prepare('UPDATE users SET last_incoming_at = ? WHERE telegram_id = ?').run(when.toISOString(), numericId);
  }

  static getLastIncoming(telegramId: number): Date | null {
    const row = db.prepare('SELECT last_incoming_at FROM users WHERE telegram_id = ?').get(telegramId) as any;
    return row && row.last_incoming_at ? new Date(row.last_incoming_at) : null;
  }

  static getAllLeads(): User[] {
    const rows = db.prepare('SELECT * FROM users WHERE is_lead = 1 ORDER BY created_at DESC').all() as any[];
    return rows.map(this.mapRowToUser);
  }

  private static mapRowToUser(row: any): User {
    return {
      id: row.id,
      telegramId: row.telegram_id,
      firstName: row.first_name,
      lastName: row.last_name,
      username: row.username,
      phone: row.phone,
      isLead: Boolean(row.is_lead),
      createdAt: new Date(row.created_at),
    };
  }
}
