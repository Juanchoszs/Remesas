import { SiigoApiError } from './api';

// Configuración de la API
const SIIGO_API_BASE_URL = process.env.SIIGO_BASE_URL || 'https://api.siigo.com/v1';

// Endpoints para cada tipo de documento
const DOCUMENT_TYPE_ENDPOINTS = {
  FC: process.env.COMPRAS_URL || `${SIIGO_API_BASE_URL}/document-types?type=FC`,
  ND: process.env.NOTAS_URL || `${SIIGO_API_BASE_URL}/document-types?type=ND`,
  DS: process.env.DESCUENTO_URL || `${SIIGO_API_BASE_URL}/document-types?type=DS`,
  RP: process.env.PAGOS_RP || `${SIIGO_API_BASE_URL}/document-types?type=RP`
} as const;

// Interfaz para el tipo de documento de Siigo
export interface DocumentTypeSiigo {
  id: number;
  code: string;
  name: string;
  description: string;
  type: string;
  active: boolean;
  cost_center: boolean;
  cost_center_mandatory: boolean;
  automatic_number: boolean;
  consecutive: number;
  decimals: boolean;
  consumption_tax: boolean;
  reteiva: boolean;
  reteica: boolean;
  document_support: boolean;
}

// Interfaz para la respuesta de la API
interface SiigoApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  status?: number;
}

// Función para obtener la URL correcta según el tipo de documento
function getDocumentTypeUrl(type: 'FC' | 'ND' | 'DS' | 'RP'): string {
  return DOCUMENT_TYPE_ENDPOINTS[type];
}

/**
 * Obtiene los tipos de documentos de Siigo según el tipo especificado
 */
export async function getDocumentTypes(
  token: string,
  type: 'FC' | 'ND' | 'DS' | 'RP',
  partnerId?: string
): Promise<SiigoApiResponse<DocumentTypeSiigo[]>> {
  try {
    if (!token) {
      throw new Error('Token de autenticación requerido');
    }

    const url = new URL(getDocumentTypeUrl(type));
    
    // Add partner ID if provided
    if (partnerId) {
      url.searchParams.append('partner_id', partnerId);
    }

    const response = await fetch(url.toString(), {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        ...(partnerId && { 'Partner-Id': partnerId })
      },
      next: { revalidate: 3600 } // Cache por 1 hora
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new SiigoApiError(
        errorData.message || 'Error al obtener los tipos de documento',
        response.status,
        errorData
      );
    }

    const data = await response.json();
    return { 
      success: true, 
      data: Array.isArray(data) ? data : [data] 
    };
    
  } catch (error) {
    console.error(`Error en getDocumentTypes (${type}):`, error);
    const errorMessage = error instanceof Error ? error.message : 'Error desconocido';
    const statusCode = (error instanceof SiigoApiError && error.code) ? Number(error.code) : 500;
    return {
      success: false,
      error: errorMessage,
      status: statusCode
    };
  }
}

/**
 * Obtiene todos los tipos de documentos disponibles en Siigo
 */
export async function getAllDocumentTypes(
  token: string,
  partnerId?: string
): Promise<SiigoApiResponse<DocumentTypeSiigo[]>> {
  try {
    if (!token) {
      throw new Error('Token de autenticación requerido');
    }
    
    // Obtener todos los tipos de documentos de forma paralela
    const documentTypes: DocumentTypeSiigo[] = [];
    const types = ['FC', 'ND', 'DS', 'RP'] as const;
    
    // Usar Promise.allSettled para manejar errores individuales
    const results = await Promise.allSettled(
      types.map(type => getDocumentTypes(token, type, partnerId))
    );
    
    // Procesar resultados
    for (const result of results) {
      if (result.status === 'fulfilled' && result.value.success && result.value.data) {
        documentTypes.push(...result.value.data);
      }
    }

    if (documentTypes.length === 0) {
      throw new Error('No se pudieron obtener los tipos de documento');
    }

    return {
      success: true,
      data: documentTypes
    };
  } catch (error) {
    console.error('Error en getAllDocumentTypes:', error);
    
    if (error instanceof SiigoApiError) {
      return {
        success: false,
        error: error.message,
        status: typeof error.code === 'number' ? error.code : 500
      };
    }
    
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Error desconocido al obtener los tipos de documento',
      status: 500
    };
  }
}