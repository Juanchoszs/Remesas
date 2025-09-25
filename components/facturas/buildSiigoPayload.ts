export interface SiigoPayload {
  // Define the structure of the Siigo payload here
  [key: string]: any;
}

export const buildSiigoPayload = (state: any): SiigoPayload => {
  const fechaFormateada = state.invoiceDate;
  
  // Determinar si es una factura de compra o venta
  if (state.invoiceType === 'purchase') {
    // Lógica para factura de compra
    const codigoProveedor = state.provider?.codigo || state.provider?.identificacion || '';
    const branchOffice = state.provider?.branch_office ?? 0;

    // Variables para cálculos
    let subtotal = 0;
    let totalIva = 0;
    let totalDescuentos = 0;

    // Mapear los ítems al formato de Siigo
    const items = state.items.map((item: any) => {
      const quantity = Number(item.quantity) || 1;
      const price = Number(item.price) || 0;
      const itemSubtotal = quantity * price;
      
      // Calcular descuento (puede ser porcentaje o valor fijo)
      let discount = 0;
      if (item.discount) {
        if (item.discount.type === 'percentage') {
          discount = itemSubtotal * (Number(item.discount.value) / 100);
        } else {
          discount = Number(item.discount.value) || 0;
        }
      }
      
      // Calcular subtotal e IVA
      const itemSubtotalConDescuento = itemSubtotal - discount;
      subtotal += itemSubtotalConDescuento;
      totalDescuentos += discount;
      
      // Calcular IVA si aplica
      let itemIva = 0;
      if (item.hasIVA) {
        itemIva = itemSubtotalConDescuento * (state.ivaPercentage / 100);
        totalIva += itemIva;
      }
      
      // Estructura de ítem según documentación de Siigo
      const itemPayload: any = {
        type: mapItemTypeToSiigoType(item.type),
        code: item.code || `ITEM-${Date.now()}`,
        description: item.description || 'Producto sin descripción',
        quantity: quantity,
        price: price,
        discount: discount
      };

      // Agregar impuestos si corresponde
      if (item.hasIVA) {
        itemPayload.taxes = [{
          id: 18384 // ID del impuesto IVA en Siigo
          // No incluimos 'value' ni 'type' ya que no son necesarios según la documentación
        }];
      }

      return itemPayload;
    });

    // Calcular el total final (subtotal + IVA)
    const total = subtotal + totalIva;
    
    // Redondear a 2 decimales para evitar problemas de precisión
    const totalRedondeado = Math.round(total * 100) / 100;

    // Configurar pagos según documentación de Siigo
    const payments = [{
      id: 8467, // ID del método de pago configurado en Siigo
      value: totalRedondeado,
      due_date: fechaFormateada
    }];

    // Generar un número de factura único basado en la fecha actual
    const invoiceNumber = `FC-${new Date().getTime()}`;
    
    // Payload para factura de compra según documentación de Siigo
    return {
      document: {
        id: (window as any).SIIGO_CONFIG?.DOCUMENT_TYPES?.PURCHASE_INVOICE || 7291,
        number: invoiceNumber // Asegurar que el campo number esté presente
      },
      date: fechaFormateada,
      supplier: {
        identification: String(codigoProveedor),
        branch_office: 0 // Valor por defecto según la documentación
      },
      // Incluir cost_center si está configurado
      ...(state.costCenter && { cost_center: Number(state.costCenter) }),
      
      // Configuración de la factura del proveedor
      provider_invoice: {
        prefix: state.providerInvoicePrefix || "FC",
        number: state.providerInvoiceNumber || `${new Date().getTime()}` // Número único temporal
      },
      
      // Incluir CUFE si está disponible
      ...(state.cufe && { cufe: state.cufe }),
      // No incluir currency cuando es la moneda local (COP)
      ...(state.currency && state.currency !== 'COP' ? {
        currency: {
          code: state.currency,
          exchange_rate: Number(state.currencyExchangeRate || 1)
        }
      } : {}),
      discount_type: "Value",
      supplier_by_item: false,
      tax_included: false,
      observations: state.observations || "",
      items: items || [], // Asegurar que items siempre esté presente
      payments
    };
  } else {
    // Lógica para venta: FV o RC
    if (!state.customer) {
      throw new Error('Se requiere un cliente para la factura de venta');
    }
    // RC (Recibo de Caja)
    if (state.saleDocumentType === 'RC') {
      const totalRc = (state.rcItems || []).reduce((s: number, it: any) => s + Number(it.value || 0), 0);
      return {
        document: state.rcDocumentId ? { id: Number(state.rcDocumentId) } : undefined,
        date: fechaFormateada,
        type: state.rcType || 'DebtPayment',
        customer: {
          identification: state.customer.identificacion,
          branch_office: state.customer.branch_office ?? 0,
        },
        currency: {
          code: state.currency || 'COP',
          exchange_rate: Number(state.currencyExchangeRate || 1)
        },
        items: (state.rcItems || []).map((rc: any) => ({
          due: {
            prefix: rc.due.prefix,
            consecutive: Number(rc.due.consecutive),
            ...(rc.due.quote ? { quote: Number(rc.due.quote) } : {}),
            ...(rc.due.date ? { date: rc.due.date } : {}),
          },
          value: Number(rc.value)
        })),
        payment: {
          id: Number(state.rcPaymentId),
          value: totalRc
        },
        observations: state.observations || ''
      };
    }
    
    // Calcular totales
    const subtotal = calculateSubtotal(state.items);
    const iva = calculateIVA(state.items, state.ivaPercentage);
    const total = subtotal + iva;
    
    // Mapear los ítems al formato de factura de venta
    const saleItems = state.items.map((item: any) => ({
      code: item.code,
      description: item.description,
      quantity: item.quantity,
      price: item.price,
      discount: item.discount || 0,
      taxes: item.hasIVA ? [{
        id: (window as any).SIIGO_CONFIG?.TAXES?.IVA_19?.id || 1,
        name: (window as any).SIIGO_CONFIG?.TAXES?.IVA_19?.name || 'IVA 19%',
        type: (window as any).SIIGO_CONFIG?.TAXES?.IVA_19?.type || 'IVA',
        percentage: (window as any).SIIGO_CONFIG?.TAXES?.IVA_19?.percentage || 19,
        value: (item.quantity * item.price * (state.ivaPercentage / 100)) // IVA calculado
      }] : []
    }));
    
    // Payload para factura de venta
    return {
      document: {
        id: (window as any).SIIGO_CONFIG?.DOCUMENT_TYPES?.SALE_INVOICE || 24446 // Usamos la constante para el tipo de documento
      },
      date: fechaFormateada,
      customer: {
        person_type: state.customer.person_type || 'Company',
        id_type: state.customer.id_type || ((window as any).SIIGO_CONFIG?.ID_TYPES?.NIT || '31'),
        identification: state.customer.identificacion,
        branch_office: 0,
        name: state.customer.name?.[0] || state.customer.nombre || 'Cliente sin nombre',
        ...(state.customer.direccion && { address: state.customer.direccion }),
        ...(state.customer.telefono && { phones: [{ number: state.customer.telefono }] })
      },
      seller: state.seller || 1,
      // No incluir currency cuando es la moneda local (COP)
      ...(state.currency && state.currency !== 'COP' ? {
        currency: {
          code: state.currency,
          exchange_rate: Number(state.currencyExchangeRate || 1)
        }
      } : {}),
      stamp: state.stamp || { send: true },
      mail: state.mail || { send: true },
      observations: state.observations || "",
      items: saleItems,
      payments: [{
        id: parseInt(state.paymentMethod || '1'),
        value: total,
        due_date: state.dueDate || fechaFormateada
      }]
    };
  }
};

