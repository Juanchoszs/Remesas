import { NextResponse } from 'next/server';
import { obtenerFacturasSiigo } from '@/lib/siigo/facturas';

// Mapeo de tipos de documento a sus respectivos códigos, nombres y endpoints
const DOCUMENT_CONFIG = {
  // Facturas de Venta (FC)
  '1': { 
    code: 'FC', 
    name: 'FACTURA_VENTA',
    endpoint: process.env.COMPRAS_URL || 'document-types?type=FC',
    param: 'document.id',
    type: 'FC'
  },
  // Notas de Débito (ND)
  '2': { 
    code: 'ND', 
    name: 'NOTA_DEBITO',
    endpoint: process.env.NOTAS_URL || 'document-types?type=ND',
    param: 'document.type',
    type: 'ND'
  },
  // Documentos de Soporte (DS)
  '3': { 
    code: 'DS', 
    name: 'DOCUMENTO_SOPORTE',
    endpoint: process.env.DESCUENTO_URL || 'document-types?type=DS',
    param: 'document.type',
    type: 'DS'
  },
  // Recibos de Pago (RP)
  '4': { 
    code: 'RP', 
    name: 'RECIBO_PAGO',
    endpoint: process.env.PAGOS_RP || 'document-types?type=RP',
    param: 'document.type',
    type: 'RP'
  }
} as const;

type DocumentTypeKey = keyof typeof DOCUMENT_CONFIG;

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type') as DocumentTypeKey;
    
    // Validar tipo de documento
    if (!type || !DOCUMENT_CONFIG[type]) {
      return NextResponse.json({
        error: 'Tipo de documento inválido',
        validTypes: Object.entries(DOCUMENT_CONFIG).map(([key, value]) => ({
          id: key,
          code: value.code,
          name: value.name,
          endpoint: value.endpoint
        }))
      }, { status: 400 });
    }

    const config = DOCUMENT_CONFIG[type];
    
    // Mapear parámetros de ordenación
    const sortBy = searchParams.get('sortBy') || 'fecha';
    const sortOrder = (searchParams.get('sortOrder') || 'desc').toLowerCase() as 'asc' | 'desc';
    
    // Mapear sortBy a valores válidos para FiltrosFactura
    const sortMapping: Record<string, 'fecha' | 'numero' | 'total' | 'fecha_vencimiento'> = {
      'date': 'fecha',
      'number': 'numero',
      'total': 'total',
      'dueDate': 'fecha_vencimiento',
      'fecha': 'fecha',
      'numero': 'numero',
      'fecha_vencimiento': 'fecha_vencimiento'
    };
    
    // Preparar parámetros
    const params = {
      pagina: parseInt(searchParams.get('page') || '1'),
      porPagina: parseInt(searchParams.get('pageSize') || '20'),
      fechaInicio: searchParams.get('startDate') || undefined,
      fechaFin: searchParams.get('endDate') || undefined,
      clienteId: searchParams.get('customerId') || undefined,
      estado: searchParams.get('status') || undefined,
      textoBusqueda: searchParams.get('search') || undefined,
      ordenarPor: sortMapping[sortBy] || 'fecha',
      orden: sortOrder
    };

    // Obtener los datos
    const result = await obtenerFacturasSiigo(config.name, {
      ...params,
      endpoint: config.endpoint,
      paramTipo: config.param
    });

    // Manejar errores
    if (!result.success) {
      const status = result.error?.includes('404') ? 404 : 500;
      return NextResponse.json({
        success: false,
        error: result.error || `Error al obtener ${config.name.toLowerCase()}s`,
        type: config.name,
        code: config.code
      }, { status });
    }

    // Retornar respuesta exitosa
    return NextResponse.json({
      success: true,
      type: config.name,
      code: config.code,
      data: result.data || [],
      pagination: result.paginacion || {
        page: params.pagina,
        pageSize: params.porPagina,
        total: 0,
        totalPages: 0
      }
    });

  } catch (error: any) {
    console.error('Error en la API de facturas:', error);
    
    const errorMessage = error instanceof Error ? error.message : 'Error interno del servidor';
    const statusCode = errorMessage.includes('404') ? 404 : 500;
    
    return NextResponse.json({
      success: false,
      error: errorMessage,
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined
    }, { status: statusCode });
  }
}
