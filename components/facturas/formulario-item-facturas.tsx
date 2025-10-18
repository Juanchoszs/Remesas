import * as React from "react"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { NumberInput } from "@/components/ui/number-input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Checkbox } from "@/components/ui/checkbox"
import { Badge } from "@/components/ui/badge"
import { Autocomplete } from "@/components/autocomplete"
import { InvoiceItem } from "@/types/siigo"
import { Trash2 } from "lucide-react"
import { TaxSelector } from "./TaxSelector"
import { useEffect, useState } from "react"

interface Tax {
  id: string;
  name: string;
  percentage: number;
  type: string;
}

const DEFAULT_TAXES: Tax[] = [
  { id: '1', name: 'IVA 19%', percentage: 19, type: 'IVA' },
  { id: '2', name: 'IVA 5%', percentage: 5, type: 'IVA' },
  { id: '3', name: 'IVA 0%', percentage: 0, type: 'IVA' },
  { id: '4', name: 'ICA', percentage: 1.2, type: 'ICA' },
  { id: '5', name: 'ReteIVA', percentage: 15, type: 'ReteIVA' },
  { id: '6', name: 'ReteICA', percentage: 2.4, type: 'ReteICA' },
  { id: '7', name: 'ReteFuente', percentage: 3.5, type: 'ReteFuente' },
];

type InvoiceItemFormProps = {
  item: InvoiceItem
  onUpdate: (
    id: string, 
    field: keyof InvoiceItem, 
    value: string | number | boolean | { type?: string; value?: number } | string[] | undefined
  ) => void
  onRemove: (id: string) => void
  index: number
  isLastItem: boolean
  taxesList?: Tax[]
  disabled?: boolean
}

