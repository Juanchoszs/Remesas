import { NextRequest, NextResponse } from 'next/server';
import { fetchSiigoWithAuth } from '@/lib/siigo/api-utils';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const params = Object.fromEntries(searchParams.entries());

  // Si no hay en .env, usamos directamente el endpoint completo
  const endpoint = process.env.DOCUMENT_TYPES_URL ?? 'https://api.siigo.com/v1/document-types';

  const result = await fetchSiigoWithAuth(endpoint, params);

  if (result.error) {
    return NextResponse.json(
      { success: false, error: result.error },
      { status: result.status || 500 }
    );
  }

  return NextResponse.json({
    success: true,
    data: result.data,
    description: 'Listado de tipos de documentos disponibles en Siigo'
  });
}

export const dynamic = 'force-dynamic';
export const revalidate = 0;
