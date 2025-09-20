import { NextResponse } from 'next/server';
import { getSiigoToken } from '../obtener-token/route';

const SIIGO_BASE = (process.env.SIIGO_BASE_URL || 'https://api.siigo.com/v1').replace(/\/$/, '');
const SIIGO_PARTNER_ID = process.env.SIIGO_PARTNER_ID;
const PAGE_SIZE = 100; // Tamaño fijo de página

interface Voucher {
  id?: string;
  number?: string;
  date?: string;
  // Agrega más campos según la documentación de Siigo
  [key: string]: any;
}

interface SiigoPagination {
  numberPage?: number;
  pageSize?: number;
  totalResults?: number;
}

interface SiigoVoucherResponse {
  results?: Voucher[];
  pagination?: SiigoPagination;
  [key: string]: any;
}

export async function GET(request: Request) {
  try {
    // Validar configuración
    if (!SIIGO_PARTNER_ID) {
      console.error('Error: SIIGO_PARTNER_ID no está configurado en las variables de entorno');
      return NextResponse.json(
        { 
          error: 'Configuración incompleta',
          details: 'El ID del partner no está configurado en el servidor.'
        },
        { status: 500 }
      );
    }

    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '0', 10); // Siigo usa 0-based

    // Obtener el token de autenticación
    const token = await getSiigoToken();

    // Construir la URL con parámetros de paginación
    const url = new URL(`${SIIGO_BASE}/vouchers`);
    url.searchParams.append('numberPage', page.toString());
    url.searchParams.append('pageSize', PAGE_SIZE.toString());
    url.searchParams.append('document_type', 'RC'); // Solo recibos de caja

    console.log('Realizando petición a:', url.toString());

    // Llamada a la API
    const response = await fetch(url.toString(), {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        'Partner-Id': SIIGO_PARTNER_ID, // partner_id en el header
      },
      cache: 'no-store',
    });

    if (!response.ok) {
      let errorData;
      try {
        errorData = await response.json();
      } catch {
        errorData = { error: 'No se pudo parsear la respuesta de error' };
      }

      console.error('Error al obtener los recibos de caja:', {
        url: url.toString(),
        status: response.status,
        statusText: response.statusText,
        errorData,
        headers: Object.fromEntries(response.headers.entries())
      });

      return NextResponse.json(
        { 
          error: 'Error al obtener los recibos de caja',
          details: errorData,
        },
        { status: response.status }
      );
    }

    let data: SiigoVoucherResponse;
    try {
      data = await response.json();
    } catch (e) {
      console.error('Error al parsear la respuesta JSON:', e);
      throw new Error('Error al procesar la respuesta del servidor');
    }

    const vouchers = data.results || [];
    const pagination = data.pagination || {};

    return NextResponse.json({
      success: true,
      vouchers,
      pagination: {
        currentPage: page,
        pageSize: PAGE_SIZE,
        totalResults: pagination.totalResults || 0,
        totalPages: Math.ceil((pagination.totalResults || 0) / PAGE_SIZE),
      },
    });

  } catch (error) {
    console.error('Error inesperado al obtener los recibos de caja:', error);
    return NextResponse.json(
      { 
        error: 'Error inesperado al procesar la solicitud',
        details: error instanceof Error ? error.message : 'Error desconocido',
      },
      { status: 500 }
    );
  }
}