export function InvoiceItemForm({
  item,
  onUpdate,
  onRemove,
  index,
  isLastItem,
  taxesList = [],
  disabled = false
}: InvoiceItemFormProps) {
  const taxes = taxesList.length > 0 ? taxesList : DEFAULT_TAXES;

  const calculateItemSubtotal = () => {
    const subtotal = (item.quantity || 0) * (item.price || 0);
    const discount = item.discount?.value || 0;
    return subtotal - discount;
  };

  const calculateItemTotal = () => {
    const subtotal = calculateItemSubtotal();
    const taxAmount = calculateTaxes();
    return subtotal + taxAmount;
  };

  // Manejar cambio en los impuestos del ítem
  const handleTaxChange = (taxIds: string[]) => {
    onUpdate(item.id, 'taxes', taxIds);
  };

  // Manejar cambio en el checkbox de impuestos
  const handleTaxesCheckboxChange = (checked: boolean) => {
    if (!checked) {
      // Si se desactivan los impuestos, eliminamos todos los impuestos
      onUpdate(item.id, 'taxes', []);
    }
    onUpdate(item.id, 'hasTaxes', checked);
  };

  // Calcular el total de impuestos para el ítem
  const calculateTaxes = () => {
    if (item.hasTaxes === false) return 0;
    
    const subtotal = calculateItemSubtotal();
    return (item.taxes || []).reduce((total, taxId) => {
      const tax = taxes.find(t => t.id === taxId);
      return total + (tax ? (subtotal * (tax.percentage / 100)) : 0);
    }, 0);
  };

  // Calcular detalles de impuestos para mostrar
  const calculateTaxDetails = () => {
    const subtotal = calculateItemSubtotal();
    const taxMap = new Map<string, {tax: Tax, amount: number}>();
    
    (item.taxes || []).forEach(taxId => {
      const tax = taxes.find(t => t.id === taxId);
      if (tax) {
        const amount = subtotal * (tax.percentage / 100);
        taxMap.set(tax.type, {
          tax,
          amount: (taxMap.get(tax.type)?.amount || 0) + amount
        });
      }
    });
    
    return Array.from(taxMap.values());
  };

  const taxDetails = calculateTaxDetails();
  const hasAnyTaxes = (item.taxes || []).length > 0;
  const itemTotal = calculateItemTotal();
  const itemTaxes = calculateTaxes();
  const itemSubtotal = calculateItemSubtotal();

  return (
    <div className="border rounded-lg p-4 space-y-4">
      <div className="flex items-center justify-between">
        <Badge variant="outline">Item {index + 1}</Badge>
        {!isLastItem && (
          <button
            type="button"
            onClick={() => onRemove(item.id)}
            className="text-red-500 hover:text-red-700 disabled:opacity-50"
            disabled={disabled}
          >
            <Trash2 className="h-4 w-4" />
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <div className="space-y-2">
          <Label>Tipo de Item</Label>
          <Select
            value={item.type}
            onValueChange={(value: 'product' | 'activo' | 'contable') => onUpdate(item.id, 'type', value)}
            disabled={disabled}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="product">🛍️ Producto</SelectItem>
              <SelectItem value="activo">🏢 Activo Fijo</SelectItem>
              <SelectItem value="contable">🏦 Cuenta Contable</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          {item.type === "product" && (
            <Autocomplete
              label="Código Producto"
              placeholder="Buscar producto..."
              apiEndpoint="/api/productos-lista"
              value={item.code}
              onSelect={(option) => {
                if (option) {
                  onUpdate(item.id, 'code', option.codigo || '');
                  onUpdate(item.id, 'description', option.nombre || '');
                  if (option.precio_base !== undefined) {
                    onUpdate(item.id, 'price', option.precio_base);
                  }
                  if (option.tiene_iva !== undefined) {
                    onUpdate(item.id, 'hasIVA', option.tiene_iva === true);
                  }
                }
              }}
              disabled={disabled}
              required
            />
          )}

          {item.type === "activo" && (
            <Autocomplete
              label="Código Activo Fijo"
              placeholder="Buscar activo fijo..."
              apiEndpoint="/api/activos-fijos"
              value={item.code}
              onSelect={(option) => {
                if (option) {
                  onUpdate(item.id, 'code', option.codigo || '');
                  onUpdate(item.id, 'description', option.nombre || '');
                  if (option.precio_base) {
                    onUpdate(item.id, 'price', option.precio_base);
                  }
                  if (option.tiene_iva !== undefined) {
                    onUpdate(item.id, 'hasIVA', option.tiene_iva);
                  }
                }
              }}
              disabled={disabled}
              required
            />
          )}

          {item.type === "contable" && (
            <Autocomplete
              label="Código Cuenta Contable"
              placeholder="Buscar cuenta contable..."
              apiEndpoint="/api/cuentas-contables"
              value={item.code}
              onSelect={(option) => {
                if (option) {
                  onUpdate(item.id, 'code', option.codigo || '');
                  onUpdate(item.id, 'description', option.nombre || '');
                }
              }}
              disabled={disabled}
              required
            />
          )}
        </div>

        <div className="space-y-2">
          <Label>Descripción</Label>
          <Input
            value={item.description}
            onChange={(e) => onUpdate(item.id, 'description', e.target.value)}
            placeholder="Descripción del item"
            disabled={disabled}
            required
          />
        </div>

        <div className="space-y-2">
          <Label>Cantidad</Label>
          <NumberInput
            value={item.quantity}
            onChange={(value) => onUpdate(item.id, 'quantity', value === '' ? 1 : Number(value))}
            min={1}
            step={1}
            allowEmpty={false}
            placeholder="1"
            disabled={disabled}
          />
        </div>

        <div className="space-y-2">
          <Label>Precio Unitario</Label>
          <NumberInput
            value={item.price}
            onChange={(value) => onUpdate(item.id, 'price', value === '' ? 0 : Number(value))}
            min={0}
            step={0.01}
            allowEmpty={true}
            placeholder="0.00"
            disabled={disabled}
          />
        </div>

        <div className="space-y-2">
          <Label>Descuento</Label>
          <NumberInput
            value={item.discount?.value || 0}
            onChange={(value) => {
              const numValue = value === '' ? 0 : Number(value);
              onUpdate(item.id, 'discount', { 
                ...item.discount, 
                value: numValue 
              });
            }}
            min={0}
            step={0.01}
            allowEmpty={true}
            placeholder="0.00"
            disabled={disabled}
          />
        </div>

        <div className="space-y-2">
          <div className="flex items-center space-x-2">
            <Checkbox
              id={`taxes-${item.id}`}
              checked={item.hasTaxes !== false}
              onCheckedChange={(checked) => handleTaxesCheckboxChange(checked as boolean)}
              disabled={disabled}
            />
            <Label htmlFor={`taxes-${item.id}`} className="text-sm font-medium">
              Este artículo tiene impuestos
            </Label>
          </div>
          {item.hasTaxes !== false && item.taxes && item.taxes.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-1">
              {item.taxes.map(taxId => {
                const tax = taxes.find(t => t.id === taxId);
                if (!tax) return null;
                const amount = calculateItemSubtotal() * (tax.percentage / 100);
                return (
                  <div key={taxId} className="text-xs text-muted-foreground">
                    {tax.name} ({tax.percentage}%): ${amount.toFixed(2)}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {item.hasTaxes !== false && (
          <div className="space-y-2">
            <Label>Impuestos</Label>
            <TaxSelector
              selectedTaxes={item.taxes || []}
              onTaxChange={handleTaxChange}
              taxes={taxes}
              disabled={disabled}
            />
            {hasAnyTaxes && (
              <div className="mt-2 space-y-1">
                {taxDetails.map(({tax, amount}) => (
                  <div key={tax.id} className="text-xs text-muted-foreground">
                    {tax.name} ({tax.percentage}%): ${amount.toFixed(2)}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      <div className="bg-muted p-3 rounded-md">
        <div className="space-y-2">
          {(item.taxes || []).length > 0 && (
            <div className="space-y-1">
              {item.taxes?.map(taxId => {
                const tax = taxes.find(t => t.id === taxId);
                if (!tax) return null;
                const taxAmount = calculateItemSubtotal() * (tax.percentage / 100);
                
                return (
                  <div key={taxId} className="flex justify-between items-center">
                    <span className="text-sm">{tax.name} ({tax.percentage}%):</span>
                    <span className="text-sm font-medium">
                      ${taxAmount.toLocaleString("es-CO", { 
                        minimumFractionDigits: 2 
                      })} COP
                    </span>
                  </div>
                );
              })}
            </div>
          )}
          
          <div className="flex justify-between items-center border-t pt-2">
            <span className="text-sm font-bold">Total:</span>
            <span className="text-sm font-bold text-green-600">
              ${calculateItemTotal().toLocaleString("es-CO", { 
                minimumFractionDigits: 2 
              })} COP
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}