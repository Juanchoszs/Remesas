import { NextRequest, NextResponse } from 'next/server';
import { fetchSiigoWithAuth } from '@/lib/siigo/api-utils';
import { withSiigoAuth } from '@/lib/siigo/api-utils';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const params = Object.fromEntries(searchParams.entries());

  const endpoint = process.env.COMPRAS_URL || 'purchases';

  const result = await fetchSiigoWithAuth(endpoint, {
    ...(endpoint.includes('?') ? {} : { document_type: 'FC' }),
    ...params
  });

  if (result.error) {
    return NextResponse.json(
      { success: false, error: result.error },
      { status: result.status || 500 }
    );
  }

  return NextResponse.json({
    success: true,
    data: result.data,
    type: 'FC',
    description: 'Facturas de Compra'
  });
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    // Endpoint para crear facturas de compra en Siigo
    const endpoint = process.env.SIIGO_PURCHASES_CREATE_URL || 'purchases';
    
    const result = await withSiigoAuth(async (token) => {
      const baseUrl = process.env.SIIGO_BASE_URL || 'https://api.siigo.com/v1';
      const url = `${baseUrl}/${endpoint}`;
      
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
          'Partner-Id': process.env.SIIGO_PARTNER_ID || 'RemesasApp'
        },
        body: JSON.stringify(body)
      });
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        return {
          error: errorData.message || 'Error al crear la factura de compra en Siigo',
          status: response.status,
          details: errorData
        };
      }
      
      return await response.json();
    });
    
    if (result.error) {
      return NextResponse.json(
        { success: false, error: result.error, details: result.details },
        { status: result.status || 500 }
      );
    }
    
    return NextResponse.json({
      success: true,
      data: result.data || result,
      message: 'Factura de compra creada exitosamente'
    });
  } catch (error) {
    console.error('Error al procesar la solicitud:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Error desconocido' },
      { status: 500 }
    );
  }
}

export const dynamic = 'force-dynamic';
export const revalidate = 0;
