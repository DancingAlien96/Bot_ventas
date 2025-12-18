# 🤖 Bot de Asesoría y Ventas - Aquaequipos

Bot inteligente de Telegram para asesoría técnica y ventas, con integración a WooCommerce y conocimiento de catálogos en PDF.

## 🚀 Características

- ✅ **IA Conversacional**: GPT-4o con capacidad de leer imágenes y gráficas
- 🛒 **Integración WooCommerce**: Consulta productos, precios, stock en tiempo real
- 📄 **Lectura de PDFs**: Extrae información de catálogos con imágenes y gráficas
- 💬 **Asesoría Técnica**: Responde preguntas sobre productos basándose en documentación
- 💾 **Base de datos**: Guarda conversaciones y leads
- 🔄 **Sistema escalable**: Fácil agregar más PDFs en el futuro

## 📋 Requisitos

- Node.js 18+
- Token de Bot de Telegram
- API Key de OpenAI
- Credenciales de WooCommerce

## 🛠️ Instalación

1. **Instalar dependencias**:

```bash
npm install
```

2. **Configurar `.env`** (ya está configurado)

3. **Procesar PDFs** (extraer conocimiento):

```bash
npm run process-pdf
```

4. **Inicializar base de datos**:

```bash
npm run init-db
```

## 🎯 Uso

### Modo Desarrollo

```bash
npm run dev
```

### Producción

```bash
npm run build
npm start
```

## 📁 Estructura del Proyecto

```text
aquaequipos-bot/
├── src/
│   ├── bot.ts                    # Bot principal
│   ├── config/
│   │   └── index.ts              # Configuración
│   ├── services/
│   │   ├── AIService.ts          # Servicio de IA
│   │   └── WooCommerceService.ts # Integración WooCommerce
│   ├── database/
│   │   ├── index.ts              # Base de datos
│   │   └── repositories/         # Repositorios
│   └── scripts/
│       ├── processPdf.ts         # Procesar PDFs con Vision
│       └── initDb.ts             # Inicializar DB
├── pdfs/                         # Catálogos en PDF
├── knowledge/                    # Conocimiento extraído (auto-generado)
└── data/                         # Base de datos SQLite
```

## 🔄 Agregar Nuevos PDFs

1. Coloca el PDF en la carpeta `pdfs/`
1. Ejecuta: `npm run process-pdf`
1. El sistema extraerá automáticamente la información

## 📱 Comandos del Bot

- `/start` - Iniciar el bot
- `/productos` - Buscar productos en la tienda
- `/catalogo` - Ver información del catálogo
- `/ayuda` - Ver ayuda

---

**Desarrollado para Aquaequipos** 💧
