import OpenAI from 'openai';
import { config } from '../config';
import { ConversationRepository } from '../database/repositories/ConversationRepository';
import { wooCommerceService } from './WooCommerceService';
import * as fs from 'fs';
import * as path from 'path';

const openai = new OpenAI({
  apiKey: config.openai.apiKey,
});

export interface AIMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export class AIService {
  private catalogKnowledge: string = '';

  constructor() {
    this.loadCatalogKnowledge();
  }

  /**
   * Cargar conocimiento extraído de los PDFs
   */
  private loadCatalogKnowledge(): void {
    try {
      const knowledgeDir = path.join(process.cwd(), 'knowledge');
      
      if (!fs.existsSync(knowledgeDir)) {
        console.log('⚠️  No se encontró carpeta knowledge/. Ejecuta: npm run process-pdf');
        return;
      }

      const files = fs.readdirSync(knowledgeDir);
      const knowledgeFiles = files.filter(f => f.endsWith('_knowledge.txt'));

      if (knowledgeFiles.length === 0) {
        console.log('⚠️  No hay conocimiento extraído. Ejecuta: npm run process-pdf');
        return;
      }

      let allKnowledge = '';
      for (const file of knowledgeFiles) {
        const filePath = path.join(knowledgeDir, file);
        const content = fs.readFileSync(filePath, 'utf-8');
        allKnowledge += content + '\n\n';
      }

      this.catalogKnowledge = allKnowledge;
      console.log(`✅ Conocimiento de catálogo cargado (${knowledgeFiles.length} archivos)`);
    } catch (error) {
      console.error('Error cargando conocimiento del catálogo:', error);
    }
  }

  /**
   * Genera el prompt del sistema con el conocimiento del catálogo
   */
  private getSystemPrompt(): string {
    const now = new Date();
    const today = now.toLocaleDateString('es-GT', { 
      weekday: 'long', 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric',
      timeZone: config.business.timezone
    });

    let systemPrompt = `Eres un asistente virtual experto en ventas y asesoría técnica para ${config.business.name}.

Tu trabajo es:
1. **ENTENDER EL PROBLEMA del cliente** antes de recomendar productos
2. Asesorar sobre SOLUCIONES COMPLETAS de tratamiento de agua (no solo productos individuales)
3. Recomendar sistemas completos cuando sea necesario (ej: bomba + tanque + filtros + accesorios)
4. Explicar por qué recomiendas cada componente
5. Responder preguntas técnicas basándote en la documentación
6. Proporcionar información de productos, precios y disponibilidad
7. Guiar a los clientes en el proceso de compra

🎯 ENFOQUE DE ASESORÍA:
- Primero identifica el PROBLEMA o NECESIDAD real del cliente
- Piensa en la SOLUCIÓN COMPLETA (no solo un producto aislado)
- Considera: bombas, filtros, tanques, purificadores, suavizadores, accesorios, tuberías, etc.
- Explica cómo cada componente resuelve parte del problema
- Ofrece opciones (económica, estándar, premium) cuando sea apropiado

⏰ FECHA Y HORA ACTUAL:
- HOY es: ${today}
- Timezone: ${config.business.timezone}

🎯 DIRECTRICES DE CONVERSACIÓN:
- Sé amable, profesional y conversacional
- **MUY IMPORTANTE**: Haz UNA pregunta a la vez, NO bombardees al cliente con múltiples preguntas
- Avanza paso a paso en la conversación de forma natural
- Primero entiende la necesidad general, luego profundiza con preguntas específicas
- Usa un tono cercano y amigable, como un vendedor experto que asesora personalmente
- Recomienda productos específicos solo cuando tengas suficiente información
- Proporciona información técnica de forma clara y digerible
- Si no estás seguro de algo, sé honesto y ofrece consultar con un experto
- Intenta identificar si es un lead calificado (muestra interés real en comprar)

📝 ESTILO DE PREGUNTAS (ejemplos):
❌ MAL: "¿Para qué uso la necesitas? ¿Cuál es la altura? ¿Qué caudal requieres? ¿Cuántas personas?"
✅ BIEN: "¿Para qué tipo de aplicación necesitas la bomba?" (esperar respuesta, luego seguir)

💬 FLUJO DE CONVERSACIÓN IDEAL:
1. Saludo y pregunta inicial abierta
2. Escucha la respuesta
3. Haz UNA pregunta específica basada en lo que dijo
4. Continúa profundizando gradualmente
5. Identifica el PROBLEMA REAL (agua dura, presión baja, pozo profundo, agua turbia, etc.)
6. Recomienda SOLUCIÓN COMPLETA cuando tengas suficiente contexto
7. Explica cada componente y su función

💡 EJEMPLOS DE SOLUCIONES COMPLETAS:
- Cliente con agua dura → Suavizador + filtro de sedimentos + tanque de almacenamiento
- Cliente con pozo profundo → Bomba sumergible + tanque hidroneumático + control de presión
- Cliente con agua turbia → Sistema de filtración multicapa + purificador UV
- Cliente para riego → Bomba centrífuga + timer + válvulas de distribución

📚 FUNCIONES DISPONIBLES:
- searchProducts: Busca productos en la tienda WooCommerce
- getProductDetails: Obtiene información detallada de un producto
- checkStock: Verifica disponibilidad de un producto
- getFeaturedProducts: Muestra productos destacados
`;

    // Agregar conocimiento del catálogo si existe
    if (this.catalogKnowledge) {
      systemPrompt += `\n\n📖 CONOCIMIENTO DEL CATÁLOGO:\n\n`;
      systemPrompt += this.catalogKnowledge;
      systemPrompt += `\n\n`;
      systemPrompt += `IMPORTANTE: Usa este conocimiento del catálogo para responder preguntas técnicas sobre productos, especificaciones, capacidades, y aplicaciones. Esta información es la fuente de verdad para detalles técnicos.`;
    }

    return systemPrompt;
  }

