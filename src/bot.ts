import { Telegraf } from 'telegraf';
import { message } from 'telegraf/filters';
import { config } from './config';
import { initDatabase } from './database';
import { UserRepository } from './database/repositories/UserRepository';
import { aiService } from './services/AIService';

console.log('🤖 Iniciando Bot de Asesoría y Ventas - Aquaequipos\n');

// Inicializar base de datos
console.log('📦 Inicializando base de datos...');
initDatabase();
console.log('✅ Base de datos lista\n');

// Crear bot
console.log('🔧 Creando instancia del bot...');
const bot = new Telegraf(config.telegram.botToken);
console.log('✅ Bot creado\n');

// Middleware para registrar/obtener usuario
bot.use(async (ctx, next) => {
  if (ctx.from) {
    const user = UserRepository.findOrCreate(
      ctx.from.id,
      ctx.from.first_name,
      ctx.from.last_name,
      ctx.from.username
    );
    
    // Agregar usuario al contexto
    (ctx as any).dbUser = user;
  }
  return next();
});

// Comando /start
bot.start(async (ctx) => {
  const user = (ctx as any).dbUser;
  
  // Simular tiempo de escritura humano (2-4 segundos)
  await ctx.sendChatAction('typing');
  await new Promise(resolve => setTimeout(resolve, 2500));
  
  ctx.reply(
    `¡Hola ${user.firstName}! 👋\n\n` +
    `Bienvenido a *${config.business.name}*. ` +
    `Te puedo ayudar con información sobre nuestros productos de tratamiento de agua, ` +
    `asesoría técnica, precios y disponibilidad.\n\n` +
    `¿En qué te puedo ayudar hoy?`,
    { parse_mode: 'Markdown' }
  );
});

// Comando /help
bot.help(async (ctx) => {
  await ctx.sendChatAction('typing');
  await new Promise(resolve => setTimeout(resolve, 2000));
  
  ctx.reply(
    `*Comandos disponibles:*\n\n` +
    `/start - Iniciar el bot\n` +
    `/productos - Buscar productos\n` +
    `/destacados - Ver productos destacados\n` +
    `/catalogo - Información del catálogo\n` +
    `/ayuda - Ver esta ayuda\n\n` +
    `*¿Cómo usarme?*\n` +
    `Puedes escribirme directamente lo que necesitas:\n\n` +
    `• "¿Qué sistemas de filtración tienen?"\n` +
    `• "Necesito un purificador para mi casa"\n` +
    `• "¿Cuánto cuesta el modelo X?"\n` +
    `• "¿Tienen suavizadores de agua?"\n\n` +
    `También puedo ayudarte con especificaciones técnicas, comparaciones de productos y recomendaciones personalizadas. 💧`,
    { parse_mode: 'Markdown' }
  );
});

// Comando /productos (buscar)
bot.command('productos', async (ctx) => {
  const user = (ctx as any).dbUser;
  
  // Delay humano
  await ctx.sendChatAction('typing');
  await new Promise(resolve => setTimeout(resolve, 1800));
  
  ctx.reply(
    `🔍 *Buscar Productos*\n\n` +
    `Para buscar productos, simplemente dime qué estás buscando.\n\n` +
    `*Ejemplos:*\n` +
    `• "Busco filtros de agua"\n` +
    `• "Necesito un purificador"\n` +
    `• "¿Tienen suavizadores?"\n\n` +
    `¿Qué producto te interesa?`,
    { parse_mode: 'Markdown' }
  );
});

// Comando /destacados
bot.command('destacados', async (ctx) => {
  const user = (ctx as any).dbUser;
  
  await ctx.sendChatAction('typing');
  await new Promise(resolve => setTimeout(resolve, 1500));
  await ctx.reply('🔍 Déjame revisar los productos destacados...');
  
  try {
    await ctx.sendChatAction('typing');
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    const response = await aiService.chat(
      user.id,
      'Muéstrame los productos destacados'
    );
    
    // Delay antes de responder
    await ctx.sendChatAction('typing');
    await new Promise(resolve => setTimeout(resolve, 2500));
    
    await ctx.reply(response);
  } catch (error) {
    console.error('Error al obtener productos destacados:', error);
    
    await ctx.sendChatAction('typing');
    await new Promise(resolve => setTimeout(resolve, 1500));
    
    ctx.reply('Lo siento, hubo un error al buscar productos. Por favor intenta de nuevo.');
  }
});

