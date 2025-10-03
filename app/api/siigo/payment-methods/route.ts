import { NextResponse } from 'next/server';
import { obtenerTokenSiigo } from '@/lib/siigo/auth';

const SIIGO_BASE_URL = process.env.SIIGO_BASE_URL || 'https://api.siigo.com/v1';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const documentType = searchParams.get('document_type') || 'FV';
    
    const token = await obtenerTokenSiigo();
    
    // Construir la URL con el parámetro document_type
    const url = new URL(`${SIIGO_BASE_URL}/payment-types`);
    url.searchParams.append('document_type', documentType);
    
    const response = await fetch(url.toString(), {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        'Partner-Id': process.env.SIIGO_PARTNER_ID || 'RemesasApp'
      }
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Error al obtener métodos de pago: ${error}`);
    }

    const data = await response.json();
    return NextResponse.json({ success: true, data });
  } catch (error) {
    console.error('Error en /api/siigo/payment-methods:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Error desconocido' },
      { status: 500 }
    );
  }
}
