import axios from 'axios';
import crypto from 'crypto';
import { config } from '../config';

// Basic YCloud WhatsApp service wrapper. Adjust endpoints/headers if YCloud docs differ.
class YCloudService {
  private baseUrl = 'https://api.ycloud.com/v2';
  private apiKey = config.ycloud.apiKey;

  // Compute HMAC-SHA256 signature (hex) for a raw body
  public computeSignature(rawBody: Buffer): string {
    const secret = config.ycloud.webhookSecret;
    if (!secret) return '';
    return crypto.createHmac('sha256', secret).update(rawBody).digest('hex');
  }

  // Send a plain text message to WhatsApp via YCloud
  async sendTextMessage(to: string, body: string, from?: string) {
    if (!this.apiKey) {
      console.warn('YCLOUD_API_KEY no configurado, no se enviará respuesta');
      return;
    }

    const payload: any = {
      from: from, // YCloud expects 'from' explicitly
      to,
      type: 'text',
      text: { body },
    };

    try {
      const response = await axios.post(
        `${this.baseUrl}/whatsapp/messages`,
        payload,
        {
          headers: {
            'Content-Type': 'application/json',
            'X-API-Key': this.apiKey,
          },
        }
      );
      console.log('Envío a YCloud OK:', response.status, JSON.stringify(response.data));
      return response.data;
    } catch (error: any) {
      // Mejor logging para depuración: incluir body de respuesta si existe
      console.error('Error enviando mensaje con YCloud:', error.message);
      if (error.response) {
        const util = await import('util');
        console.error('YCloud response status:', error.response.status);
        console.error('YCloud response data:', util.inspect(error.response.data, { depth: null }));
      }
      throw error;
    }
  }

  // Send a template message using the configured template name/lang
  async sendTemplateMessage(to: string, templateName: string, language: string, parameters: any[] = [], from?: string) {
    if (!this.apiKey) {
      console.warn('YCLOUD_API_KEY no configurado, no se enviará template');
      return;
    }

    const payload: any = {
      from: from,
      to,
      type: 'template',
      template: {
        name: templateName,
        language: { code: language },
      },
    };

    if (parameters.length > 0) {
      payload.template.components = [
        { type: 'body', parameters: parameters }
      ];
    }

    try {
      const response = await axios.post(
        `${this.baseUrl}/whatsapp/messages`,
        payload,
        {
          headers: {
            'Content-Type': 'application/json',
            'X-API-Key': this.apiKey,
          },
        }
      );
      console.log('Envío template a YCloud OK:', response.status, JSON.stringify(response.data));
      return response.data;
    } catch (error: any) {
      console.error('Error enviando template con YCloud:', error.message);
      if (error.response) {
        const util = await import('util');
        console.error('YCloud response status:', error.response.status);
        console.error('YCloud response data:', util.inspect(error.response.data, { depth: null }));
      }
      throw error;
    }
  }

  // List available WhatsApp templates
  async listTemplates() {
    if (!this.apiKey) {
      console.warn('YCLOUD_API_KEY no configurado, no se pueden listar templates');
      return [];
    }

    try {
      const response = await axios.get(
        `${this.baseUrl}/whatsapp/templates`,
        {
          headers: {
            'X-API-Key': this.apiKey,
          },
        }
      );
      console.log('Templates listados:', response.data);
      return response.data.templates || [];
    } catch (error: any) {
      console.error('Error listando templates con YCloud:', error.message);
      if (error.response) {
        const util = await import('util');
        console.error('YCloud response status:', error.response.status);
        console.error('YCloud response data:', util.inspect(error.response.data, { depth: null }));
      }
      return [];
    }
  }

  // Check if a specific template exists
  async templateExists(templateName: string, language: string): Promise<boolean> {
    const templates = await this.listTemplates();
    return templates.some((t: any) => t.name === templateName && t.language.code === language && t.status === 'approved');
  }
}



export const ycloudService = new YCloudService();
