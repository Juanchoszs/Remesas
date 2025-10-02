import { NextResponse } from 'next/server';
import { obtenerTokenSiigo, SiigoAuthError } from '@/lib/siigo/auth';

const SIIGO_BASE_URL = process.env.SIIGO_BASE_URL || 'https://api.siigo.com/v1';
const PARTNER_ID = process.env.SIIGO_PARTNER_ID || 'RemesasYMensajes';

// Definir interfaces para los tipos de datos de Siigo
interface SiigoDocumentItem {
  code?: string;
  description?: string;
  quantity?: number;
  price?: number;
  discount?: number;
  taxes?: Array<{ id: number }>;
  type?: string;
}

interface SiigoDocument {
  id?: string;
  document?: { id: number };
  date?: string;
  supplier?: {
    identification?: string;
    branch_office?: number;
  };
  cost_center?: number;
  provider_invoice?: { prefix: string; number: string };
  currency?: { code: string; exchange_rate: number };
  observations?: string;
  discount_type?: string;
  supplier_by_item?: boolean;
  tax_included?: boolean;
  items?: SiigoDocumentItem[];
  payments?: Array<{
    id: number;
    value: number;
    due_date: string;
  }>;
}

interface SiigoPurchaseDocument extends SiigoDocument {
  items: SiigoDocumentItem[];
  payments: Array<{
    id: number;
    value: number;
    due_date: string;
  }>;
}

// interface SiigoApiErrorDetails {
//   status?: number;
//   message?: string;
//   errors?: Array<{
//     Code?: string;
//     Message?: string;
//   }>;
// }

function resolveBasePath(typeParam: string | null) {
  const type = (typeParam || 'FC').toUpperCase();
  switch (type) {
    case 'FC':
      return 'purchases';
    case 'ND':
      return 'debit-notes';
    case 'DS':
      return 'support-documents';
    case 'RP':
      return 'payment-receipts';
    default:
      return 'invoices';
  }
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function GET(request: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type');
    const basePath = resolveBasePath(type);
    const { id } = await ctx.params;

    let token: string;
    try {
      token = await obtenerTokenSiigo();
    } catch (e) {
      if (e instanceof SiigoAuthError && (e as { details?: { status?: number } })?.details?.status === 429) {
        await sleep(1200);
        token = await obtenerTokenSiigo(true);
      } else {
        throw e;
      }
    }
    const urlObj = new URL(`${SIIGO_BASE_URL}/${basePath}/${encodeURIComponent(id)}`);
    urlObj.searchParams.set('include_dependencies', 'true');

    const doFetch = async (bearer: string): Promise<Response> => fetch(urlObj.toString(), {
      headers: {
        Authorization: `Bearer ${bearer}`,
        'Content-Type': 'application/json',
        'Partner-Id': PARTNER_ID,
        Accept: 'application/json',
      },
      cache: 'no-store',
    });

    let res = await doFetch(token);
    if (res.status === 401) {
      token = await obtenerTokenSiigo(true);
      res = await doFetch(token);
    } else if (res.status === 429) {
      const retryAfter = Number(res.headers.get('retry-after') || 1);
      await sleep((retryAfter > 0 ? retryAfter : 1) * 1000);
      res = await doFetch(token);
    }

    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      return NextResponse.json({ success: false, error: data?.message || 'Error al obtener documento' }, { status: res.status });
    }

    return NextResponse.json({ success: true, data });
  } catch (error) {
    console.error('[SIIGO][GET /documents/:id] Error:', error);
    return NextResponse.json({ success: false, error: 'Error interno del servidor' }, { status: 500 });
  }
}

