import { NextRequest, NextResponse } from 'next/server';
import { fetchSiigoWithAuth } from '@/lib/siigo/api-utils';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const params = Object.fromEntries(searchParams.entries());
  
  // Usar la URL de entorno si está definida, de lo contrario usar el endpoint por defecto
  const endpoint = process.env.PAGOS_RP || 'document-types';
  
  const result = await fetchSiigoWithAuth(endpoint, {
    ...(endpoint.includes('?') ? {} : { type: 'RP' }), // Solo agregar type si no está en la URL
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
    type: 'RP',
    description: 'Recibos de Pago'
  });
}

export const dynamic = 'force-dynamic';
export const revalidate = 0;
