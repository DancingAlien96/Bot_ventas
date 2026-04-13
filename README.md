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

## 🐳 Docker (contenedorización)

> **Nota:** Por defecto el bot usa *long polling* de Telegram y **no** expone puertos. No publicar puertos innecesarios a menos que vayas a usar webhooks.

### Archivos añadidos
- `Dockerfile` - Build multi-stage (compila TypeScript y ejecuta `dist/bot.js`).
- `docker-compose.yml` - Servicio `bot` con `env_file` y volumen `./data:/app/data` para la base de datos.
- `.dockerignore` - Ignora `node_modules`, `dist`, `.env`, etc.

### Uso
1. Construir y levantar (modo producción):

```bash
docker-compose up -d --build
```

2. Ver logs:

```bash
docker-compose logs -f
```

3. Inicializar la base de datos (ejecuta el script compilado en `dist`):

```bash
docker-compose run --rm bot node dist/scripts/initDb.js
```

4. Si necesitas exponer un puerto (por ejemplo, para webhooks), **edita** `docker-compose.yml` y agrega:

```yaml
ports:
  - "<PUERTO_HOST>:<PUERTO_CONTENEDOR>"
```

> ⚠️ Ten cuidado al exponer puertos: el proyecto no necesita puertos abiertos para funcionar como bot por defecto.

---

**Desarrollado para Aquaequipos** 💧