// Comando /catalogo
bot.command('catalogo', async (ctx) => {
  await ctx.sendChatAction('typing');
  await new Promise(resolve => setTimeout(resolve, 2200));
  
  ctx.reply(
    `📚 *Catálogo Aquaequipos*\n\n` +
    `Tengo acceso a nuestro catálogo completo de productos.\n\n` +
    `Puedo ayudarte con:\n` +
    `• Especificaciones técnicas\n` +
    `• Capacidades y dimensiones\n` +
    `• Aplicaciones y usos\n` +
    `• Comparaciones entre productos\n` +
    `• Recomendaciones personalizadas\n\n` +
    `¿Sobre qué producto necesitas información?`,
    { parse_mode: 'Markdown' }
  );
});

// Alias para /help
bot.command('ayuda', (ctx) => ctx.reply('Usa /help para ver todos los comandos disponibles.'));

// Manejo de mensajes de texto (procesados con IA)
bot.on(message('text'), async (ctx) => {
  if (!ctx.from) return;
  
  // Ignorar comandos ya procesados
  if (ctx.message.text.startsWith('/')) return;
  
  const user = (ctx as any).dbUser;
  
  try {
    // Simular lectura del mensaje (1-2 segundos)
    await ctx.sendChatAction('typing');
    await new Promise(resolve => setTimeout(resolve, 1000 + Math.random() * 1000));
    
    // Procesar con IA
    const response = await aiService.chat(user.id, ctx.message.text);
    
    // Simular tiempo de escritura basado en longitud de respuesta
    // Aproximadamente 0.5 segundos por cada 50 caracteres (humano escribe ~40-80 CPM)
    const typingTime = Math.min(Math.max((response.length / 50) * 500, 2000), 8000);
    await ctx.sendChatAction('typing');
    await new Promise(resolve => setTimeout(resolve, typingTime));
    
    await ctx.reply(response, { parse_mode: 'Markdown' });
  } catch (error) {
    console.error('Error al procesar mensaje:', error);
    
    // Agregar delay también en errores
    await ctx.sendChatAction('typing');
    await new Promise(resolve => setTimeout(resolve, 1500));
    
    ctx.reply('Lo siento, hubo un error al procesar tu mensaje. Por favor intenta de nuevo.');
  }
});

// Manejo de fotos (para análisis de imágenes si el cliente envía algo)
bot.on(message('photo'), async (ctx) => {
  if (!ctx.from) return;
  
  const user = (ctx as any).dbUser;
  
  await ctx.reply(
    '📸 Recibí tu imagen. Por ahora no puedo procesarla directamente, ' +
    'pero puedes describir lo que necesitas y te ayudaré.'
  );
});

// Manejo de errores
bot.catch((err, ctx) => {
  console.error('❌ Error en el bot:', err);
  ctx.reply('Ocurrió un error inesperado. Por favor intenta de nuevo más tarde.');
});

// Iniciar bot
console.log('🚀 Lanzando bot...\n');

bot.launch()
  .then(() => {
    console.log('═'.repeat(70));
    console.log('🤖 ¡Bot iniciado correctamente!');
    console.log(`📱 Usuario: @${bot.botInfo?.username}`);
    console.log(`🆔 ID: ${bot.botInfo?.id}`);
    console.log(`🏢 Empresa: ${config.business.name}`);
    console.log('═'.repeat(70));
    console.log('\n✅ El bot está escuchando mensajes...\n');
    console.log('💡 Los clientes pueden escribir para:');
    console.log('   • Consultar productos');
    console.log('   • Recibir asesoría técnica');
    console.log('   • Verificar precios y stock');
    console.log('   • Obtener recomendaciones');
    console.log('\n⏹️  Presiona Ctrl+C para detener\n');
  })
  .catch((error) => {
    console.error('\n❌ Error al iniciar el bot:', error);
    process.exit(1);
  });

// Manejo de señales de terminación
process.once('SIGINT', () => {
  console.log('\n⏹️  Deteniendo bot...');
  bot.stop('SIGINT');
  process.exit(0);
});

process.once('SIGTERM', () => {
  bot.stop('SIGTERM');
  process.exit(0);
});
