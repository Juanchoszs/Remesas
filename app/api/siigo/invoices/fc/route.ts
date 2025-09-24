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
    
    console.log('Enviando factura a Siigo:', JSON.stringify(body, null, 2));
    
    const result = await withSiigoAuth(async (token) => {
      const baseUrl = process.env.SIIGO_BASE_URL || 'https://api.siigo.com/v1';
      const url = `${baseUrl}/${endpoint}`;
      
      console.log('URL de la API de Siigo:', url);
      
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
          'Partner-Id': process.env.SIIGO_PARTNER_ID || 'RemesasApp'
        },
        body: JSON.stringify(body)
      });
      
      const responseText = await response.text();
      let responseData;
      
      try {
        responseData = responseText ? JSON.parse(responseText) : {};
      } catch (e) {
        console.error('Error al parsear la respuesta de Siigo:', e);
        responseData = { rawResponse: responseText };
      }
      
      console.log('Respuesta de Siigo:', {
        status: response.status,
        statusText: response.statusText,
        data: responseData
      });
      
      if (!response.ok) {
        console.error('Error en la API de Siigo:', response.status, responseData);
        return {
          error: responseData.message || `Error al crear la factura en Siigo (${response.status})`,
          status: response.status,
          details: responseData,
          data: null
        };
      }
      
      // Verificar que la respuesta contenga datos válidos
      if (!responseData || (typeof responseData === 'object' && Object.keys(responseData).length === 0)) {
        console.error('Respuesta vacía o inválida de Siigo');
        return {
          error: 'La respuesta de Siigo está vacía o es inválida',
          status: 500,
          details: responseData,
          data: null
        };
      }
      
      return { data: responseData, error: null };
    });
    
    // Si hay un error en la respuesta de Siigo
    if (result.error) {
      // Extraer detalles de error de manera segura
      const errorDetails = (result as any).details as any; // Usamos 'as any' temporalmente
      console.error('Error al crear factura en Siigo:', result.error, errorDetails);
      
      // Crear objeto de respuesta de error
      const errorResponse: {
        success: boolean;
        error: any;
        details?: any;
        type: string;
      } = {
        success: false,
        error: result.error,
        type: 'SIIGO_API_ERROR'
      };
      
      // Añadir detalles si existen
      if (errorDetails) {
        errorResponse.details = errorDetails;
      }
      
      return NextResponse.json(
        errorResponse,
        { status: result.status || 500 }
      );
    }
    
    return NextResponse.json({
      success: true,
      data: result.data || result,
      message: 'Factura de compra creada exitosamente'
    }, { status: 201 });
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
