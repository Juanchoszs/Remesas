import { NextResponse } from 'next/server';
import { obtenerTokenSiigo } from '@/lib/siigo/auth';

const SIIGO_BASE_URL = process.env.SIIGO_BASE_URL || 'https://api.siigo.com/v1';

export async function GET() {
  try {
    const token = await obtenerTokenSiigo();
    
    const response = await fetch(`${SIIGO_BASE_URL}/taxes`, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        'Partner-Id': process.env.SIIGO_PARTNER_ID || 'RemesasApp'
      }
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Error al obtener impuestos : ${error}`);
    }

    const data = await response.json();
    return NextResponse.json({ success: true, data });
  } catch (error) {
    console.error('Error en /api/siigo/taxes:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Error desconocido' },
      { status: 500 }
    );
  }
}