  /**
   * Chat principal con el usuario
   */
  async chat(userId: number, message: string): Promise<string> {
    // Obtener historial de conversación
    const history = ConversationRepository.findByUserId(userId, 10);
    
    // Guardar mensaje del usuario
    ConversationRepository.create(userId, 'user', message);

    // Preparar mensajes para OpenAI
    const messages: AIMessage[] = [
      { role: 'system', content: this.getSystemPrompt() },
      ...history.map(h => ({
        role: h.role as 'user' | 'assistant' | 'system',
        content: h.content,
      })),
      { role: 'user', content: message },
    ];

    try {
      const response = await openai.chat.completions.create({
        model: 'gpt-4o',
        messages: messages as any,
        temperature: 0.7,
        max_tokens: 1500,
        functions: this.getFunctions(),
        function_call: 'auto',
      });

      const assistantMessage = response.choices[0].message;

      // Si la IA quiere llamar a una función
      if (assistantMessage.function_call) {
        const functionName = assistantMessage.function_call.name;
        const functionArgs = JSON.parse(assistantMessage.function_call.arguments);

        // Ejecutar la función correspondiente
        const functionResult = await this.executeFunction(functionName, functionArgs);

        // Llamar nuevamente a la IA con el resultado de la función
        messages.push(assistantMessage as any);
        messages.push({
          role: 'function' as any,
          name: functionName,
          content: JSON.stringify(functionResult),
        } as any);

        const finalResponse = await openai.chat.completions.create({
          model: 'gpt-4o',
          messages: messages as any,
          temperature: 0.7,
          max_tokens: 1500,
        });

        const finalMessage = finalResponse.choices[0].message.content || 'Lo siento, no pude procesar tu solicitud.';
        ConversationRepository.create(userId, 'assistant', finalMessage);
        return finalMessage;
      }

      // Respuesta normal sin función
      const reply = assistantMessage.content || 'Lo siento, no pude procesar tu solicitud.';
      ConversationRepository.create(userId, 'assistant', reply);
      return reply;

    } catch (error) {
      console.error('Error en AIService:', error);
      return 'Lo siento, hubo un error al procesar tu mensaje. Por favor intenta de nuevo.';
    }
  }