// Funciones auxiliares
export const mapItemTypeToSiigoType = (type: string = 'product'): 'Product' | 'Service' | 'FixedAsset' => {
  switch (type) {
    case 'product': return 'Product';
    case 'service': return 'Service';
    case 'fixed-asset': return 'FixedAsset';
    default: return 'Product';
  }
};

export const calculateSubtotal = (items: any[]): number => {
  return items.reduce((sum, item) => {
    const itemSubtotal = (item.quantity || 0) * (item.price || 0);
    let discount = 0;
    if (item.discount) {
      if (item.discount.type === 'percentage') {
        discount = itemSubtotal * (Number(item.discount.value) / 100);
      } else {
        discount = Number(item.discount.value) || 0;
      }
    }
    return sum + (itemSubtotal - discount);
  }, 0);
};

export const calculateIVA = (items: any[], ivaPercentage: number): number => {
  return items.reduce((sum, item) => {
    if (!item.hasIVA) return sum;
    const itemSubtotal = (item.quantity || 0) * (item.price || 0);
    let discount = 0;
    if (item.discount) {
      if (item.discount.type === 'percentage') {
        discount = itemSubtotal * (Number(item.discount.value) / 100);
      } else {
        discount = Number(item.discount.value) || 0;
      }
    }
    const taxableAmount = itemSubtotal - discount;
    return sum + (taxableAmount * (ivaPercentage / 100));
  }, 0);
};
