"use client";

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import InvoiceEditor, { type InvoiceEditorValue } from '@/components/facturas/invoice-editor';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

export default function EditorClient({ id, type }: { id: string; type: string }) {
  const router = useRouter();
  const sp = useSearchParams();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [initial, setInitial] = useState<InvoiceEditorValue | null>(null);

  const effectiveType = (sp.get('type') || type || 'FC').toUpperCase();

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        setError(null);
        const res = await fetch(`/api/siigo/documents/${encodeURIComponent(id)}?type=${effectiveType}`, { cache: 'no-store' });
        const data = await res.json();
        if (!res.ok || data?.success === false) {
          throw new Error(data?.error || 'No se pudo cargar la factura');
        }
        const doc = data.data || data;
        const editorValue: InvoiceEditorValue = {
          id,
          type: effectiveType,
          date: doc.date || doc.issue_date || '',
          observations: doc.observations || '',
          provider_invoice: doc.provider_invoice || { prefix: doc.invoice_prefix || '', number: String(doc.invoice_number || '') },
          items: Array.isArray(doc.items)
            ? doc.items.map((it: any) => ({
                id: String(it.id ?? ''),
                code: it.code || it.sku || it.product_code || it?.account?.code || '',
                description: it.description || it.name || '',
                quantity: Number(it.quantity ?? 0),
                price: Number(it.price ?? it.value ?? 0),
                total: Number(it.total ?? (Number(it.quantity || 0) * Number(it.price || 0))),
                type: it.type || undefined,
              }))
            : [],
        };
        setInitial(editorValue);
      } catch (e: any) {
        setError(e?.message || 'Error cargando la factura');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [id, effectiveType]);

  const handleSave = async (payload: InvoiceEditorValue) => {
    try {
      setSaving(true);
      setError(null);
      const update: any = {
        date: payload.date,
        observations: payload.observations,
        provider_invoice: payload.provider_invoice,
        items: (payload.items || []).map((it) => ({
          code: it.code,
          description: it.description,
          quantity: Number(it.quantity || 0),
          price: Number(it.price || 0),
          type: it.type || undefined,
        })),
      };

      const res = await fetch(`/api/siigo/documents/${encodeURIComponent(id)}?type=${effectiveType}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(update),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || data?.success === false) {
        throw new Error(data?.error || 'Error actualizando la factura en Siigo');
      }
      toast.success('Factura actualizada correctamente');
      router.push('/consultar-facturas');
    } catch (e: any) {
      console.error(e);
      toast.error(e?.message || 'Error al actualizar');
      setError(e?.message || 'Error al actualizar');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm('¿Eliminar esta factura en Siigo? Esta acción no se puede deshacer.')) return;
    try {
      setSaving(true);
      setError(null);
      const res = await fetch(`/api/siigo/documents/${encodeURIComponent(id)}?type=${effectiveType}`, { method: 'DELETE' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || data?.success === false) {
        throw new Error(data?.error || 'Error eliminando la factura');
      }
      toast.success('Factura eliminada');
      router.push('/consultar-facturas');
    } catch (e: any) {
      console.error(e);
      toast.error(e?.message || 'Error al eliminar');
      setError(e?.message || 'Error al eliminar');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="container mx-auto p-6">
        <Card>
          <CardHeader>
            <CardTitle>Cargando factura...</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-sm text-muted-foreground">Por favor espera.</div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container mx-auto p-6">
        <Card>
          <CardHeader>
            <CardTitle>Error</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-red-600">{error}</div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!initial) return null;

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Editar Factura #{id}</h1>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => history.back()}>Volver</Button>
          <Button variant="destructive" onClick={handleDelete} disabled={saving}>Eliminar</Button>
        </div>
      </div>
      <InvoiceEditor value={initial} onSave={handleSave} onDelete={handleDelete} onCancel={() => history.back()} saving={saving} />
    </div>
  );
}
