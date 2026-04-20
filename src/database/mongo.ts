import mongoose, { Schema, Document, Model } from 'mongoose';
import { config } from '../config';

// Interfaces for models (internal)
interface IUser extends Document {
  telegramId: number;
  firstName: string;
  lastName?: string;
  username?: string;
  phone?: string;
  isLead: boolean;
  createdAt: Date;
  lastIncomingAt?: Date;
}

interface IConversation extends Document {
  userTelegramId: number;
  role: 'user' | 'assistant' | 'system';
  content: string;
  createdAt: Date;
}

interface ILead extends Document {
  userTelegramId: number;
  status: string;
  source: string;
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

interface IProductInquiry extends Document {
  userTelegramId: number;
  productName: string;
  query: string;
  response?: string;
  createdAt: Date;
}

// Schemas
const UserSchema = new Schema<IUser>({
  telegramId: { type: Number, required: true, unique: true, index: true },
  firstName: { type: String, required: true },
  lastName: String,
  username: String,
  phone: String,
  isLead: { type: Boolean, default: false },
  createdAt: { type: Date, default: () => new Date() },
  lastIncomingAt: Date,
});

const ConversationSchema = new Schema<IConversation>({
  userTelegramId: { type: Number, required: true, index: true },
  role: { type: String, enum: ['user', 'assistant', 'system'], required: true },
  content: { type: String, required: true },
  createdAt: { type: Date, default: () => new Date() },
});

const LeadSchema = new Schema<ILead>({
  userTelegramId: { type: Number, required: true, index: true },
  status: { type: String, default: 'new' },
  source: { type: String, default: 'telegram' },
  notes: String,
  createdAt: { type: Date, default: () => new Date() },
  updatedAt: { type: Date, default: () => new Date() },
});

const ProductInquirySchema = new Schema<IProductInquiry>({
  userTelegramId: { type: Number, required: true, index: true },
  productName: { type: String, required: true },
  query: { type: String, required: true },
  response: String,
  createdAt: { type: Date, default: () => new Date() },
});

// Models
export const UserModel: Model<IUser> = mongoose.models.User || mongoose.model('User', UserSchema);
export const ConversationModel: Model<IConversation> = mongoose.models.Conversation || mongoose.model('Conversation', ConversationSchema);
export const LeadModel: Model<ILead> = mongoose.models.Lead || mongoose.model('Lead', LeadSchema);
export const ProductInquiryModel: Model<IProductInquiry> = mongoose.models.ProductInquiry || mongoose.model('ProductInquiry', ProductInquirySchema);

export async function connectMongo(): Promise<void> {
  const uri = config.mongodb.uri;
  if (!uri) {
    throw new Error('MONGODB_URI no está configurada en env');
  }

  // Use mongoose connection pooling
  await mongoose.connect(uri, {
    // options can be extended if needed
  } as any);

  console.log('✅ Conectado a MongoDB');
}

export async function closeMongo(): Promise<void> {
  await mongoose.disconnect();
  console.log('🔌 Desconectado de MongoDB');
}