export async function PUT(request: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type');
    const basePath = resolveBasePath(type);
    const { id } = await ctx.params;

    const body = await request.json().catch(() => ({}));
    let token: string;
    try {
      token = await obtenerTokenSiigo();
    } catch (e) {
      if (e instanceof SiigoAuthError && (e as { details?: { status?: number } })?.details?.status === 429) {
        await sleep(1200);
        token = await obtenerTokenSiigo(true);
      } else {
        throw e;
      }
    }

    const url = `${SIIGO_BASE_URL}/${basePath}/${encodeURIComponent(id)}`;
    // Normalizar payload base desde el body
    const normalizedBody = (() => {
      try {
        if (basePath === 'purchases' && body && Array.isArray(body.items)) {
          const normItems = body.items.map((it: SiigoDocumentItem) => {
            const rawType = String(it?.type || '').trim();
            const normalizedType = ['Product', 'FixedAsset', 'Account'].includes(rawType)
              ? rawType
              : (rawType === 'Service' ? 'Account' : 'Product');
            const mapped: Partial<SiigoDocumentItem> = {
              code: String(it.code || ''),
              ...(it.description ? { description: String(it.description) } : {}),
              quantity: Number(it.quantity || 0),
              price: Number(it.price || 0),
            };
            mapped.type = normalizedType;
            if (it.discount !== undefined && it.discount !== null) mapped.discount = Number(it.discount);
            if (Array.isArray(it.taxes) && it.taxes.length > 0) mapped.taxes = it.taxes.map((t: { id: number }) => ({ id: Number(t.id) }));
            return mapped;
          });
          return { ...body, items: normItems };
        }
      } catch {}
      return body || {};
    })();

    // Si es compras (FC), completar el payload con campos requeridos desde el documento actual y recalcular payments
    let requestBody: Partial<SiigoPurchaseDocument> = normalizedBody;
    if (basePath === 'purchases') {
      // 1) Cargar documento actual para extraer campos requeridos
      const currentUrlObj = new URL(`${SIIGO_BASE_URL}/${basePath}/${encodeURIComponent(id)}`);
      currentUrlObj.searchParams.set('include_dependencies', 'true');

      const doGetCurrent = async (bearer: string): Promise<Response> => fetch(currentUrlObj.toString(), {
        headers: {
          Authorization: `Bearer ${bearer}`,
          'Content-Type': 'application/json',
          'Partner-Id': PARTNER_ID,
          Accept: 'application/json',
        },
        cache: 'no-store',
      });

      let currentRes = await doGetCurrent(token);
      if (currentRes.status === 401) {
        token = await obtenerTokenSiigo(true);
        currentRes = await doGetCurrent(token);
      } else if (currentRes.status === 429) {
        const retryAfter = Number(currentRes.headers.get('retry-after') || 1);
        await sleep((retryAfter > 0 ? retryAfter : 1) * 1000);
        currentRes = await doGetCurrent(token);
      }
      const current = await currentRes.json().catch(() => ({}));
      if (!currentRes.ok) {
        return NextResponse.json({ success: false, error: current?.message || 'No se pudo obtener el documento actual para completar actualización', details: current }, { status: currentRes.status });
      }

      // 2) Ensamblar items (siempre enviarlos) y heredar taxes desde documento actual si no se envían
      const incomingItems: SiigoDocumentItem[] = Array.isArray(normalizedBody.items) ? normalizedBody.items : [];
      const currentItems: SiigoDocumentItem[] = Array.isArray(current?.items) ? current.items : [];
      const items = incomingItems.map((it: SiigoDocumentItem) => {
        if (it && (!it.taxes || it.taxes.length === 0)) {
          const match = currentItems.find((ci: SiigoDocumentItem) => String(ci.code || '').trim() === String(it.code || '').trim());
          if (match && Array.isArray(match.taxes) && match.taxes.length > 0) {
            return { ...it, taxes: match.taxes.map((t: { id: number }) => ({ id: Number(t.id) })) };
          }
        }
        return it;
      });

      // 3) Calcular total de compra sin impuestos (según Siigo)
      const discountTypeRaw = String(normalizedBody.discount_type || current?.discount_type || 'Value');
      const discountType = discountTypeRaw.toLowerCase() === 'percentage' ? 'percentage' : 'Value';
      let totalPurchase = 0;
      for (const it of (items || [])) {
        const qty = Number(it.quantity || 0);
        const price = Number(it.price || 0);
        let base = qty * price;
        const rawDisc = Number(it.discount || 0);
        let disc = rawDisc;
        if (discountType === 'percentage') {
          disc = base * (rawDisc / 100);
        }
        base = Math.max(0, base - disc);
        totalPurchase += base;
      }
      totalPurchase = Math.round(totalPurchase * 100) / 100;

      // 4) Payments (obligatorio para FC)
      const existingPaymentIdRaw =
        (Array.isArray(normalizedBody.payments) && normalizedBody.payments[0]?.id) ??
        (Array.isArray(current?.payments) && current.payments[0]?.id) ??
        8467;
      const existingPaymentId = Number(existingPaymentIdRaw);
      const paymentIdFinal = Number.isFinite(existingPaymentId) && existingPaymentId > 0 ? existingPaymentId : 8467;
      const effDate = String(normalizedBody.date || current?.date || new Date().toISOString().slice(0, 10));
      const payments = [
        {
          id: paymentIdFinal,
          value: totalPurchase,
          due_date: (Array.isArray(normalizedBody.payments) && normalizedBody.payments[0]?.due_date) || effDate,
        },
      ];

      // 5) Document type id obligatorio
      const documentId = Number(normalizedBody?.document?.id ?? current?.document?.id);
      if (!Number.isFinite(documentId) || documentId <= 0) {
        return NextResponse.json({ success: false, error: 'Documento (document.id) inválido o no determinado para FC' }, { status: 400 });
      }

      //  6) Proveedor obligatorio (desde el documento actual)
      const supplier = normalizedBody?.supplier ?? (current?.supplier
        ? (() => {
            const identification = String(current.supplier.identification || current.supplier.identificacion || '');
            const branchOfficeNum = Number(current.supplier.branch_office);
            const base: { identification: string; branch_office?: number } = { identification };
            // Solo incluir branch_office si es un número válido y > 0
            if (Number.isFinite(branchOfficeNum) && branchOfficeNum > 0) {
              base.branch_office = branchOfficeNum;
            }
            return base;
          })()
        : undefined);

      if (!supplier || !supplier.identification) {
        return NextResponse.json({ success: false, error: 'Proveedor no determinado para la actualización de FC' }, { status: 400 });
      }

      // 7) Otros campos opcionales conservados del documento actual
      const provider_invoice = normalizedBody.provider_invoice || current?.provider_invoice;
      const currency = normalizedBody.currency || (current?.currency?.code && current.currency.code !== 'COP'
        ? { code: current.currency.code, exchange_rate: Number(current.currency.exchange_rate || 1) }
        : undefined);
      const cost_center = normalizedBody.cost_center ?? current?.cost_center;
      const supplier_by_item = normalizedBody.supplier_by_item ?? current?.supplier_by_item ?? false;
      const tax_included = normalizedBody.tax_included ?? current?.tax_included ?? false;

      requestBody = {
        document: { id: documentId },
        date: effDate,
        supplier,
        // Incluir cost_center solo si es un número válido y > 0
        ...((() => {
          const cc = Number(cost_center);
          return Number.isFinite(cc) && cc > 0 ? { cost_center: cc } : {};
        })()),
        ...(provider_invoice ? { provider_invoice: { prefix: String(provider_invoice.prefix || ''), number: String(provider_invoice.number || '') } } : {}),
        ...(currency ? { currency } : {}),
        observations: normalizedBody.observations ?? current?.observations ?? '',
        discount_type: discountType,
        supplier_by_item: Boolean(supplier_by_item),
        tax_included: Boolean(tax_included),
        items,
        payments,
      };
    }

    const doFetch = async (bearer: string, payload: Partial<SiigoPurchaseDocument>): Promise<Response> => fetch(url, {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${bearer}`,
        'Content-Type': 'application/json',
        'Partner-Id': PARTNER_ID,
        Accept: 'application/json',
      },
      body: JSON.stringify(payload),
    });

       let res = await doFetch(token, requestBody);
    if (res.status === 401) {
      token = await obtenerTokenSiigo(true);
      res = await doFetch(token, requestBody);
    } else if (res.status === 429) {
      const retryAfter = Number(res.headers.get('retry-after') || 1);
      await sleep((retryAfter > 0 ? retryAfter : 1) * 1000);
      res = await doFetch(token, requestBody);
    }

    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      const details = (data as { errors?: Array<{ Code?: string; Message?: string }>; Errors?: Array<{ Code?: string; Message?: string }> })?.errors || (data as { errors?: Array<{ Code?: string; Message?: string }>; Errors?: Array<{ Code?: string; Message?: string }> })?.Errors || data;
      return NextResponse.json({ success: false, error: data?.message || 'Error al actualizar documento', details }, { status: res.status });
    }

    return NextResponse.json({ success: true, data });
  } catch (error) {
    console.error('[SIIGO][PUT /documents/:id] Error:', error);
    return NextResponse.json({ success: false, error: 'Error interno del servidor' }, { status: 500 });
  }
}

export async function DELETE(request: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type');
    const basePath = resolveBasePath(type);
    const { id } = await ctx.params;

    let token: string = await obtenerTokenSiigo();

    const url = `${SIIGO_BASE_URL}/${basePath}/${encodeURIComponent(id)}`;
    const doFetch = async (bearer: string): Promise<Response> => fetch(url, {
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${bearer}`,
        'Content-Type': 'application/json',
        'Partner-Id': PARTNER_ID,
        Accept: 'application/json',
      },
    });

    let res = await doFetch(token);
    if (res.status === 401) {
      token = await obtenerTokenSiigo(true);
      res = await doFetch(token);
    } else if (res.status === 429) {
      const retryAfter = Number(res.headers.get('retry-after') || 1);
      await sleep((retryAfter > 0 ? retryAfter : 1) * 1000);
      res = await doFetch(token);
    }

    // DELETE may return 204 with empty body
    if (res.status === 204) {
      return NextResponse.json({ success: true, data: null });
    }

    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      return NextResponse.json({ success: false, error: data?.message || 'Error al eliminar documento' }, { status: res.status });
    }

    return NextResponse.json({ success: true, data });
  } catch (error) {
    console.error('[SIIGO][DELETE /documents/:id] Error:', error);
    return NextResponse.json({ success: false, error: 'Error interno del servidor' }, { status: 500 });
  }
}
