/* eslint-disable @typescript-eslint/no-explicit-any */
export interface PagoSiigo {
  id: number;
  name: string;
  value: number;
  due_date: string;
  payment_method_id: number;
}

export interface SiigoPayload {
  document?: {
    id: number;
    prefix?: string;
    number?: string;
  };
  date: string;
  supplier?: {
    identification: string;
    branch_office?: number;
  };
  customer?: any;
  provider_invoice?: {
    prefix: string;
    number: string;
  };
  observations?: string;
  discount_type?: 'Value' | 'Percentage';
  supplier_by_item?: boolean;
  tax_included?: boolean;
  items: Array<{
    type: 'Product' | 'Service' | 'FixedAsset';
    code: string;
    description: string;
    quantity: number;
    price: number;
    discount: number;
    taxes?: Array<{ id: number }>;
  }>;
  payments: PagoSiigo[];
  [key: string]: any;
}

export const buildSiigoPayload = (state: any): SiigoPayload => {
  console.log('Construyendo payload para Siigo con estado:', JSON.stringify(state, null, 2));
  const fechaFormateada = state.invoiceDate || new Date().toISOString().split('T')[0];
  
  // Validar pagos
  if (!state.pagos || !Array.isArray(state.pagos) || state.pagos.length === 0) {
    console.error('No se encontraron pagos en el estado:', state);
    throw new Error('Debe configurar al menos un método de pago');
  }

  // Mapear pagos al formato de Siigo
  const payments = state.pagos.map((pago: any) => {
    console.log('Procesando pago en buildSiigoPayload:', pago);
    return {
      id: Number(pago.payment_method_id || pago.id),
      name: String(pago.name || 'Pago'),
      value: Number(pago.value || 0),
      due_date: pago.due_date || new Date().toISOString().split('T')[0],
      payment_method_id: Number(pago.payment_method_id || pago.id)
    };
  });

  console.log('Pagos procesados para Siigo:', payments);

  // Determinar si es una factura de compra o venta
  if (state.invoiceType === 'purchase') {

    // Usar los pagos ya mapeados
    return {
      document: {
        id: (window as any).SIIGO_CONFIG?.DOCUMENT_TYPES?.PURCHASE_INVOICE || 7291,
        prefix: 'FC',
        number: state.providerInvoiceNumber || '1'
      },
      date: fechaFormateada,
      supplier: {
        identification: state.provider?.identificacion || '',
        branch_office: 0
      },
      provider_invoice: {
        prefix: state.providerInvoicePrefix || 'FC',
        number: state.providerInvoiceNumber || '1'
      },
      items: (state.items || []).map((item: any) => ({
        type: 'Product',
        code: item.code || '001',
        description: item.description || 'Producto sin descripción',
        quantity: Number(item.quantity || 1),
        price: Number(item.price || 0),
        discount: Number(item.discount || 0),
        taxes: item.hasIVA ? [{ id: 18384 }] : []
      })),
      payments, // Usar los pagos ya mapeados
      discount_type: 'Value',
      supplier_by_item: false,
      tax_included: false,
      observations: state.observations || '',
      // Incluir moneda por defecto COP
      currency: {
        code: 'COP',
        exchange_rate: 1
      }
    };
  } else {
    // Lógica para factura de venta...
    return {
      // ... (mantener la lógica existente para ventas)
    } as any;
  }
};

// Funciones auxiliares
export const mapItemTypeToSiigoType = (type: string = 'Product'): 'Product' | 'Service' | 'FixedAsset' => {
  switch (type.toLowerCase()) {
    case 'service': return 'Service';
    case 'fixedasset': return 'FixedAsset';
    default: return 'Product';
  }
};

export const calculateSubtotal = (items: any[] = []): number => {
  return items.reduce((sum, item) => {
    const quantity = Number(item.quantity) || 0;
    const price = Number(item.price) || 0;
    return sum + (quantity * price);
  }, 0);
};

export const calculateIVA = (items: any[] = [], ivaPercentage: number = 19): number => {
  return items.reduce((sum, item) => {
    if (!item.hasIVA) return sum;
    const quantity = Number(item.quantity) || 0;
    const price = Number(item.price) || 0;
    return sum + (quantity * price * (ivaPercentage / 100));
  }, 0);
};