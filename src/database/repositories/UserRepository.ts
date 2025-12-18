import { db } from '../index';
import { User } from '../../types';

export class UserRepository {
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
