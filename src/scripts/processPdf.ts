import OpenAI from 'openai';
import * as fs from 'fs';
import * as path from 'path';
import { config } from '../config';

/**
 * Script para procesar PDFs con imágenes y extraer conocimiento usando GPT-4o Vision
 * 
 * Este script:
 * 1. Lee todos los PDFs de la carpeta pdfs/
 * 2. Convierte cada página en imagen
 * 3. Usa GPT-4o Vision para extraer toda la información
 * 4. Guarda el conocimiento extraído en knowledge/
 */

const openai = new OpenAI({
  apiKey: config.openai.apiKey,
});

const PDF_DIR = path.join(process.cwd(), 'pdfs');
const KNOWLEDGE_DIR = path.join(process.cwd(), 'knowledge');

// Crear directorio de conocimiento si no existe
if (!fs.existsSync(KNOWLEDGE_DIR)) {
  fs.mkdirSync(KNOWLEDGE_DIR, { recursive: true });
}

/**
 * Analiza una imagen con GPT-4o Vision
 */
async function analyzeImageWithVision(imageBase64: string, prompt: string): Promise<string> {
  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        {
          role: 'user',
          content: [
            { type: 'text', text: prompt },
            {
              type: 'image_url',
              image_url: {
                url: `data:image/png;base64,${imageBase64}`,
              },
            },
          ],
        } as any,
      ],
      max_tokens: 4000,
    });

    return response.choices[0].message.content || 'No se pudo extraer información.';
  } catch (error: any) {
    console.error('Error analizando imagen con Vision:', error.message);
    throw error;
  }
}

/**
 * Extrae el texto completo del PDF (sin imágenes)
 * Usaremos este texto como base y le pediremos a GPT que lo estructure
 */
async function extractTextFromPdf(pdfPath: string): Promise<string> {
  try {
    const pdf = require('pdf-parse');
    const dataBuffer = fs.readFileSync(pdfPath);
    const pdfData = await pdf(dataBuffer);
    
    console.log(`📄 PDF tiene ${pdfData.numpages} páginas`);
    console.log(`📝 Texto extraído: ${pdfData.text.length} caracteres`);
    
    return pdfData.text;
  } catch (error: any) {
    console.error('Error extrayendo texto del PDF:', error.message);
    throw error;
  }
}

/**
 * Divide el texto en chunks más pequeños para evitar límites de tokens
 */
function splitTextIntoChunks(text: string, maxChunkSize: number = 10000): string[] {
  const chunks: string[] = [];
  let currentChunk = '';

  // Dividir por párrafos primero
  const paragraphs = text.split('\n\n');

  for (const paragraph of paragraphs) {
    if ((currentChunk + paragraph).length > maxChunkSize && currentChunk.length > 0) {
      chunks.push(currentChunk.trim());
      currentChunk = paragraph;
    } else {
      currentChunk += (currentChunk ? '\n\n' : '') + paragraph;
    }
  }

  if (currentChunk.trim()) {
    chunks.push(currentChunk.trim());
  }

  return chunks;
}

/**
 * Procesa un PDF completo
 */
