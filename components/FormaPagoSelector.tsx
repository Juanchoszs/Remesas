'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Plus, X } from 'lucide-react';

export interface PagoSiigo {
  id: number;
  name: string;
  value: number;
  due_date: string;
  payment_method_id: number;
}

interface MetodoPago {
  id: number;
  name: string;
  active: boolean;
}

interface FormaPagoSelectorProps {
  total: number;
  onPagosChange: (pagos: PagoSiigo[]) => void;
  className?: string;
  documentType?: 'FC' | 'FV' | 'RC';
}

export function FormaPagoSelector({ 
  total, 
  onPagosChange, 
  className = '', 
  documentType = 'FC' 
}: FormaPagoSelectorProps) {
  // Estado para depuración
  const [debugInfo, setDebugInfo] = useState('');
  const [pagos, setPagos] = useState<PagoSiigo[]>([]);
  const [metodoPagoId, setMetodoPagoId] = useState<string>('');
  const [monto, setMonto] = useState<string>('');
  const [metodosPago, setMetodosPago] = useState<MetodoPago[]>([]);
  const [cargando, setCargando] = useState<boolean>(false);
  const [error, setError] = useState<string>('');

  // Cargar métodos de pago al montar el componente
  useEffect(() => {
    const cargarMetodosPago = async () => {
      try {
        setCargando(true);
        const res = await fetch('/api/siigo/payment-methods');
        const { data, error } = await res.json();
        
        if (error) throw new Error(error);
        setMetodosPago(data?.filter((m: any) => m.active) || []);
      } catch (err) {
        console.error('Error cargando métodos de pago:', err);
        setError('No se pudieron cargar los métodos de pago');
      } finally {
        setCargando(false);
      }
    };

    cargarMetodosPago();
  }, []);

  // Notificar cambios en los pagos
  useEffect(() => {
    console.log('Pagos actualizados en FormaPagoSelector:', pagos);
    const debugMsg = `Pagos actualizados: ${JSON.stringify(pagos, null, 2)}`;
    setDebugInfo(debugMsg);
    onPagosChange(pagos);
  }, [pagos, onPagosChange]);

  const agregarPago = () => {
    console.log('Agregando pago...', { metodoPagoId, monto });
    
    if (!metodoPagoId || !monto) {
      const errorMsg = 'Seleccione un método de pago y un monto';
      console.error(errorMsg);
      setError(errorMsg);
      return;
    }

    const montoNum = parseFloat(monto);
    if (isNaN(montoNum) || montoNum <= 0) {
      setError('El monto debe ser mayor a 0');
      return;
    }

    const metodo = metodosPago.find(m => m.id.toString() === metodoPagoId);
    if (!metodo) {
      setError('Método de pago no válido');
      return;
    }

    // Verificar que no se exceda el total
    const totalPagado = pagos.reduce((sum, p) => sum + p.value, 0);
    if (totalPagado + montoNum > total) {
      setError('El monto total excede el valor de la factura');
      return;
    }

    const nuevoPago: PagoSiigo = {
      id: metodo.id,
      name: metodo.name,
      value: montoNum,
      due_date: new Date().toISOString().split('T')[0],
      payment_method_id: metodo.id
    };

    const nuevosPagos = [...pagos, nuevoPago];
    console.log('Nuevo pago agregado:', nuevoPago);
    console.log('Total de pagos después de agregar:', nuevosPagos);
    
    setPagos(nuevosPagos);
    setMonto('');
    setMetodoPagoId('');
    setError('');
    
    // Forzar actualización del estado
    onPagosChange(nuevosPagos);
  };

  const eliminarPago = (id: number) => {
    const nuevosPagos = pagos.filter(p => p.id !== id);
    console.log('Eliminando pago ID:', id);
    console.log('Pagos después de eliminar:', nuevosPagos);
    setPagos(nuevosPagos);
    // Forzar actualización del estado
    onPagosChange(nuevosPagos);
  };

  const totalPagado = pagos.reduce((sum, p) => sum + p.value, 0);
  const saldoPendiente = total - totalPagado;

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle>Forma de Pago</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label>Método de Pago</Label>
          <Select
            value={metodoPagoId}
            onValueChange={setMetodoPagoId}
            disabled={cargando}
          >
            <SelectTrigger>
              <SelectValue placeholder="Seleccione un método de pago" />
            </SelectTrigger>
            <SelectContent>
              {metodosPago.map((metodo) => (
                <SelectItem key={metodo.id} value={metodo.id.toString()}>
                  {metodo.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label>Monto</Label>
          <Input
            type="number"
            value={monto}
            onChange={(e) => setMonto(e.target.value)}
            placeholder="Ingrese el monto"
            min="0.01"
            step="0.01"
            disabled={cargando}
          />
        </div>

        <Button
          type="button"
          onClick={agregarPago}
          disabled={!metodoPagoId || !monto || cargando}
          className="w-full"
        >
          <Plus className="h-4 w-4 mr-2" />
          Agregar Pago
        </Button>

        {error && <p className="text-sm text-red-500">{error}</p>}

        {pagos.length > 0 && (
          <div className="mt-4 space-y-2">
            <h4 className="font-medium">Pagos Agregados:</h4>
            <div className="space-y-2">
              {pagos.map((pago) => (
                <div
                  key={`${pago.id}-${pago.value}`}
                  className="flex items-center justify-between p-2 border rounded"
                >
                  <div>
                    <p className="font-medium">{pago.name}</p>
                    <p className="text-sm text-gray-500">
                      ${pago.value.toLocaleString()} - {pago.due_date}
                    </p>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => eliminarPago(pago.id)}
                    className="text-red-500 hover:text-red-700"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="pt-4 border-t">
          <div className="flex justify-between">
            <span>Total Factura:</span>
            <span className="font-medium">${total.toLocaleString()}</span>
          </div>
          <div className="flex justify-between">
            <span>Total Pagado:</span>
            <span className="font-medium">${totalPagado.toLocaleString()}</span>
          </div>
          <div className="flex justify-between font-bold">
            <span>Saldo Pendiente:</span>
            <span className={saldoPendiente > 0 ? 'text-orange-500' : 'text-green-500'}>
              ${saldoPendiente.toLocaleString()}
            </span>
          </div>
        </div>
        
        {/* Sección de depuración */}
        {process.env.NODE_ENV === 'development' && (
          <div className="mt-4 p-2 bg-gray-100 rounded text-xs text-gray-600">
            <h4 className="font-bold mb-1">Depuración:</h4>
            <pre className="whitespace-pre-wrap">{debugInfo}</pre>
          </div>
        )}
      </CardContent>
    </Card>
  );
}