import { db } from '../index';
import { Conversation } from '../../types';
import { config } from '../../config';
import { ConversationModel } from '../mongo';

export class ConversationRepository {
  static async create(userId: number, role: Conversation['role'], content: string): Promise<Conversation> {
    if (config.database.type === 'mongo') {
      const created = await ConversationModel.create({ userTelegramId: userId, role, content });
      return {
        id: Number(created._id.toString().slice(0, 12).replace(/[^0-9]/g, '') || Date.now()),
        userId,
        role,
        content,
        createdAt: new Date(created.createdAt),
      } as Conversation;
    }

    const result = db.prepare(`
      INSERT INTO conversations (user_id, role, content)
      VALUES (?, ?, ?)
    `).run(userId, role, content);

    const found = await this.findById(result.lastInsertRowid as number);
    if (!found) throw new Error("Failed to retrieve created conversation");
    return found;
  }

  static async findById(id: number): Promise<Conversation | undefined> {
    if (config.database.type === 'mongo') {
      const doc = await ConversationModel.findOne({ _id: id }).lean().exec();
      if (!doc) return undefined;
      return {
        id: id,
        userId: doc.userTelegramId,
        role: doc.role as Conversation['role'],
        content: doc.content,
        createdAt: new Date(doc.createdAt),
      };
    }

    const row = db.prepare('SELECT * FROM conversations WHERE id = ?').get(id) as any;
    return row ? this.mapRowToConversation(row) : undefined;
  }

  static async findByUserId(userId: number, limit: number = 10): Promise<Conversation[]> {
    if (config.database.type === 'mongo') {
      const docs = await ConversationModel.find({ userTelegramId: userId }).sort({ createdAt: -1 }).limit(limit).lean().exec();
      return docs.map(d => ({
        id: Number(d._id.toString().slice(0, 12).replace(/[^0-9]/g, '') || Date.now()),
        userId: d.userTelegramId,
        role: d.role as Conversation['role'],
        content: d.content,
        createdAt: new Date(d.createdAt),
      })).reverse();
    }

    const rows = db.prepare(`
      SELECT * FROM conversations 
      WHERE user_id = ? 
      ORDER BY created_at DESC 
      LIMIT ?
    `).all(userId, limit) as any[];
    return rows.map(this.mapRowToConversation).reverse(); // Ordenar cronológicamente
  }

  static async deleteOldMessages(userId: number, keepLast: number = 20): Promise<void> {
    if (config.database.type === 'mongo') {
      const docs = await ConversationModel.find({ userTelegramId: userId }).sort({ createdAt: -1 }).skip(keepLast).select('_id').lean().exec();
      const ids = docs.map(d => d._id);
      if (ids.length) await ConversationModel.deleteMany({ _id: { $in: ids } }).exec();
      return;
    }

    db.prepare(`
      DELETE FROM conversations 
      WHERE user_id = ? 
      AND id NOT IN (
        SELECT id FROM conversations 
        WHERE user_id = ? 
        ORDER BY created_at DESC 
        LIMIT ?
      )
    `).run(userId, userId, keepLast);
  }

  private static mapRowToConversation(row: any): Conversation {
    return {
      id: row.id,
      userId: row.user_id,
      role: row.role,
      content: row.content,
      createdAt: new Date(row.created_at),
    };
  }
}
