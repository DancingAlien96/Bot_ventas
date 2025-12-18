import dotenv from 'dotenv';

dotenv.config();

export const config = {
  telegram: {
    botToken: process.env.TELEGRAM_BOT_TOKEN || '',
  },
  openai: {
    apiKey: process.env.OPENAI_API_KEY || '',
  },
  woocommerce: {
    url: process.env.WOOCOMMERCE_URL || '',
    consumerKey: process.env.WOOCOMMERCE_CONSUMER_KEY || '',
    consumerSecret: process.env.WOOCOMMERCE_CONSUMER_SECRET || '',
  },
  database: {
    path: process.env.DATABASE_PATH || './data/bot.db',
  },
  business: {
    name: process.env.BUSINESS_NAME || 'Aquaequipos',
    timezone: process.env.TIMEZONE || 'America/Guatemala',
    ownerId: parseInt(process.env.OWNER_TELEGRAM_ID || '0'),
  },
  nodeEnv: process.env.NODE_ENV || 'development',
};

// Validar configuración crítica
const isInitScript = process.argv.some(arg => 
  arg.includes('initDb') || arg.includes('processPdf')
);

if (!isInitScript) {
  if (!config.telegram.botToken) {
    throw new Error('TELEGRAM_BOT_TOKEN es requerido en .env');
  }

  if (!config.openai.apiKey) {
    throw new Error('OPENAI_API_KEY es requerido en .env');
  }
}
