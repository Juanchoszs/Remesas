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
      
      // Construir el payload exactamente como lo exige Siigo (sanitizado y tipado)
      const rootNumberCandidate = (body as any)?.number ?? (body as any)?.document?.number ?? (body as any)?.consecutive ?? null;
      const rootNumber = rootNumberCandidate !== null && rootNumberCandidate !== '' && !isNaN(Number(rootNumberCandidate))
        ? Number(rootNumberCandidate)
        : undefined;

      const providerInvoice = (body as any)?.provider_invoice && (
        (body as any).provider_invoice.number !== undefined || (body as any).provider_invoice.prefix !== undefined
      ) ? {
        ...( (body as any).provider_invoice.prefix !== undefined ? { prefix: String((body as any).provider_invoice.prefix) } : {} ),
        ...( (body as any).provider_invoice.number !== undefined ? { number: String((body as any).provider_invoice.number) } : {} ),
      } : undefined;

      // Siigo requiere el campo payments en FC. Por defecto lo incluimos, salvo que explícitamente se envíe include_payments=false
      const includePayments = (body as any)?.include_payments !== false;
      const payments = Array.isArray((body as any)?.payments)
        ? (body as any).payments.map((p: any) => ({
            id: Number(p.id),
            value: Number(p.value),
            ...(p.due_date ? { due_date: String(p.due_date) } : {})
          }))
        : [];

      const items = Array.isArray((body as any)?.items)
        ? (body as any).items.map((item: any) => {
            const rawType = String(item.type || 'Product');
            const normalizedType = ['Product', 'FixedAsset', 'Account'].includes(rawType)
              ? rawType
              : (rawType === 'Service' ? 'Account' : 'Product');
            return {
              type: normalizedType,
              code: String(item.code),
              ...(item.description ? { description: String(item.description) } : {}),
              quantity: Number(item.quantity || 0),
              price: Number(item.price || 0),
              ...(item.discount !== undefined && item.discount !== null ? { discount: Number(item.discount) } : {}),
              ...(Array.isArray(item.taxes) && item.taxes.length > 0 ? { taxes: item.taxes.map((t: any) => ({ id: Number(t.id) })) } : {}),
              ...(((body as any)?.supplier_by_item && item.supplier !== undefined) ? { supplier: Number(item.supplier) } : {}),
              ...(item.warehouse !== undefined ? { warehouse: Number(item.warehouse) } : {})
            };
          })
        : [];

      const payload: any = {
        document: {
          id: Number((body as any)?.document?.id || 7291) // Asegurar que siempre haya un ID de documento
        },
        date: String((body as any)?.date),
        supplier: {
          identification: String((body as any)?.supplier?.identification),
          branch_office: Number((body as any)?.supplier?.branch_office ?? 0)
        },
        ...( (body as any)?.cost_center !== undefined ? { cost_center: Number((body as any).cost_center) } : {} ),
        ...(providerInvoice ? { provider_invoice: providerInvoice } : {}),
        ...( (body as any)?.currency && (body as any).currency.code ? {
          currency: {
            code: String((body as any).currency.code),
            ...((body as any).currency.exchange_rate !== undefined ? { exchange_rate: Number((body as any).currency.exchange_rate) } : {})
          }
        } : {}),
        ...( (body as any)?.observations ? { observations: String((body as any).observations) } : {} ),
        ...( (body as any)?.discount_type ? { discount_type: (body as any).discount_type === 'Percentage' ? 'Percentage' : 'Value' } : { discount_type: 'Value' } ),
        ...( typeof (body as any)?.supplier_by_item === 'boolean' ? { supplier_by_item: (body as any).supplier_by_item } : { supplier_by_item: false } ),
        ...( typeof (body as any)?.tax_included === 'boolean' ? { tax_included: (body as any).tax_included } : { tax_included: false } ),
        items,
        ...(includePayments ? { payments } : {})
      };

      // Preflight: si no vino number en el cuerpo, decidir según configuración del comprobante
      let finalNumber = rootNumber;
      if (finalNumber === undefined) {
        try {
          const dtUrl = new URL(`${baseUrl}/document-types`);
          dtUrl.searchParams.set('type', 'FC');
          const dtResp = await fetch(dtUrl.toString(), {
            method: 'GET',
            headers: {
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json',
              'Partner-Id': process.env.SIIGO_PARTNER_ID || 'RemesasApp',
              'Accept': 'application/json'
            }
          });
          const dtText = await dtResp.text();
          const dtData = dtText ? JSON.parse(dtText) : [];
          const dtList = Array.isArray(dtData) ? dtData : (Array.isArray(dtData?.results) ? dtData.results : []);
          let currentDocType = dtList.find((d: any) => Number(d?.id) === Number(payload?.document?.id));
          if (!currentDocType || currentDocType.active === false) {
            // Si el documento actual no existe o está inactivo, usar el primer documento activo disponible
            const fallbackActive = dtList.find((d: any) => d?.active === true);
            if (!fallbackActive) {
              console.warn('Preflight: No hay documentos FC activos en Siigo.');
            } else {
              console.warn(`Preflight: document.id ${payload?.document?.id} inactivo/no encontrado. Usando activo ${fallbackActive.id} - ${fallbackActive.name}`);
              payload.document.id = Number(fallbackActive.id);
              currentDocType = fallbackActive;
            }
          }
          if (currentDocType) {
            const automatic = Boolean(currentDocType.automatic_number);
            if (!automatic) {
              // Documento en numeración manual: calcular consecutivo de antemano
              const computeNextNumberPre = async (): Promise<number> => {
                try {
                  const listUrl = new URL(`${baseUrl}/purchases`);
                  listUrl.searchParams.set('document_type', 'FC');
                  listUrl.searchParams.set('page', '1');
                  listUrl.searchParams.set('page_size', '50');
                  const listResp = await fetch(listUrl.toString(), {
                    method: 'GET',
                    headers: {
                      'Authorization': `Bearer ${token}`,
                      'Content-Type': 'application/json',
                      'Partner-Id': process.env.SIIGO_PARTNER_ID || 'RemesasApp',
                      'Accept': 'application/json'
                    }
                  });
                  const listText = await listResp.text();
                  const listData = listText ? JSON.parse(listText) : [];
                  const docs = Array.isArray(listData) ? listData : (Array.isArray(listData?.results) ? listData.results : []);
                  const currentDocId = Number(payload?.document?.id);
                  const docsForDoc = docs.filter((d: any) => Number(d?.document?.id) === currentDocId);
                  const maxNumber = docsForDoc.reduce((max: number, d: any) => {
                    const n = Number(d?.number);
                    return !isNaN(n) && n > max ? n : max;
                  }, 0);
                  const docConsecutive = Number(currentDocType?.consecutive);
                  const computedFromList = (maxNumber || 0) + 1;
                  // Sanity check: si el consecutivo reportado es irreal, usar el de la lista
                  let candidate = computedFromList;
                  if (!isNaN(docConsecutive) && docConsecutive > 0 && docConsecutive < computedFromList + 10000) {
                    candidate = Math.max(docConsecutive, computedFromList);
                  }
                  return candidate > 0 ? candidate : (computedFromList || 1);
                } catch (e) {
                  console.warn('Preflight: no se pudo calcular el consecutivo automáticamente. Error:', e);
                  return 1;
                }
              };
              finalNumber = await computeNextNumberPre();
            }
          }
        } catch (e) {
          console.warn('Preflight: no se pudo consultar document-types, se intentará envío directo. Error:', e);
        }
      }

      if (finalNumber !== undefined) {
        payload.number = finalNumber;
      }
      
      // Preflight: ajustar payments sólo si se solicitó registrar pagos (para evitar crear RP en pruebas de FC)
      if (includePayments) {
        try {
          const discountType = String(payload.discount_type || 'Value');
          let totalPurchase = 0;
          for (const it of (payload.items || [])) {
            const qty = Number(it.quantity || 0);
            const price = Number(it.price || 0);
            let base = qty * price;
            // Descuento por ítem
            const rawDisc = Number(it.discount || 0);
            let disc = rawDisc;
            if (discountType === 'Percentage') {
              disc = base * (rawDisc / 100);
            }
            base = Math.max(0, base - disc);
            // En compras, Siigo valida payments contra el total de compra sin impuestos
            totalPurchase += base;
          }
          totalPurchase = Math.round(totalPurchase * 100) / 100;
          const currentPaymentsTotal = Math.round(((payload.payments || []).reduce((s: number, p: any) => s + Number(p.value || 0), 0)) * 100) / 100;
          if (totalPurchase !== currentPaymentsTotal) {
            const firstPayment = (payload.payments && payload.payments[0]) || {};
            payload.payments = [{
              id: Number(firstPayment.id || 8467),
              value: totalPurchase,
              due_date: firstPayment.due_date || payload.date
            }];
          }
        } catch (e) {
          console.warn('Preflight: no se pudo ajustar payments automáticamente (total sin impuestos):', e);
        }
      }
      
      console.log('URL de la API de Siigo:', url);
      console.log('Payload final enviado a Siigo:', JSON.stringify(payload, null, 2));
      
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
          'Partner-Id': process.env.SIIGO_PARTNER_ID || 'RemesasApp',
          'Accept': 'application/json'
        },
        body: JSON.stringify(payload)
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
      // Log detallado en JSON para ver rutas de error y parámetros
      try {
        console.log('Respuesta de Siigo (JSON):', JSON.stringify({
          status: response.status,
          statusText: response.statusText,
          data: responseData
        }, null, 2));
      } catch {}
      
      if (!response.ok) {
        console.error('Error en la API de Siigo:', response.status, responseData);
        try {
          const errsRaw = (responseData as any)?.errors ?? (responseData as any)?.Errors;
          if (errsRaw) {
            console.error('Errores detallados de Siigo:', JSON.stringify(errsRaw, null, 2));
          }
        } catch {}

        // Si falta el campo number (documento en numeración manual), intentar asignarlo automáticamente
        const errorsArr = Array.isArray((responseData as any)?.errors)
          ? (responseData as any).errors
          : (Array.isArray((responseData as any)?.Errors) ? (responseData as any).Errors : []);
        const missingNumber = errorsArr.some((e: any) => (
          (e?.code === 'parameter_required' && (Array.isArray(e?.params) ? e.params.includes('number') : /number/i.test(String(e?.message))))
          || (e?.Code === 'parameter_required' && (Array.isArray(e?.Params) ? e.Params.includes('number') : /number/i.test(String(e?.Message))))
        ));

        // Solo intentar autogenerar si el payload original no traía un number explícito
        if (response.status === 400 && missingNumber && rootNumber === undefined) {
          const computeNextNumber = async (): Promise<number> => {
            try {
              const listUrl = new URL(`${baseUrl}/purchases`);
              listUrl.searchParams.set('document_type', 'FC');
              listUrl.searchParams.set('page', '1');
              listUrl.searchParams.set('page_size', '50');
              const listResp = await fetch(listUrl.toString(), {
                method: 'GET',
                headers: {
                  'Authorization': `Bearer ${token}`,
                  'Content-Type': 'application/json',
                  'Partner-Id': process.env.SIIGO_PARTNER_ID || 'RemesasApp',
                  'Accept': 'application/json'
                }
              });
              const listText = await listResp.text();
              const listData = listText ? JSON.parse(listText) : [];
              const docs = Array.isArray(listData) ? listData : (Array.isArray(listData?.results) ? listData.results : []);
              const currentDocId = Number(payload?.document?.id);
              const docsForDoc = docs.filter((d: any) => Number(d?.document?.id) === currentDocId);
              const maxNumber = docsForDoc.reduce((max: number, d: any) => {
                const n = Number(d?.number);
                return !isNaN(n) && n > max ? n : max;
              }, 0);
              return (maxNumber || 0) + 1;
            } catch (e) {
              console.warn('No se pudo calcular el siguiente consecutivo automáticamente, usando 1 como base. Error:', e);
              return 1;
            }
          };

          let nextNumber = await computeNextNumber();
          // Reintentar hasta 5 veces incrementando si ya existe
          for (let i = 0; i < 5; i++) {
            const retryPayload = { ...payload, number: nextNumber };
            console.log(`Reintentando con number=${nextNumber}`);
            const retryResponse = await fetch(url, {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json',
                'Partner-Id': process.env.SIIGO_PARTNER_ID || 'RemesasApp',
                'Accept': 'application/json'
              },
              body: JSON.stringify(retryPayload)
            });
            const retryText = await retryResponse.text();
            let retryData: any = {};
            try { retryData = retryText ? JSON.parse(retryText) : {}; } catch {}
            if (retryResponse.ok) {
              return { data: retryData, error: null };
            }
            const retryErrors = Array.isArray(retryData?.errors) ? retryData.errors : [];
            const numberExists = retryErrors.some((e: any) => e?.code === 'already_exists' && (Array.isArray(e?.params) ? e.params.includes('number') : /number/i.test(String(e?.message))));
            if (numberExists) {
              nextNumber += 1;
              continue;
            }
            // Si el error no es por número existente, abandonamos y devolvemos el error del reintento
            return {
              error: retryData?.message || `Error al crear la factura en Siigo (${retryResponse.status})`,
              status: retryResponse.status,
              details: retryData,
              data: null
            };
          }

          // Si se agotaron los reintentos
          return {
            error: 'No fue posible asignar un número automáticamente tras varios intentos',
            status: 400,
            details: responseData,
            data: null
          };
        }

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
    
    // Manejo robusto de errores devueltos dentro de result.data
    const nested = (result as any)?.data;
    if (result.error || (nested && typeof nested === 'object' && nested.error)) {
      const errMsg = result.error || nested.error || 'Error desconocido en Siigo';
      const details = (result as any)?.details || nested?.details;
      const statusCode = (result as any)?.status || nested?.status || 500;
      console.error('Error al crear factura en Siigo (post-call):', errMsg, details);
      return NextResponse.json({
        success: false,
        error: errMsg,
        details,
        type: 'SIIGO_API_ERROR'
      }, { status: statusCode });
    }

    return NextResponse.json({
      success: true,
      data: nested ?? result,
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
