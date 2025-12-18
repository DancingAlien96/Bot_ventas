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

  /**
   * Buscar productos por nombre o SKU
   */
  async searchProducts(query: string, limit: number = 10): Promise<any[]> {
    try {
      const response = await this.api.get('products', {
        search: query,
        per_page: limit,
        status: 'publish',
      });

      return response.data;
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

    // Link
    if (product.permalink) {
      info += `\n🔗 Ver más: ${product.permalink}`;
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
