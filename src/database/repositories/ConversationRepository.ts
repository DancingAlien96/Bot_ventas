import { db } from '../index';
import { Conversation } from '../../types';

export class ConversationRepository {
  static create(userId: number, role: Conversation['role'], content: string): Conversation {
    const result = db.prepare(`
      INSERT INTO conversations (user_id, role, content)
      VALUES (?, ?, ?)
    `).run(userId, role, content);

    return this.findById(result.lastInsertRowid as number)!;
  }

  static findById(id: number): Conversation | undefined {
    const row = db.prepare('SELECT * FROM conversations WHERE id = ?').get(id) as any;
    return row ? this.mapRowToConversation(row) : undefined;
  }

  static findByUserId(userId: number, limit: number = 10): Conversation[] {
    const rows = db.prepare(`
      SELECT * FROM conversations 
      WHERE user_id = ? 
      ORDER BY created_at DESC 
      LIMIT ?
    `).all(userId, limit) as any[];
    return rows.map(this.mapRowToConversation).reverse(); // Ordenar cronológicamente
  }

  static deleteOldMessages(userId: number, keepLast: number = 20): void {
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