async function processPdf(pdfPath: string): Promise<void> {
  const pdfName = path.basename(pdfPath, '.pdf');
  console.log(`\n📚 Procesando: ${pdfName}`);
  console.log('='.repeat(70));

  try {
    // Paso 1: Extraer texto del PDF
    console.log('\n📝 Paso 1: Extrayendo texto del PDF...');
    const pdfText = await extractTextFromPdf(pdfPath);
    console.log(`✅ Texto extraído`);

    // Paso 2: Procesar el texto con GPT-4o para estructurarlo
    console.log('\n🤖 Paso 2: Procesando y estructurando contenido con GPT-4o...');
    
    // Dividir el texto en chunks si es muy largo
    const chunks = splitTextIntoChunks(pdfText);
    console.log(`   Dividiendo en ${chunks.length} chunks para procesamiento...`);

    let structuredKnowledge = '';

    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];
      console.log(`   Procesando chunk ${i + 1}/${chunks.length} (${chunk.length} caracteres)...`);
      
      const prompt = `
Eres un experto en análisis de documentación técnica de productos de tratamiento de agua.

A continuación te proporciono parte del texto extraído de un catálogo PDF.
El texto puede estar desordenado debido a la extracción automática.

Tu tarea es:
1. Analizar y estructurar la información de este fragmento
2. Identificar productos, modelos y especificaciones
3. Organizar la información de forma clara y lógica
4. Crear una base de conocimiento estructurada para este fragmento

El texto del fragmento ${i + 1}/${chunks.length} es:

${chunk}

Por favor, organiza esta información en formato estructurado, agrupando por productos y sus características.
`;

      const response = await openai.chat.completions.create({
        model: 'gpt-4o',
        messages: [
          {
            role: 'user',
            content: prompt,
          },
        ],
        max_tokens: 8000,
        temperature: 0.3,
      });

      const chunkKnowledge = response.choices[0].message.content || `No se pudo procesar el chunk ${i + 1}.`;
      structuredKnowledge += `\n\n--- Chunk ${i + 1} ---\n\n${chunkKnowledge}`;
      
      // Pequeña pausa para evitar rate limits
      if (i < chunks.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }

    let fullKnowledge = `# Conocimiento Extraído de ${pdfName}\n\n`;
    fullKnowledge += `Fecha de procesamiento: ${new Date().toISOString()}\n\n`;
    fullKnowledge += '---\n\n';
    fullKnowledge += structuredKnowledge;
    fullKnowledge += '\n\n---\n\n';

    // Paso 3: Guardar conocimiento extraído
    console.log('\n💾 Paso 3: Guardando conocimiento extraído...');
    const knowledgePath = path.join(KNOWLEDGE_DIR, `${pdfName}_knowledge.txt`);
    fs.writeFileSync(knowledgePath, fullKnowledge, 'utf-8');
    console.log(`✅ Guardado en: ${knowledgePath}`);

    console.log('\n' + '='.repeat(70));
    console.log(`✅ Procesamiento de ${pdfName} completado exitosamente!`);
    console.log('='.repeat(70));

  } catch (error: any) {
    console.error(`\n❌ Error procesando ${pdfName}:`, error.message);
    throw error;
  }
}

/**
 * Función principal
 */
async function main() {
  console.log('\n🚀 Iniciando procesamiento de PDFs con GPT-4o Vision');
  console.log('='.repeat(70));

  // Verificar que existe el directorio de PDFs
  if (!fs.existsSync(PDF_DIR)) {
    console.error(`\n❌ Error: No existe el directorio ${PDF_DIR}`);
    process.exit(1);
  }

  // Obtener lista de PDFs
  const files = fs.readdirSync(PDF_DIR);
  const pdfFiles = files.filter(f => f.toLowerCase().endsWith('.pdf'));

  if (pdfFiles.length === 0) {
    console.error('\n❌ No se encontraron archivos PDF en la carpeta pdfs/');
    process.exit(1);
  }

  console.log(`\n📋 Se encontraron ${pdfFiles.length} archivos PDF:`);
  pdfFiles.forEach((file, index) => {
    console.log(`   ${index + 1}. ${file}`);
  });

  // Procesar cada PDF
  for (const pdfFile of pdfFiles) {
    const pdfPath = path.join(PDF_DIR, pdfFile);
    await processPdf(pdfPath);
  }

  console.log('\n' + '='.repeat(70));
  console.log('🎉 ¡Todos los PDFs han sido procesados exitosamente!');
  console.log('='.repeat(70));
  console.log('\nEl conocimiento extraído está disponible en la carpeta knowledge/');
  console.log('Ahora puedes iniciar el bot con: npm run dev\n');
}

// Ejecutar
main().catch((error) => {
  console.error('\n❌ Error fatal:', error);
  process.exit(1);
});
