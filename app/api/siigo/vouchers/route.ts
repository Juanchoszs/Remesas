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

export async function POST(request: Request) {
  try {
    if (!SIIGO_PARTNER_ID) {
      return NextResponse.json(
        { error: 'Configuración incompleta', details: 'Falta SIIGO_PARTNER_ID' },
        { status: 500 }
      );
    }

    const token = await getSiigoToken();
    const body = await request.json();

    // Validación mínima basada en documentación Siigo para RC (DebtPayment / AdvancePayment / Detailed)
    if (!body?.date || typeof body.date !== 'string') {
      return NextResponse.json({ error: 'date requerido (YYYY-MM-DD)' }, { status: 400 });
    }
    if (!body?.document?.id) {
      return NextResponse.json({ error: 'document.id requerido (ID del comprobante RC)' }, { status: 400 });
    }
    if (!body?.type || !['DebtPayment','AdvancePayment','Detailed'].includes(body.type)) {
      return NextResponse.json({ error: "type requerido ('DebtPayment' | 'AdvancePayment' | 'Detailed')" }, { status: 400 });
    }
    if (!body?.customer?.identification) {
      return NextResponse.json({ error: 'customer.identification requerido' }, { status: 400 });
    }
    if (body.type === 'DebtPayment') {
      if (!Array.isArray(body?.items) || body.items.length === 0) {
        return NextResponse.json({ error: 'items[] requerido (mínimo 1) para DebtPayment' }, { status: 400 });
      }
    }
    if (!body?.payment?.id || !body?.payment?.value) {
      return NextResponse.json({ error: 'payment.id y payment.value requeridos' }, { status: 400 });
    }

    const url = `${SIIGO_BASE}/vouchers`;
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        'Partner-Id': SIIGO_PARTNER_ID,
      },
      body: JSON.stringify(body),
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      return NextResponse.json(
        { error: 'Error al crear el recibo de caja', details: data },
        { status: response.status }
      );
    }

    return NextResponse.json(data, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      {
        error: 'Error inesperado al crear el recibo de caja',
        details: error instanceof Error ? error.message : 'Error desconocido',
      },
      { status: 500 }
    );
  }
}