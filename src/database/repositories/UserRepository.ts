import { db } from '../index';
import { User } from '../../types';
import { config } from '../../config';
import { UserModel } from '../mongo';

export class UserRepository {
  private static normalizePhone(phone: string): string {
    return phone.replace(/\D/g, '');
  }

  static async findByTelegramId(telegramId: number): Promise<User | undefined> {
    if (config.database.type === 'mongo') {
      const doc = await UserModel.findOne({ telegramId }).lean().exec();
      if (!doc) return undefined;
      return {
        id: doc.telegramId,
        telegramId: doc.telegramId,
        firstName: doc.firstName,
        lastName: doc.lastName,
        username: doc.username,
        phone: doc.phone,
        isLead: Boolean(doc.isLead),
        createdAt: new Date(doc.createdAt),
      };
    }

    const row = db.prepare('SELECT * FROM users WHERE telegram_id = ?').get(telegramId) as any;
    return row ? this.mapRowToUser(row) : undefined;
  }

  static async create(telegramId: number, firstName: string, lastName?: string, username?: string): Promise<User> {
    if (config.database.type === 'mongo') {
      const created = await UserModel.create({ telegramId, firstName, lastName, username });
      return (await this.findByTelegramId(created.telegramId))!;
    }

    const result = db.prepare(`
      INSERT INTO users (telegram_id, first_name, last_name, username)
      VALUES (?, ?, ?, ?)
    `).run(telegramId, firstName, lastName, username);

    const user = await this.findByTelegramId(telegramId);
    if (!user) throw new Error("User not found");
    return user;
  }

  static async findOrCreateByPhone(phone: string, name?: string): Promise<User> {
    const normalized = this.normalizePhone(phone);
    const numericId = parseInt(normalized, 10);
    let user = await this.findByTelegramId(numericId);
    if (!user) {
      user = await this.create(numericId, name || 'Cliente', undefined, 'whatsapp');
      await this.updatePhone(numericId, phone);
    }
    return user;
  }

  static async findOrCreate(telegramId: number, firstName: string, lastName?: string, username?: string): Promise<User> {
    let user = await this.findByTelegramId(telegramId);
    if (!user) {
      user = await this.create(telegramId, firstName, lastName, username);
    }
    return user;
  }

  static async markAsLead(telegramId: number): Promise<void> {
    if (config.database.type === 'mongo') {
      await UserModel.updateOne({ telegramId }, { $set: { isLead: true } }).exec();
      return;
    }
    db.prepare('UPDATE users SET is_lead = 1 WHERE telegram_id = ?').run(telegramId);
  }

  static async updatePhone(telegramId: number, phone: string): Promise<void> {
    if (config.database.type === 'mongo') {
      await UserModel.updateOne({ telegramId }, { $set: { phone } }).exec();
      return;
    }
    db.prepare('UPDATE users SET phone = ? WHERE telegram_id = ?').run(phone, telegramId);
  }

  static async updateLastIncoming(telegramId: number, when: Date): Promise<void> {
    if (config.database.type === 'mongo') {
      await UserModel.updateOne({ telegramId }, { $set: { lastIncomingAt: when } }).exec();
      return;
    }
    db.prepare('UPDATE users SET last_incoming_at = ? WHERE telegram_id = ?').run(when.toISOString(), telegramId);
  }

  static async setLastIncomingByPhone(phone: string, when: Date): Promise<void> {
    const normalized = this.normalizePhone(phone);
    const numericId = parseInt(normalized, 10);
    if (config.database.type === 'mongo') {
      await this.updateLastIncoming(numericId, when);
      return;
    }
    db.prepare('UPDATE users SET last_incoming_at = ? WHERE telegram_id = ?').run(when.toISOString(), numericId);
  }

  static async getLastIncoming(telegramId: number): Promise<Date | null> {
    if (config.database.type === 'mongo') {
      const doc = await UserModel.findOne({ telegramId }).lean().exec();
      return doc && doc.lastIncomingAt ? new Date(doc.lastIncomingAt) : null;
    }
    const row = db.prepare('SELECT last_incoming_at FROM users WHERE telegram_id = ?').get(telegramId) as any;
    return row && row.last_incoming_at ? new Date(row.last_incoming_at) : null;
  }

  static async getAllLeads(): Promise<User[]> {
    if (config.database.type === 'mongo') {
      const docs = await UserModel.find({ isLead: true }).sort({ createdAt: -1 }).lean().exec();
      return docs.map(doc => ({
        id: doc.telegramId,
        telegramId: doc.telegramId,
        firstName: doc.firstName,
        lastName: doc.lastName,
        username: doc.username,
        phone: doc.phone,
        isLead: Boolean(doc.isLead),
        createdAt: new Date(doc.createdAt),
      }));
    }

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
