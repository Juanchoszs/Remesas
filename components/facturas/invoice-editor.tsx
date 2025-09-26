"use client";

import { useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

export type InvoiceEditorItem = {
  id?: string;
  code?: string;
  description?: string;
  quantity: number;
  price: number;
  total?: number;
  type?: string;
};

export type InvoiceEditorValue = {
  id: string;
  type?: string; // FC, ND, etc
  date?: string;
  observations?: string;
  provider_invoice?: { prefix?: string; number?: string };
  items?: InvoiceEditorItem[];
};

interface InvoiceEditorProps {
  value: InvoiceEditorValue;
  onChange?: (next: InvoiceEditorValue) => void;
  onSave?: (payload: InvoiceEditorValue) => Promise<void>;
  onDelete?: () => Promise<void>;
  onCancel?: () => void;
  saving?: boolean;
}

export default function InvoiceEditor({ value, onChange, onSave, onDelete, onCancel, saving }: InvoiceEditorProps) {
  const [local, setLocal] = useState<InvoiceEditorValue>(() => ({
    id: value.id,
    type: value.type,
    date: value.date || '',
    observations: value.observations || '',
    provider_invoice: value.provider_invoice || { prefix: '', number: '' },
    items: (value.items || []).map(it => ({
      id: it.id,
      code: it.code,
      description: it.description,
      quantity: Number(it.quantity || 0),
      price: Number(it.price || 0),
      type: it.type,
      total: Number(it.total ?? (Number(it.quantity || 0) * Number(it.price || 0)))
    })),
  }));

  const [errors, setErrors] = useState<string[]>([]);
  const [valid, setValid] = useState<boolean>(true);

  const totals = useMemo(() => {
    const subtotal = (local.items || []).reduce((sum, it) => sum + (Number(it.quantity) * Number(it.price)), 0);
    return { subtotal, total: subtotal };
  }, [local.items]);

  const setField = <K extends keyof InvoiceEditorValue>(key: K, v: InvoiceEditorValue[K]) => {
    const next = { ...local, [key]: v } as InvoiceEditorValue;
    setLocal(next);
    onChange?.(next);
  };

  const setItemField = (index: number, patch: Partial<InvoiceEditorItem>) => {
    const items = [...(local.items || [])];
    items[index] = { ...items[index], ...patch };
    setField('items', items);
  };

  const addItem = () => {
    setField('items', [ ...(local.items || []), { description: '', code: '', quantity: 1, price: 0, total: 0 } ]);
  };

  const removeItem = (index: number) => {
    const items = [...(local.items || [])];
    items.splice(index, 1);
    setField('items', items);
  };

  // Live validation
  useEffect(() => {
    const errs: string[] = [];
    if (!local.date) errs.push('La fecha es requerida');
    const items = local.items || [];
    if (items.length === 0) errs.push('Debe agregar al menos un ítem');
    items.forEach((it, idx) => {
      if (!it.code || !String(it.code).trim()) errs.push(`Ítem ${idx + 1}: Código es requerido`);
      if (Number(it.quantity) <= 0) errs.push(`Ítem ${idx + 1}: Cantidad debe ser mayor a 0`);
      if (Number(it.price) < 0) errs.push(`Ítem ${idx + 1}: Precio no puede ser negativo`);
    });
    setErrors(errs);
    setValid(errs.length === 0);
  }, [local]);

  return (
    <div className="space-y-6">
      {errors.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-red-600">Validación</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="list-disc pl-5 text-sm text-red-600 space-y-1">
              {errors.map((e, i) => (
                <li key={i}>{e}</li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}
      <Card>
        <CardHeader>
          <CardTitle>Encabezado</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="date">Fecha</Label>
            <Input id="date" type="date" value={local.date || ''} onChange={(e) => setField('date', e.target.value)} disabled={!!saving} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="observations">Observaciones</Label>
            <Input id="observations" value={local.observations || ''} onChange={(e) => setField('observations', e.target.value)} disabled={!!saving} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="pfx">Prefijo Factura Proveedor</Label>
            <Input id="pfx" value={local.provider_invoice?.prefix || ''} onChange={(e) => setField('provider_invoice', { ...(local.provider_invoice || {}), prefix: e.target.value })} disabled={!!saving} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="num">Número Factura Proveedor</Label>
            <Input id="num" value={local.provider_invoice?.number || ''} onChange={(e) => setField('provider_invoice', { ...(local.provider_invoice || {}), number: e.target.value })} disabled={!!saving} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Ítems</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="mb-3">
            <Button variant="outline" onClick={addItem} disabled={!!saving}>Agregar Ítem</Button>
          </div>
          <div className="border rounded-md overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[20%]">Código</TableHead>
                  <TableHead className="w-[40%]">Descripción</TableHead>
                  <TableHead className="w-[10%] text-right">Cantidad</TableHead>
                  <TableHead className="w-[15%] text-right">Precio</TableHead>
                  <TableHead className="w-[15%] text-right">Total</TableHead>
                  <TableHead className="w-[80px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(local.items || []).map((it, idx) => (
                  <TableRow key={idx}>
                    <TableCell>
                      <Input value={it.code || ''} onChange={(e) => setItemField(idx, { code: e.target.value })} disabled={!!saving} />
                    </TableCell>
                    <TableCell>
                      <Input value={it.description || ''} onChange={(e) => setItemField(idx, { description: e.target.value })} disabled={!!saving} />
                    </TableCell>
                    <TableCell className="text-right">
                      <Input type="number" min={0} step={1} value={it.quantity} onChange={(e) => setItemField(idx, { quantity: Number(e.target.value) })} disabled={!!saving} />
                    </TableCell>
                    <TableCell className="text-right">
                      <Input type="number" min={0} step={100} value={it.price} onChange={(e) => setItemField(idx, { price: Number(e.target.value) })} disabled={!!saving} />
                    </TableCell>
                    <TableCell className="text-right">
                      ${(Number(it.quantity) * Number(it.price)).toLocaleString('es-CO', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" onClick={() => removeItem(idx)} disabled={!!saving}>Quitar</Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <div className="flex justify-end mt-4 text-sm">
            <div className="space-y-1">
              <div className="flex justify-between gap-6">
                <span>Subtotal:</span>
                <span className="whitespace-nowrap">${totals.subtotal.toLocaleString('es-CO', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</span>
              </div>
              <div className="flex justify-between gap-6 font-semibold text-lg">
                <span>Total:</span>
                <span className="whitespace-nowrap">${totals.total.toLocaleString('es-CO', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="flex gap-2 justify-end">
        {onDelete && (
          <Button variant="destructive" onClick={() => onDelete?.()} disabled={!!saving}>Eliminar</Button>
        )}
        <Button variant="outline" onClick={onCancel} disabled={!!saving}>Cancelar</Button>
        <Button onClick={() => valid && onSave?.(local)} disabled={!!saving || !valid || (local.items || []).length === 0}>
          {saving ? 'Guardando...' : 'Guardar Cambios'}
        </Button>
      </div>
    </div>
  );
}
