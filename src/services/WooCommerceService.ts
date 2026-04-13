import WooCommerceRestApi from '@woocommerce/woocommerce-rest-api';
import { config } from '../config';

export class WooCommerceService {
  private api: WooCommerceRestApi;

  constructor() {
    this.api = new WooCommerceRestApi({
      url: config.woocommerce.url,
      consumerKey: config.woocommerce.consumerKey,
      consumerSecret: config.woocommerce.consumerSecret,
      version: 'wc/v3',
    });
  }

  private normalizeText(value: string): string {
    return value
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '');
  }

  private tokenize(value: string): string[] {
    const normalized = this.normalizeText(value);
    return normalized
      .split(/[^a-z0-9]+/)
      .map(t => t.trim())
      .filter(t => t.length >= 3);
  }

  private detectUseCase(query: string): 'pozo' | 'cisterna' | 'presion' | 'riego' | null {
    const q = this.normalizeText(query);

    if (q.includes('pozo') || q.includes('sumergible') || q.includes('profundo')) return 'pozo';
    if (q.includes('cisterna') || q.includes('tinaco')) return 'cisterna';
    if (q.includes('presion') || q.includes('presur') || q.includes('hidroneumatic')) return 'presion';
    if (q.includes('riego') || q.includes('aspersor') || q.includes('jardin')) return 'riego';

    return null;
  }

  private getUseCaseKeywords(useCase: 'pozo' | 'cisterna' | 'presion' | 'riego'): string[] {
    switch (useCase) {
      case 'pozo':
        return ['pozo', 'sumergible', 'profundo', '4xrm', 'xqs', 'franklin', 'aquax'];
      case 'cisterna':
        return ['cisterna', 'tinaco', 'trasvase', 'llenado', 'sumergible'];
      case 'presion':
        return ['presurizador', 'presion', 'hidroneumatico', 'booster', 'periferica'];
      case 'riego':
        return ['riego', 'aspersor', 'caudal', 'centrifuga', 'gasolina'];
      default:
        return [];
    }
  }

  private scoreProduct(product: any, query: string, useCase: 'pozo' | 'cisterna' | 'presion' | 'riego' | null): number {
    const name = this.normalizeText(product?.name || '');
    const shortDesc = this.normalizeText((product?.short_description || '').replace(/<[^>]*>/g, ' '));
    const categories = Array.isArray(product?.categories)
      ? this.normalizeText(product.categories.map((c: any) => c?.name || '').join(' '))
      : '';
    const haystack = `${name} ${shortDesc} ${categories}`;

    let score = 0;

    for (const token of this.tokenize(query)) {
      if (name.includes(token)) score += 4;
      else if (categories.includes(token)) score += 3;
      else if (shortDesc.includes(token)) score += 2;
    }

    if (useCase) {
      const keywords = this.getUseCaseKeywords(useCase);
      for (const kw of keywords) {
        if (name.includes(kw)) score += 5;
        else if (categories.includes(kw)) score += 4;
        else if (shortDesc.includes(kw)) score += 3;
      }
    }

    return score;
  }

  /**
   * Normalizar un permalink para que use el dominio público (con `www.`)
   */
  public normalizePermalink(permalink: string): string {
    try {
      const target = new URL(permalink);
      // Preferir un dominio público explícito si está configurado
      const publicSite = config.publicSite && config.publicSite.length > 0 ? config.publicSite : config.woocommerce.url;
      const publicUrl = new URL(publicSite);

      // Asegurar que el host use 'www.' como prefijo si no se indicó otro
      let host = publicUrl.host;
      if (!host.startsWith('www.')) {
        host = `www.${host}`;
      }

      target.host = host;
      target.protocol = publicUrl.protocol;

      // Ajuste de ruta: WooCommerce puede devolver '/product/...' pero el sitio público usa '/producto/...'
      try {
        target.pathname = target.pathname.replace(/\/product(\/|$)/, '/producto$1');
      } catch (e) {
        // ignore
      }

      return target.toString();
    } catch (e) {
      return permalink;
    }
  }

  /**
   * Buscar productos por nombre o SKU
   */
  async searchProducts(query: string, limit: number = 10): Promise<any[]> {
    try {
      const useCase = this.detectUseCase(query);
      const perPage = Math.max(limit * 4, 20);

      const expandedQueries = [query];
      if (useCase === 'pozo') {
        expandedQueries.push('bomba pozo', 'bomba sumergible pozo', 'pozo profundo');
      } else if (useCase === 'cisterna') {
        expandedQueries.push('bomba cisterna', 'bomba para tinaco', 'bomba sumergible cisterna');
      } else if (useCase === 'presion') {
        expandedQueries.push('presurizador', 'bomba de presion', 'hidroneumatico');
      } else if (useCase === 'riego') {
        expandedQueries.push('bomba riego', 'bomba aspersor', 'bomba centrifuga riego');
      }

      const responses = await Promise.all(
        expandedQueries.map(q =>
          this.api.get('products', {
            search: q,
            per_page: perPage,
            status: 'publish',
          })
        )
      );

      const byId = new Map<number, any>();
      for (const response of responses) {
        for (const p of response.data || []) {
          if (!byId.has(p.id)) byId.set(p.id, p);
        }
      }

      const ranked = Array.from(byId.values())
        .map(p => ({
          product: p,
          score: this.scoreProduct(p, query, useCase),
        }))
        .sort((a, b) => b.score - a.score)
        .map(item => item.product);

      return ranked.slice(0, limit);
    } catch (error: any) {
      console.error('Error buscando productos en WooCommerce:', error.message);
      return [];
    }
  }

  /**
   * Obtener detalles de un producto por ID
   */
  async getProduct(productId: number): Promise<any | null> {
    try {
      const response = await this.api.get(`products/${productId}`);
      return response.data;
    } catch (error: any) {
      console.error('Error obteniendo producto:', error.message);
      return null;
    }
  }

  /**
   * Obtener productos por categoría
   */
  async getProductsByCategory(categoryId: number, limit: number = 20): Promise<any[]> {
    try {
      const response = await this.api.get('products', {
        category: categoryId,
        per_page: limit,
        status: 'publish',
      });

      return response.data;
    } catch (error: any) {
      console.error('Error obteniendo productos por categoría:', error.message);
      return [];
    }
  }

  /**
   * Obtener todas las categorías
   */
  async getCategories(): Promise<any[]> {
    try {
      const response = await this.api.get('products/categories', {
        per_page: 100,
      });

      return response.data;
    } catch (error: any) {
      console.error('Error obteniendo categorías:', error.message);
      return [];
    }
  }

  /**
   * Verificar stock de un producto
   */
  async checkStock(productId: number): Promise<{ inStock: boolean; quantity: number | null }> {
    try {
      const product = await this.getProduct(productId);
      
      if (!product) {
        return { inStock: false, quantity: null };
      }

      return {
        inStock: product.stock_status === 'instock',
        quantity: product.manage_stock ? product.stock_quantity : null,
      };
    } catch (error) {
      console.error('Error verificando stock:', error);
      return { inStock: false, quantity: null };
    }
  }

  /**
   * Formatear información de producto para el bot
   */
  formatProductInfo(product: any): string {
    let info = `📦 *${product.name}*\n\n`;
    
    if (product.sku) {
      info += `🔖 SKU: ${product.sku}\n`;
    }

    // Precio
    if (product.price) {
      info += `💰 Precio: Q${product.price}\n`;
    }

    // Stock
    if (product.stock_status === 'instock') {
      info += `✅ En stock`;
      if (product.manage_stock && product.stock_quantity) {
        info += ` (${product.stock_quantity} unidades)`;
      }
      info += '\n';
    } else {
      info += `❌ Agotado\n`;
    }

    // Descripción corta
    if (product.short_description) {
      const plainDesc = product.short_description.replace(/<[^>]*>/g, '');
      info += `\n${plainDesc}\n`;
    }

    // Link (usar dominio público preferido y mostrar CTA)
    if (product.permalink) {
      const normalized = this.normalizePermalink(product.permalink);
      info += `\n\n🔗 Ver detalle y comprar: ${normalized}`;
      info += `\n➡️ Tip: Responde si quieres que te ayude con la instalación o envío.`;
    }

    return info;
  }

  /**
   * Obtener productos más vendidos o destacados
   */
  async getFeaturedProducts(limit: number = 10): Promise<any[]> {
    try {
      const response = await this.api.get('products', {
        featured: true,
        per_page: limit,
        status: 'publish',
      });

      return response.data;
    } catch (error: any) {
      console.error('Error obteniendo productos destacados:', error.message);
      return [];
    }
  }
}

export const wooCommerceService = new WooCommerceService();
