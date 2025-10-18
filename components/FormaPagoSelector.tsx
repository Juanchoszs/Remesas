'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Plus, X } from 'lucide-react';

type Cuenta = {
  id: string;
  name: string;
  type: 'bank' | 'cash';
  number: string;
  balance?: number;
};

type Pago = {
  id: string;
  tipo: 'cuenta' | 'anticipo';
  cuentaId: string;
  monto: number;
  nombre: string;
  saldoDisponible?: number;
};

export function FormaPagoSelector({
  total,
  clienteId,
  onPagosChange,
  className,
}: {
  total: number;
  clienteId?: string;
  onPagosChange: (pagos: Array<{ id: string; value: number }>) => void;
  className?: string;
}) {
  const [cuentas, setCuentas] = useState<Cuenta[]>([]);
  const [pagos, setPagos] = useState<Pago[]>([]);
  const [cuentaSeleccionada, setCuentaSeleccionada] = useState('');
  const [monto, setMonto] = useState('');
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState('');

  // Cargar métodos de pago al montar el componente
  useEffect(() => {
    const cargarMetodosPago = async () => {
      try {
        setCargando(true);
        // Obtener métodos de pago de Siigo
        const res = await fetch('/api/siigo/payment-methods');
        const { data, error } = await res.json();
        
        if (error) throw new Error(error);
        
        // Mapear los métodos de pago al formato de cuentas
        const metodosPago: Cuenta[] = [];
        
        if (Array.isArray(data)) {
          data.forEach((mp: any) => {
            if (mp && mp.id && mp.name) {
              const tipo: 'bank' | 'cash' = mp.type === 'Cartera' ? 'cash' : 'bank';
              metodosPago.push({
                id: mp.id.toString(),
                name: mp.name,
                type: tipo,
                number: mp.id.toString()
              });
            }
          });
        }
        
        setCuentas(metodosPago);
      } catch (err) {
        console.error('Error cargando métodos de pago:', err);
        setError('No se pudieron cargar los métodos de pago. Intente de nuevo.');
      } finally {
        setCargando(false);
      }
    };

    cargarMetodosPago();
  }, []);

  // Notificar cambios en los pagos
  useEffect(() => {
    onPagosChange(
      pagos.map(p => ({
        id: p.cuentaId,
        value: p.monto,
        type: p.tipo,
      }))
    );
  }, [pagos, onPagosChange]);

  const agregarPago = () => {
    if (!cuentaSeleccionada || !monto) return;
    
    const montoNum = parseFloat(monto);
    if (isNaN(montoNum) || montoNum <= 0) {
      setError('El monto debe ser mayor a 0');
      return;
    }

    const cuenta = cuentas.find(c => c.id === cuentaSeleccionada);
    if (!cuenta) return;

    // Verificar que no se exceda el total
    const totalPagado = pagos.reduce((sum, p) => sum + p.monto, 0);
    if (totalPagado + montoNum > total) {
      setError('El monto total excede el valor de la factura');
      return;
    }

    const nuevoPago: Pago = {
      id: `pago-${Date.now()}`,
      tipo: 'cuenta',
      cuentaId: cuenta.id,
      monto: montoNum,
      nombre: cuenta.name,
      saldoDisponible: cuenta.balance
    };

    setPagos([...pagos, nuevoPago]);
    setMonto('');
    setCuentaSeleccionada('');
    setError('');
  };

  const eliminarPago = (id: string) => {
    setPagos(pagos.filter(p => p.id !== id));
  };

  const totalPagado = pagos.reduce((sum, p) => sum + p.monto, 0);
  const saldoPendiente = total - totalPagado;

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle>Formas de pago</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {/* Resumen de pagos */}
          <div className="grid grid-cols-3 gap-4 mb-4">
            <div>
              <p className="text-sm text-muted-foreground">Total factura</p>
              <p className="text-lg font-semibold">${total.toLocaleString()}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Total pagado</p>
              <p className="text-lg font-semibold text-green-600">${totalPagado.toLocaleString()}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Saldo pendiente</p>
              <p className={`text-lg font-semibold ${saldoPendiente > 0 ? 'text-orange-500' : 'text-green-600'}`}>
                ${saldoPendiente.toLocaleString()}
              </p>
            </div>
          </div>

          {/* Lista de pagos agregados */}
          {pagos.length > 0 && (
            <div className="space-y-2">
              <h4 className="text-sm font-medium">Pagos registrados:</h4>
              <div className="border rounded-md divide-y">
                {pagos.map(pago => (
                  <div key={pago.id} className="p-3 flex justify-between items-center">
                    <div>
                      <p className="font-medium">{pago.nombre}</p>
                      {pago.saldoDisponible !== undefined && (
                        <p className="text-xs text-muted-foreground">
                          Saldo: ${pago.saldoDisponible?.toLocaleString()}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center space-x-2">
                      <span className="font-medium">${pago.monto.toLocaleString()}</span>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6"
                        onClick={() => eliminarPago(pago.id)}
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Formulario para agregar pago */}
          <div className="space-y-4 pt-2">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="cuenta">Cuenta</Label>
                <Select 
                  value={cuentaSeleccionada}
                  onValueChange={setCuentaSeleccionada}
                  disabled={cargando}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Seleccione una cuenta" />
                  </SelectTrigger>
                  <SelectContent>
                    {cuentas.map(cuenta => (
                      <SelectItem key={cuenta.id} value={cuenta.id}>
                        <div className="flex items-center justify-between">
                          <span>{cuenta.name}</span>
                          <Badge variant="outline" className="ml-2">
                            {cuenta.type === 'bank' ? 'Banco' : 'Efectivo'}
                          </Badge>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="monto">Monto</Label>
                <Input
                  id="monto"
                  type="number"
                  placeholder="0.00"
                  value={monto}
                  onChange={(e) => setMonto(e.target.value)}
                  min="0.01"
                  step="0.01"
                  disabled={!cuentaSeleccionada || cargando}
                />
              </div>

              <div className="flex items-end">
                <Button 
                  type="button" 
                  onClick={agregarPago}
                  disabled={!cuentaSeleccionada || !monto || cargando}
                  className="w-full"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Agregar pago
                </Button>
              </div>
            </div>

            {error && (
              <p className="text-sm text-red-500">{error}</p>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
