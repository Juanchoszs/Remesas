import { NextResponse } from 'next/server';
import { obtenerTokenSiigo } from '@/lib/siigo/auth';

const SIIGO_BASE_URL = process.env.SIIGO_BASE_URL || 'https://api.siigo.com/v1';
const PARTNER_ID = process.env.SIIGO_PARTNER_ID || 'RemesasYMensajes';

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

export async function GET(request: Request, ctx: { params: { id: string } }) {
  try {
    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type');
    const basePath = resolveBasePath(type);
    const id = ctx.params.id;

    const token = await obtenerTokenSiigo();
    const url = `${SIIGO_BASE_URL}/${basePath}/${encodeURIComponent(id)}`;

    const res = await fetch(url, {
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        'Partner-Id': PARTNER_ID,
        Accept: 'application/json',
      },
      cache: 'no-store',
    });

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

export async function PUT(request: Request, ctx: { params: { id: string } }) {
  try {
    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type');
    const basePath = resolveBasePath(type);
    const id = ctx.params.id;

    const body = await request.json().catch(() => ({}));
    const token = await obtenerTokenSiigo();

    const url = `${SIIGO_BASE_URL}/${basePath}/${encodeURIComponent(id)}`;
    const res = await fetch(url, {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        'Partner-Id': PARTNER_ID,
        Accept: 'application/json',
      },
      body: JSON.stringify(body),
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      return NextResponse.json({ success: false, error: data?.message || 'Error al actualizar documento' }, { status: res.status });
    }

    return NextResponse.json({ success: true, data });
  } catch (error) {
    console.error('[SIIGO][PUT /documents/:id] Error:', error);
    return NextResponse.json({ success: false, error: 'Error interno del servidor' }, { status: 500 });
  }
}

export async function DELETE(request: Request, ctx: { params: { id: string } }) {
  try {
    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type');
    const basePath = resolveBasePath(type);
    const id = ctx.params.id;

    const token = await obtenerTokenSiigo();

    const url = `${SIIGO_BASE_URL}/${basePath}/${encodeURIComponent(id)}`;
    const res = await fetch(url, {
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        'Partner-Id': PARTNER_ID,
        Accept: 'application/json',
      },
    });

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
