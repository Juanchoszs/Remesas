import { NextRequest, NextResponse } from 'next/server';
import { fetchSiigoWithAuth } from '@/lib/siigo/api-utils';

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

export const dynamic = 'force-dynamic';
export const revalidate = 0;