  /**
   * Definir funciones disponibles para la IA
   */
  private getFunctions() {
    return [
      {
        name: 'searchProducts',
        description: 'Busca productos en la tienda por nombre, categoría o características',
        parameters: {
          type: 'object',
          properties: {
            query: {
              type: 'string',
              description: 'Término de búsqueda (nombre del producto, categoría, etc.)',
            },
            limit: {
              type: 'number',
              description: 'Número máximo de resultados (default: 5)',
              default: 5,
            },
          },
          required: ['query'],
        },
      },
      {
        name: 'getProductDetails',
        description: 'Obtiene información detallada de un producto específico por su ID',
        parameters: {
          type: 'object',
          properties: {
            productId: {
              type: 'number',
              description: 'ID del producto en WooCommerce',
            },
          },
          required: ['productId'],
        },
      },
      {
        name: 'checkStock',
        description: 'Verifica la disponibilidad y stock de un producto',
        parameters: {
          type: 'object',
          properties: {
            productId: {
              type: 'number',
              description: 'ID del producto',
            },
          },
          required: ['productId'],
        },
      },
      {
        name: 'getFeaturedProducts',
        description: 'Obtiene la lista de productos destacados o más vendidos',
        parameters: {
          type: 'object',
          properties: {
            limit: {
              type: 'number',
              description: 'Número de productos a mostrar (default: 5)',
              default: 5,
            },
          },
        },
      },
    ];
  }

  /**
   * Ejecutar función llamada por la IA
   */
  private async executeFunction(name: string, args: any): Promise<any> {
    switch (name) {
      case 'searchProducts':
        return this.searchProducts(args.query, args.limit || 5);
      
      case 'getProductDetails':
        return this.getProductDetails(args.productId);
      
      case 'checkStock':
        return this.checkStock(args.productId);
      
      case 'getFeaturedProducts':
        return this.getFeaturedProducts(args.limit || 5);
      
      default:
        return { error: 'Función no encontrada' };
    }
  }

  /**
   * Buscar productos
   */
  private async searchProducts(query: string, limit: number): Promise<any> {
    try {
      const products = await wooCommerceService.searchProducts(query, limit);
      
      return {
        success: true,
        count: products.length,
        products: products.map(p => ({
          id: p.id,
          name: p.name,
          price: p.price,
          sku: p.sku,
          inStock: p.stock_status === 'instock',
          permalink: p.permalink,
        })),
      };
    } catch (error) {
      return { success: false, error: 'Error al buscar productos' };
    }
  }

  /**
   * Obtener detalles de un producto
   */
  private async getProductDetails(productId: number): Promise<any> {
    try {
      const product = await wooCommerceService.getProduct(productId);
      
      if (!product) {
        return { success: false, error: 'Producto no encontrado' };
      }

      return {
        success: true,
        product: {
          id: product.id,
          name: product.name,
          price: product.price,
          sku: product.sku,
          description: product.description?.replace(/<[^>]*>/g, ''),
          shortDescription: product.short_description?.replace(/<[^>]*>/g, ''),
          inStock: product.stock_status === 'instock',
          stockQuantity: product.stock_quantity,
          permalink: product.permalink,
          images: product.images?.map((img: any) => img.src),
        },
      };
    } catch (error) {
      return { success: false, error: 'Error al obtener detalles del producto' };
    }
  }

  /**
   * Verificar stock
   */
  private async checkStock(productId: number): Promise<any> {
    try {
      const stock = await wooCommerceService.checkStock(productId);
      
      return {
        success: true,
        productId,
        inStock: stock.inStock,
        quantity: stock.quantity,
        message: stock.inStock 
          ? `Producto disponible${stock.quantity ? ` (${stock.quantity} unidades)` : ''}`
          : 'Producto agotado',
      };
    } catch (error) {
      return { success: false, error: 'Error al verificar stock' };
    }
  }

  /**
   * Obtener productos destacados
   */
  private async getFeaturedProducts(limit: number): Promise<any> {
    try {
      const products = await wooCommerceService.getFeaturedProducts(limit);
      
      return {
        success: true,
        count: products.length,
        products: products.map(p => ({
          id: p.id,
          name: p.name,
          price: p.price,
          sku: p.sku,
          inStock: p.stock_status === 'instock',
          permalink: p.permalink,
        })),
      };
    } catch (error) {
      return { success: false, error: 'Error al obtener productos destacados' };
    }
  }
}

export const aiService = new AIService();
