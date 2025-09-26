import { NextResponse } from 'next/server';
import { obtenerTokenSiigo, SiigoAuthError } from '@/lib/siigo/auth';

const SIIGO_BASE_URL = process.env.SIIGO_BASE_URL || 'https://api.siigo.com/v1';
const PARTNER_ID = process.env.SIIGO_PARTNER_ID || 'RemesasYMensajes';

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const documentType = searchParams.get('type') || 'FC';
    const page = searchParams.get('page') || '1';
    const pageSize = searchParams.get('pageSize') || '50';
    const includeDependencies = searchParams.get('includeDependencies') === 'true';

    // 🔑 Obtener token con tolerancia a 429 (rate limit)
    let token: string;
    try {
      token = await obtenerTokenSiigo();
    } catch (e) {
      if (e instanceof SiigoAuthError) {
        const status = (e as any)?.details?.status;
        if (status === 429) {
          await sleep(1200);
          token = await obtenerTokenSiigo(true);
        } else {
          return NextResponse.json({ success: false, error: e.message, details: (e as any)?.details }, { status: status || 500 });
        }
      } else {
        return NextResponse.json({ success: false, error: 'Error de autenticación desconocido' }, { status: 500 });
      }
    }

    // 🔀 Mapear tipo de documento → endpoint
    let apiUrl: URL;
    switch (documentType) {
      case 'FC': // Facturas de compra
        apiUrl = new URL(`${SIIGO_BASE_URL}/purchases`);
        apiUrl.searchParams.append('document_type', 'FC');
        break;
      case 'ND': // Notas débito
        apiUrl = new URL(`${SIIGO_BASE_URL}/purchases`);
        apiUrl.searchParams.append('document_type', 'ND');
        break;
      case 'DS': // Documentos de soporte
        apiUrl = new URL(`${SIIGO_BASE_URL}/purchases`);
        apiUrl.searchParams.append('document_type', 'DS');
        break;
      case 'RP': // Recibos de pago
        apiUrl = new URL(`${SIIGO_BASE_URL}/payment-receipts`);
        // No se necesita parámetro type ya que el endpoint es específico para recibos de pago
        break;
      case 'FV': // Facturas de venta
        apiUrl = new URL(`${SIIGO_BASE_URL}/invoices`);
        break;
      case 'NC': // Notas crédito
        apiUrl = new URL(`${SIIGO_BASE_URL}/credit-notes`);
        break;
      case 'RC': // Recibos de caja
        apiUrl = new URL(`${SIIGO_BASE_URL}/cash-receipts`);
        break;
      case 'CC': // Comprobantes contables
        apiUrl = new URL(`${SIIGO_BASE_URL}/accounting-entries`);
        break;
      default:
        return NextResponse.json(
          { error: `Tipo de documento no soportado: ${documentType}` },
          { status: 400 }
        );
    }

    // Paginación
    apiUrl.searchParams.append('page', page);
    apiUrl.searchParams.append('page_size', pageSize);

    if (includeDependencies) {
      apiUrl.searchParams.append('include_dependencies', 'true');
    }

    console.log('➡️ Request a Siigo:', apiUrl.toString());

    // Llamada con reintentos ante 401/429
    const doFetch = async (bearer: string): Promise<Response> => {
      return fetch(apiUrl.toString(), {
        headers: {
          'Authorization': `Bearer ${bearer}`,
          'Content-Type': 'application/json',
          'Partner-Id': PARTNER_ID,
          'Accept': 'application/json'
        },
        cache: 'no-store'
      });
    };

    let response = await doFetch(token);
    if (response.status === 401) {
      // refrescar token y reintentar una vez
      token = await obtenerTokenSiigo(true);
      response = await doFetch(token);
    } else if (response.status === 429) {
      const retryAfter = Number(response.headers.get('retry-after') || 1);
      await sleep((retryAfter > 0 ? retryAfter : 1) * 1000);
      response = await doFetch(token);
    }

    if (!response.ok) {
      const errorText = await response.text().catch(() => 'Error desconocido');
      console.error('❌ Error Siigo:', response.status, errorText);
      return NextResponse.json(
        { success: false, error: errorText },
        { status: response.status }
      );
    }

    let responseData = await response.json();
    let documents = Array.isArray(responseData) ? responseData : responseData.results || [];
    
    // Calculate total for RP documents
    if (documentType === 'RP' && Array.isArray(documents)) {
      documents = documents.map(doc => {
        // Calcular la suma de TODOS los ítems sin importar si son débito o crédito
        const total = doc.items?.reduce((sum: number, item: any) => {
          // Sumar el valor absoluto de todos los ítems
          const value = Math.abs(Number(item.value) || 0);
          console.log(`Sumando ítem:`, { 
            value: item.value, 
            movement: item.account?.movement,
            parsed: value
          });
          return sum + value;
        }, 0) || 0;

        console.log(`Documento RP ${doc.number || doc.id} - Total calculado:`, total, 'Items:', doc.items?.length);
        
        return {
          ...doc,
          total: total
        };
      });
    }

    return NextResponse.json({
      success: true,
      data: documents,
      pagination: responseData.pagination || null,
      type: documentType,
      url: apiUrl.toString()
    });

  } catch (error) {
    console.error('🔥 Error en /api/siigo/documents:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}
