'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/components/ui/use-toast';

interface PaymentMethod {
  id: number;
  name: string;
  type: string;
  active: boolean;
  due_date: boolean;
}

interface FormaPagoSelectorProps {
  onPagosChange: (pagos: Array<{ id: string; value: number; metodo: string; paymentMethodId: number }>) => void;
  total: number;
  className?: string;
  documentType?: 'FV' | 'NC' | 'ND' | 'RC' | 'DS' | 'CE' | 'FC' | 'NI';
}

export function FormaPagoSelector({ onPagosChange, total, className = '', documentType = 'FV' }: FormaPagoSelectorProps) {
  const [metodosPago, setMetodosPago] = useState<PaymentMethod[]>([]);
  const [pagos, setPagos] = useState<Array<{ id: string; value: number; metodo: string; paymentMethodId: number }>>([]);
  const [metodoPagoId, setMetodoPagoId] = useState<string>('');
  const [monto, setMonto] = useState<string>('');
  const [cargando, setCargando] = useState(true);
  const { toast } = useToast();

  // Cargar métodos de pago desde Siigo
  useEffect(() => {
    const cargarMetodosPago = async () => {
      try {
        setCargando(true);
        const docType = documentType; // Usamos el documentType de las props
        
        // Limpiar métodos de pago anteriores
        setMetodosPago([]);
        
        // Hacer la petición con el parámetro document_type
        const res = await fetch(`/api/siigo/payment-methods?document_type=${encodeURIComponent(docType)}`, {
          cache: 'no-store' // Evitar caché para obtener siempre datos frescos
        });
        
        if (!res.ok) {
          const errorText = await res.text();
          console.error('Error response:', errorText);
          throw new Error('Error al cargar los métodos de pago');
        }
        
        const result = await res.json();
        
        if (!result.success) {
          throw new Error(result.error || 'Error al procesar la respuesta');
        }
        
        if (result.error) throw new Error(result.error);
        
        if (Array.isArray(result.data)) {
          // Filtrar solo los métodos de pago activos
          const metodosActivos = result.data.filter((m: PaymentMethod) => m.active);
          
          // Ordenar los métodos de pago por nombre para mejor visualización
          metodosActivos.sort((a: PaymentMethod, b: PaymentMethod) => 
            a.name.localeCompare(b.name)
          );
          
          setMetodosPago(metodosActivos);
          
          // Seleccionar el primer método por defecto si existe
          if (metodosActivos.length > 0) {
            setMetodoPagoId(metodosActivos[0].id.toString());
          }
        }
      } catch (err) {
        console.error('Error cargando métodos de pago:', err);
        toast({
          title: 'Error',
          description: 'No se pudieron cargar los métodos de pago',
          variant: 'destructive',
        });
      } finally {
        setCargando(false);
      }
    };

    cargarMetodosPago();
  }, [toast]);

  const handleAddPago = () => {
    const montoNum = parseFloat(monto);
    if (!monto || isNaN(montoNum) || montoNum <= 0) {
      toast({
        title: 'Error',
        description: 'Ingrese un monto válido',
        variant: 'destructive',
      });
      return;
    }

    const metodoSeleccionado = metodosPago.find(m => m.id.toString() === metodoPagoId);
    if (!metodoSeleccionado) {
      toast({
        title: 'Error',
        description: 'Seleccione un método de pago válido',
        variant: 'destructive',
      });
      return;
    }

    const totalPagado = pagos.reduce((sum, pago) => sum + pago.value, 0);
    if (totalPagado + montoNum > total) {
      toast({
        title: 'Error',
        description: 'El monto total excede el valor de la factura',
        variant: 'destructive',
      });
      return;
    }

    const nuevoPago = {
      id: `pago-${Date.now()}`,
      value: montoNum,
      metodo: metodoSeleccionado.name,
      paymentMethodId: metodoSeleccionado.id
    };

    setPagos([...pagos, nuevoPago]);
    setMonto('');
  };

  const handleRemovePago = (id: string) => {
    setPagos(pagos.filter(pago => pago.id !== id));
  };

  useEffect(() => {
    onPagosChange(pagos);
  }, [pagos, onPagosChange]);

  const totalPagado = pagos.reduce((sum, pago) => sum + pago.value, 0);
  const saldoPendiente = total - totalPagado;

  if (cargando) {
    return <div className="p-4 text-center text-muted-foreground">Cargando métodos de pago...</div>;
  }

  if (metodosPago.length === 0 && !cargando) {
    return (
      <div className="p-4 border rounded-md bg-yellow-50 text-yellow-800">
        <p>No se encontraron métodos de pago configurados en Siigo.</p>
        <p className="text-sm mt-2">Por favor, configura los métodos de pago en Siigo primero.</p>
      </div>
    );
  }

  return (
    <div className={`space-y-4 ${className}`}>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div>
          <Label>Método de pago</Label>
          <Select 
            value={metodoPagoId} 
            onValueChange={setMetodoPagoId}
            disabled={metodosPago.length === 0}
          >
            <SelectTrigger>
              <SelectValue placeholder={metodosPago.length === 0 ? "No hay métodos disponibles" : "Seleccione un método"} />
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
        <div>
          <Label>Monto</Label>
          <Input
            type="number"
            value={monto}
            onChange={(e) => setMonto(e.target.value)}
            placeholder="Ingrese el monto"
            min="0.01"
            step="0.01"
          />
        </div>
        <div className="flex items-end">
          <Button 
            onClick={handleAddPago} 
            className="w-full"
            disabled={!monto || parseFloat(monto) <= 0 || !metodoPagoId || metodosPago.length === 0}
          >
            Agregar pago
          </Button>
        </div>
      </div>

      {pagos.length > 0 && (
        <div className="mt-4">
          <h4 className="font-medium mb-2">Pagos registrados:</h4>
          <div className="space-y-2">
            {pagos.map((pago) => (
              <div key={pago.id} className="flex justify-between items-center p-2 border rounded">
                <span>{pago.metodo}: ${pago.value.toFixed(2)}</span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleRemovePago(pago.id)}
                  className="text-red-500 hover:text-red-600"
                >
                  Eliminar
                </Button>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-4">
        <div>
          <p className="text-sm text-muted-foreground">Total factura</p>
          <p className="text-lg font-semibold">${total.toFixed(2)}</p>
        </div>
        <div>
          <p className="text-sm text-muted-foreground">Total pagado</p>
          <p className="text-lg font-semibold text-green-600">${totalPagado.toFixed(2)}</p>
        </div>
        <div>
          <p className="text-sm text-muted-foreground">Saldo pendiente</p>
          <p className={`text-lg font-semibold ${
            saldoPendiente > 0 ? 'text-orange-500' : 'text-green-600'
          }`}>
            ${Math.max(0, saldoPendiente).toFixed(2)}
          </p>
        </div>
      </div>
    </div>
  );
}
