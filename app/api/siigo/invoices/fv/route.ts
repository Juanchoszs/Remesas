import { NextRequest, NextResponse } from 'next/server';
import { fetchSiigoWithAuth } from '@/lib/siigo/api-utils';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const params = Object.fromEntries(searchParams.entries());

  // El endpoint de la API de Siigo para facturas de venta
  const endpoint = 'invoices';

  try {
    // Obtener las facturas de venta de Siigo
    const result = await fetchSiigoWithAuth(endpoint, {
      document_type: 'FV', // FV = Factura de Venta
      ...params
    });

    if (result.error) {
      console.error('Error al obtener facturas de venta:', result.error);
      return NextResponse.json(
        { success: false, error: result.error },
        { status: result.status || 500 }
      );
    }

    return NextResponse.json({
      success: true,
      data: result.data,
      type: 'FV',
      description: 'Facturas de Venta'
    });
  } catch (error) {
    console.error('Error en el servidor al obtener facturas de venta:', error);
    return NextResponse.json(
      { success: false, error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    // Validar que el cuerpo de la solicitud tenga los datos necesarios
    if (!body) {
      return NextResponse.json(
        { success: false, error: 'No se proporcionaron datos en la solicitud' },
        { status: 400 }
      );
    }

    // El endpoint de la API de Siigo para crear facturas de venta
    const endpoint = 'invoices';
    
    // Enviar la factura a Siigo
    const result = await fetchSiigoWithAuth(endpoint, {
      method: 'POST',
      body: JSON.stringify(body)
    });

    if (result.error) {
      console.error('Error al crear factura de venta:', result.error);
      return NextResponse.json(
        { 
          success: false, 
          error: result.error,
          details: result.data // Incluir detalles adicionales del error si están disponibles
        },
        { status: result.status || 500 }
      );
    }

    return NextResponse.json({
      success: true,
      data: result.data,
      message: 'Factura de venta creada exitosamente'
    });
  } catch (error) {
    console.error('Error en el servidor al crear factura de venta:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: 'Error interno del servidor',
        details: error instanceof Error ? error.message : 'Error desconocido'
      },
      { status: 500 }
    );
  }
}

export const dynamic = 'force-dynamic';
export const revalidate = 0;
