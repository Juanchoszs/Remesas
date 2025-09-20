import * as React from 'react';
import { useReducer, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { InvoiceItem } from "@/types/siigo";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from '@/components/ui/separator';
import { Autocomplete, type AutocompleteOption } from '@/components/autocomplete';
import { InvoiceItemForm } from "./formulario-item-facturas";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { toast } from "sonner";
import { 
  Send, 
  Plus, 
  CheckCircle2 as CheckCircledIcon, 
  AlertTriangle as ExclamationTriangleIcon 
} from 'lucide-react';

// Constantes de configuración para Siigo
const SIIGO_CONFIG = {
  // Tipos de documentos
  DOCUMENT_TYPES: {
    PURCHASE_INVOICE: 24445, // Factura de compra
    SALE_INVOICE: 24446,    // Factura de venta
    CREDIT_NOTE: 24447,     // Nota crédito
    DEBIT_NOTE: 24448       // Nota débito
  },
  
  // Tipos de identificación
  ID_TYPES: {
    NIT: '31',
    CEDULA: '13',
    CEDULA_EXTRANJERIA: '22',
    PASAPORTE: '41',
    NIT_OTRO_PAIS: '50',
    NIT_EXTRANJERO: '91'
  },
  
  // Impuestos
  TAXES: {
    IVA_19: {
      id: 1,      // ID del impuesto de IVA 19% en Siigo
      name: 'IVA 19%',
      percentage: 19,
      type: 'IVA'
    },
    IVA_5: {
      id: 2,      // ID del impuesto de IVA 5% en Siigo
      name: 'IVA 5%',
      percentage: 5,
      type: 'IVA'
    },
    IVA_0: {
      id: 3,      // ID del impuesto de IVA 0% en Siigo
      name: 'IVA 0%',
      percentage: 0,
      type: 'IVA'
    }
  },
  
  // Métodos de pago
  PAYMENT_METHODS: [
    { id: '1', name: 'Contado' },
    { id: '2', name: 'Crédito 30 días' },
    { id: '3', name: 'Crédito 60 días' },
    { id: '4', name: 'Crédito 90 días' },
    { id: '5', name: 'Tarjeta de crédito' },
    { id: '6', name: 'Transferencia bancaria' },
    { id: '7', name: 'Efectivo' },
    { id: '8', name: 'Cheque' }
  ],
  
  // Monedas
  CURRENCIES: [
    { code: 'COP', name: 'Peso Colombiano' },
    { code: 'USD', name: 'Dólar Estadounidense' },
    { code: 'EUR', name: 'Euro' }
  ],
  
  // Centros de costo (deben coincidir con los configurados en Siigo)
  COST_CENTERS: [
    { id: '1', name: 'Ventas' },
    { id: '2', name: 'Compras' },
    { id: '3', name: 'Administrativo' },
    { id: '4', name: 'Producción' },
    { id: '5', name: 'Logística' }
  ],
  
  // Vendedores configurados en Siigo con sus correos
  SELLERS: [
    { 
      id: 1, 
      name: 'Guille Hernan Valencia Mahecha',
      email: 'guille@remesasymensajes.com',
      username: 'guille@remesasymensajes.com'
    },
    { 
      id: 2, 
      name: 'AUXILIAR CONTABLE',
      email: 'auxadmon@remesasymensajes.com',
      username: 'auxadmon@remesasymensajes.com'
    },
    { 
      id: 3, 
      name: 'YANIRA DURAN',
      email: 'rh@remesasymensajes.com',
      username: 'rh@remesasymensajes.com'
    }
  ]
} as const;

// Interfaz para clientes (compatible con proveedores)
interface Customer {
  // Campos compartidos con proveedores
  id?: string;
  codigo: string;
  identificacion: string;
  nombre: string;
  name: string[];
  direccion?: string;
  ciudad?: string;
  telefono?: string;
  correo_electronico?: string;
  tipo_documento?: string;
  nombre_comercial?: string;
  branch_office?: number;
  
  // Campos específicos de clientes
  person_type?: 'Person' | 'Company';
  id_type?: string;
  
  // Dirección estructurada (opcional, para facturación)
  address?: {
    address: string;
    city: {
      country_code: string;
      country_name: string;
      state_code: string;
      state_name: string;
      city_code: string;
      city_name: string;
    };
    postal_code: string;
  };
  
  // Teléfonos (opcional)
  phones?: Array<{
    indicative: string;
    number: string;
    extension?: string;
  }>;
}

interface Provider {
  id?: string;
  codigo?: string;
  nombre?: string;
  name?: string;
  branch_office?: number;
  type?: string;
  identificacion?: string;
  tipo_documento?: string;
  nombre_comercial?: string;
  ciudad?: string;
  direccion?: string;
  telefono?: string;
  correo_electronico?: string;
}

type InvoiceType = 'purchase' | 'sale';

interface InvoiceState {
  invoiceType: InvoiceType;
  provider: Provider | null;
  customer: Customer | null;
  items: InvoiceItem[];
  invoiceDate: string;
  documentId: string;
  providerInvoiceNumber: string;
  providerInvoicePrefix: string;
  observations: string;
  ivaPercentage: number;
  providerCode: string;
  providerIdentification: string;
  costCenter: string;
  cufe?: string;
  currency?: string;
  seller?: number;
  paymentMethod?: string;
  dueDate?: string;
  stamp?: {
    send: boolean;
  };
  mail?: {
    send: boolean;
  };
}

type InvoiceFormAction =
  | { type: 'SET_INVOICE_TYPE'; payload: InvoiceType }
  | { type: 'ADD_ITEM'; payload: InvoiceItem }
  | { type: 'REMOVE_ITEM'; payload: string }
  | {
      type: 'UPDATE_ITEM';
      payload: { 
        id: string; 
        field: keyof InvoiceItem; 
        value: string | number | boolean | { type?: string; value?: number } | undefined;
      };
    }
  | {
      type: 'UPDATE_FIELD';
      payload: (
        | { field: 'invoiceDate' | 'documentId' | 'providerInvoiceNumber' | 'providerInvoicePrefix' | 'observations' | 'providerCode' | 'providerIdentification' | 'cufe' | 'paymentMethod' | 'dueDate'; value: string }
        | { field: 'costCenter'; value: string }
        | { field: 'ivaPercentage' | 'seller'; value: number }
        | { field: 'currency'; value: string | undefined }
        | { field: 'stamp' | 'mail'; value: { send: boolean } }
      );
    }
  | { type: 'SET_PROVIDER'; payload: Provider | null }
  | { type: 'SET_CUSTOMER'; payload: Customer | null }
  | { type: 'SET_DOCUMENT_ID'; payload: string }
  | { type: 'SET_PROVIDER_INVOICE_NUMBER'; payload: string }
  | { type: 'SET_CUFE'; payload: string }
  | { type: 'SET_CURRENCY'; payload: string }
  | { type: 'RESET_FORM' };

// El tipo facturas formlario se define arriba 

// Funcion utilmem reduct
const calculateSubtotal = (items: InvoiceItem[]): number => {
  return items.reduce((sum, item) => {
    const itemSubtotal = (item.quantity || 0) * (item.price || 0);
    const discount = item.discount?.value || 0;
    return sum + (itemSubtotal - discount);
  }, 0);
};

const calculateIVA = (items: InvoiceItem[], ivaPercentage: number): number => {
  return items.reduce((sum, item) => {
    if (!item.hasIVA) return sum;
    const itemSubtotal = (item.quantity || 0) * (item.price || 0);
    const discount = item.discount?.value || 0;
    const taxableAmount = itemSubtotal - discount;
    return sum + (taxableAmount * (ivaPercentage / 100));
  }, 0);
};

const calculateTotal = (items: InvoiceItem[], ivaPercentage: number): number => {
  const subtotal = calculateSubtotal(items);
  const iva = calculateIVA(items, ivaPercentage);
  return subtotal + iva;
};

const mapItemTypeToSiigoType = (type: string = 'product'): 'Product' | 'Service' | 'FixedAsset' => {
  switch (type) {
    case 'product': return 'Product';
    case 'service': return 'Service';
    case 'fixed-asset': return 'FixedAsset';
    default: return 'Product';
  }
};

// incializar el estado
const initialState: InvoiceState = {
  invoiceType: 'purchase',
  provider: null,
  customer: null,
  items: [],
  invoiceDate: new Date().toISOString().split('T')[0],
  documentId: '',
  providerInvoiceNumber: '',
  providerInvoicePrefix: 'FC',
  observations: '',
  ivaPercentage: SIIGO_CONFIG.TAXES.IVA_19.percentage,
  providerCode: '',
  providerIdentification: '',
  costCenter: '1',
  currency: 'COP',
  seller: 1, // ID del vendedor por defecto
  paymentMethod: SIIGO_CONFIG.PAYMENT_METHODS[0].id, // Método de pago por defecto (el primero de la lista)
  dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], // 30 días a partir de hoy
  stamp: { send: true },
  mail: { send: true }
};

const invoiceFormReducer = (state: InvoiceState, action: InvoiceFormAction): InvoiceState => {
  switch (action.type) {
    case 'SET_INVOICE_TYPE':
      return {
        ...state,
        invoiceType: action.payload,
        // Resetear los campos específicos del tipo de factura
        provider: action.payload === 'purchase' ? state.provider : null,
        customer: action.payload === 'sale' ? state.customer : null,
        providerInvoicePrefix: action.payload === 'purchase' ? 'FC' : 'FV'
      };
    case 'ADD_ITEM':
      return { ...state, items: [...state.items, action.payload] };
    case 'REMOVE_ITEM':
      return { ...state, items: state.items.filter(item => item.id !== action.payload) };
    case 'UPDATE_ITEM':
      return {
        ...state,
        items: state.items.map(item =>
          item.id === action.payload.id
            ? { ...item, [action.payload.field]: action.payload.value }
            : item
        ),
      };
    case 'UPDATE_FIELD':
      return { ...state, [action.payload.field]: action.payload.value };
    case 'SET_PROVIDER':
      return {
        ...state,
        provider: action.payload,
        providerCode: action.payload?.codigo || '',
        providerIdentification: action.payload?.identificacion || ''
      };
    case 'SET_CUSTOMER':
      return {
        ...state,
        customer: action.payload
      };
    case 'SET_DOCUMENT_ID':
      return { ...state, documentId: action.payload };
    case 'SET_PROVIDER_INVOICE_NUMBER':
      return { ...state, providerInvoiceNumber: action.payload };
    case 'SET_CUFE':
      return { ...state, cufe: action.payload };
    case 'SET_CURRENCY':
      return { ...state, currency: action.payload };
    case 'RESET_FORM':
      return { ...initialState };
    default:
      return state;
  }
};

export default function InvoiceForm() {
  const router = useRouter();
  const [state, dispatch] = useReducer(invoiceFormReducer, initialState);
// El estado de carga no se utiliza actualmente, pero se guarda para uso futuro.
// eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [_, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitResult, setSubmitResult] = useState<{ success: boolean; message: string } | null>(null);

  const handleAddItem = useCallback(() => {
    const newItem: InvoiceItem = {
      id: Date.now().toString(),
// ... (el resto del código sigue siendo el mismo)
      type: 'product',
      code: '',
      description: '',
      quantity: 1,
      price: 0,
      warehouse: '1',
      hasIVA: true,
    };
    dispatch({ type: 'ADD_ITEM', payload: newItem });
  }, []);

  const handleProviderSelect = useCallback((option: AutocompleteOption | null) => {
    if (!option) {
      dispatch({ type: 'SET_PROVIDER', payload: null });
      return;
    }

    // Asignar AutocompleteOption al tipo de proveedor
    const provider: Provider = {
      id: option.codigo,
      nombre: option.nombre,
      identificacion: option.codigo,
      codigo: option.codigo,
      name: option.nombre,
      tipo_documento: '31',
      nombre_comercial: option.nombre,
      ciudad: 'Bogotá',
      direccion: 'No especificada',
      telefono: '0000000',
      correo_electronico: 'no@especificado.com',
      branch_office: 0,
      type: 'Proveedor'
    };

    dispatch({ type: 'SET_PROVIDER', payload: provider });
  }, []);

  const handleCustomerSelect = useCallback((option: AutocompleteOption | null) => {
    if (!option) {
      dispatch({ type: 'SET_CUSTOMER', payload: null });
      return;
    }

    // Reutilizamos la misma estructura de proveedor pero la adaptamos a cliente
    const customer: Customer = {
      id: option.codigo,
      codigo: option.codigo,
      identificacion: option.codigo,
      nombre: option.nombre,
      name: [option.nombre],
      person_type: 'Company',
      id_type: '31', // 31 es NIT en Siigo
      direccion: option.direccion,
      ciudad: option.ciudad,
      telefono: option.telefono,
      correo_electronico: option.correo_electronico,
      tipo_documento: '31',
      nombre_comercial: option.nombre,
      branch_office: 0,
      address: {
        address: option.direccion || 'No especificada',
        city: {
          country_code: 'CO',
          country_name: 'Colombia',
          state_code: '11',
          state_name: 'Bogotá D.C.',
          city_code: '11001',
          city_name: option.ciudad || 'Bogotá'
        },
        postal_code: '111111'
      },
      phones: [{
        indicative: '57',
        number: option.telefono || '0000000'
      }]
    };

    dispatch({ type: 'SET_CUSTOMER', payload: customer });
  }, []);

  const validateForm = useCallback((): string[] => {
    const errors: string[] = [];
    
    if (state.invoiceType === 'purchase' && !state.provider) {
      errors.push('Debe seleccionar un proveedor');
    } else if (state.invoiceType === 'sale' && !state.customer) {
      errors.push('Debe seleccionar un cliente');
    }
    
    if (!state.providerInvoiceNumber?.trim()) {
      errors.push('El número de factura es requerido');
    }
    
    if (state.items.length === 0) {
      errors.push('Debe agregar al menos un ítem');
    }
    
    // Validar items
    state.items.forEach((item: InvoiceItem, index: number) => {
      if (!item.code?.trim()) {
        errors.push(`Item ${index + 1}: Código es requerido`);
      }
      if (!item.description?.trim()) {
        errors.push(`Item ${index + 1}: Descripción es requerida`);
      }
      if (!item.quantity || item.quantity <= 0) {
        errors.push(`Item ${index + 1}: Cantidad debe ser mayor a 0`);
      }
      if (item.price === undefined || item.price < 0) {
        errors.push(`Item ${index + 1}: Precio no puede ser negativo`);
      }
    });
    
    return errors;
  }, [state]);

  // Define el tipo SiigoPaymentRequest ya que no se importa
interface SiigoPaymentRequest {
  // Agregue las propiedades reales según sus requisitos
  [key: string]: string | number | boolean | object | undefined | null;
}

const buildSiigoPayload = useCallback((): SiigoPaymentRequest => {
    const fechaFormateada = state.invoiceDate;
    
    // Determinar si es una factura de compra o venta
    if (state.invoiceType === 'purchase') {
      // Lógica para factura de compra
      const codigoProveedor = state.provider?.codigo || state.provider?.identificacion || '';
      const branchOffice = state.provider?.branch_office ?? 0;

    // Mapear los ítems al formato de Siigo
    const items = state.items.map((item: InvoiceItem) => {
      const itemSubtotal = (item.quantity || 0) * (item.price || 0);
      const discount = item.discount?.value || 0;
      const taxableAmount = itemSubtotal - discount;
      
      return {
        type: mapItemTypeToSiigoType(item.type),
        code: item.code,
        description: item.description || item.code,
        quantity: Number(item.quantity) || 1,
        price: Number(item.price) || 0,
        discount: discount,
        taxes: item.hasIVA ? [{
          id: 18384, // ID del impuesto IVA
          tax_base: taxableAmount,
          type: "IVA"
        }] : [],
        warehouse: item.warehouse || '1'
      };
    });

    const total = calculateTotal(state.items, state.ivaPercentage);

    const payment: SiigoPaymentRequest & { name: string } = {
      id: 8467, // ID real del método de pago, ajusta según tu configuración
      name: "OTROS",
      value: total,
      due_date: fechaFormateada
    };

      // Payload para factura de compra
      return {
        document: {
          id: 27524, // ID del tipo de documento en Siigo para factura de compra
        },
        date: fechaFormateada,
        supplier: {
          identificacion: String(codigoProveedor),
          branch_office: branchOffice
        },
        cost_center: state.costCenter,
        provider_invoice: {
          prefix: state.providerInvoicePrefix || "FC",
          number: state.providerInvoiceNumber ? String(Number(state.providerInvoiceNumber)) : null,
          ...(state.cufe && { cufe: state.cufe })
        },
        currency: state.currency,
        discount_type: "Value",
        supplier_by_item: false,
        tax_included: false,
        observations: state.observations || "",
        items,
        payments: [payment]
      };
    } else {
      // Lógica para factura de venta
      if (!state.customer) {
        throw new Error('Se requiere un cliente para la factura de venta');
      }
      
      // Calcular totales
      const subtotal = calculateSubtotal(state.items);
      const iva = calculateIVA(state.items, state.ivaPercentage);
      const total = subtotal + iva;
      
      // Mapear los ítems al formato de factura de venta
      const saleItems = state.items.map(item => ({
        code: item.code,
        description: item.description,
        quantity: item.quantity,
        price: item.price,
        discount: item.discount || 0,
        taxes: item.hasIVA ? [{
          id: SIIGO_CONFIG.TAXES.IVA_19.id,
          name: SIIGO_CONFIG.TAXES.IVA_19.name,
          type: SIIGO_CONFIG.TAXES.IVA_19.type,
          percentage: SIIGO_CONFIG.TAXES.IVA_19.percentage,
          value: (item.quantity * item.price * (SIIGO_CONFIG.TAXES.IVA_19.percentage / 100)) // IVA calculado
        }] : []
      }));
      
      // Payload para factura de venta
      return {
        document: {
          id: SIIGO_CONFIG.DOCUMENT_TYPES.SALE_INVOICE // Usamos la constante para el tipo de documento
        },
        date: fechaFormateada,
        customer: {
          person_type: state.customer.person_type || 'Company',
          id_type: state.customer.id_type || SIIGO_CONFIG.ID_TYPES.NIT, // Usamos la constante para el tipo de identificación
          identification: state.customer.identificacion, // Siigo espera 'identification' no 'identificacion'
          branch_office: 0,
          name: state.customer.name?.[0] || state.customer.nombre || 'Cliente sin nombre',
          ...(state.customer.direccion && { address: state.customer.direccion }),
          ...(state.customer.telefono && { phones: [{ number: state.customer.telefono }] })
          // Nota: Asegúrate de que estos campos coincidan con lo que espera la API de Siigo
        },
        seller: state.seller || 1,
        currency: {
          code: state.currency || 'COP',
          exchange_rate: 1 // Tasa de cambio por defecto
        },
        stamp: state.stamp || { send: true },
        mail: state.mail || { send: true },
        observations: state.observations || "",
        items: saleItems,
        payments: [{
          id: parseInt(state.paymentMethod || '1'),
          value: total,
          due_date: state.dueDate || fechaFormateada
        }],
        // globalDiscounts is not defined in the state type, so we'll comment it out for now
        // Uncomment and properly type it if needed
        // ...(state.globalDiscounts && { global_discounts: state.globalDiscounts })
      };
    }
  }, [state]);

  const handleSubmit = useCallback(async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsSubmitting(true);
    setSubmitResult(null);
    try {
      // Validar formulario
      const validationErrors = validateForm();
      if (validationErrors.length > 0) {
        toast.error('Errores en el formulario', {
          description: validationErrors.join(', ')
        });
        setIsSubmitting(false);
        return;
      }
      // Construir el payload robusto para SIIGO
      const payload = buildSiigoPayload();
      const endpoint = state.invoiceType === 'purchase' ? '/api/siigo/compras' : '/api/siigo/ventas';
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await response.json();
      if (!response.ok) {
        const siigoMsg = data?.details?.Message || data?.error || data?.message || 'Error desconocido';
        const missingFields = data?.missingFields ? `\nCampos faltantes: ${data.missingFields.join(', ')}` : '';
        toast.error('❌ Error al enviar la factura a Siigo', { description: siigoMsg + missingFields, duration: 8000 });
        setSubmitResult({ success: false, message: siigoMsg + missingFields });
        throw new Error(siigoMsg + missingFields);
      }
      toast.success('✅ Factura enviada correctamente a Siigo', {
        description: `Número de factura: ${data.number || data.data?.number || state.providerInvoiceNumber}`,
        duration: 5000,
      });
      setSubmitResult({ success: true, message: `Factura enviada correctamente. Número: ${data.number || data.data?.number || state.providerInvoiceNumber}` });
      dispatch({ type: 'RESET_FORM' });
      router.refresh();
    } catch (error) {
      let errorMessage = 'Error desconocido al enviar la factura';
      if (error instanceof Error) {
        errorMessage = error.message;
      } else if (typeof error === 'string') {
        errorMessage = error;
      }
      toast.error('❌ Error al enviar la factura', {
        description: errorMessage,
        duration: 6000,
      });
      setSubmitResult({ success: false, message: errorMessage });
    } finally {
      setIsSubmitting(false);
    }
  }, [state, validateForm, buildSiigoPayload, router]);

  const handleInvoiceTypeChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const invoiceType = e.target.value as InvoiceType;
    dispatch({ type: 'SET_INVOICE_TYPE', payload: invoiceType });
  };

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-6">
      {submitResult && (
        <Alert variant={submitResult.success ? 'default' : 'destructive'}>
          {submitResult.success ? (
            <CheckCircledIcon className="h-4 w-4" />
          ) : (
            <ExclamationTriangleIcon className="h-4 w-4" />
          )}
          <AlertTitle>
            {submitResult.success ? '¡Éxito!' : 'Error'}
          </AlertTitle>
          <AlertDescription>{submitResult.message}</AlertDescription>
        </Alert>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        <Card>
          <CardHeader>
            <div className="flex justify-between items-center">
              <div>
                <CardTitle>Crear Nueva Factura</CardTitle>
                <CardDescription>
                  Complete los detalles de la factura a continuación.
                </CardDescription>
              </div>
              <div className="w-64">
                <Label htmlFor="invoice-type">Tipo de Factura *</Label>
                <select
                  id="invoice-type"
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                  value={state.invoiceType}
                  onChange={handleInvoiceTypeChange}
                  disabled={isSubmitting || state.items.length > 0}
                  required
                >
                  <option value="purchase">Factura de Compra</option>
                  <option value="sale">Factura de Venta</option>
                </select>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {state.invoiceType === 'purchase' ? (
                <>
                  <div className="space-y-2">
                    <Autocomplete
                      label="Proveedor"
                      placeholder="Buscar proveedor..."
                      apiEndpoint="/api/proveedores"
                      value={state.provider?.nombre || ""}
                      onSelect={handleProviderSelect}
                      disabled={isSubmitting}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="provider-code">Código de Proveedor *</Label>
                    <Input
                      id="provider-code"
                      value={state.provider?.codigo || state.provider?.identificacion || ''}
                      readOnly
                      className="bg-gray-100 cursor-not-allowed"
                      tabIndex={-1}
                    />
                  </div>
                </>
              ) : (
                <>
                  <div className="space-y-2">
                    <Autocomplete
                      label="Cliente"
                      placeholder="Buscar cliente..."
                      apiEndpoint="/api/proveedores"
                      value={state.customer?.name?.[0] || ""}
                      onSelect={handleCustomerSelect}
                      disabled={isSubmitting}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="customer-identification">Identificación *</Label>
                    <Input
                      id="customer-identification"
                      value={state.customer?.identificacion || ''}
                      readOnly
                      className="bg-gray-100 cursor-not-allowed"
                      tabIndex={-1}
                    />
                  </div>
                </>
              )}

              <div className="space-y-2">
                <Label htmlFor="provider-invoice-prefix">Prefijo de Factura *</Label>
                <select
                  id="provider-invoice-prefix"
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                  value={state.providerInvoicePrefix}
                  onChange={(e) =>
                    dispatch({ 
                      type: 'UPDATE_FIELD', 
                      payload: { field: 'providerInvoicePrefix', value: e.target.value } 
                    })
                  }
                  required
                >
                  {state.invoiceType === 'purchase' ? (
                    <>
                      <option value="FC">FC - Factura de Compra</option>
                      <option value="ND">ND - Nota Débito</option>
                      <option value="DS">DS - Documento Soporte</option>
                      <option value="RP">RP - Recibo de Pago</option>
                    </>
                  ) : (
                    <>
                      <option value="FV">FV - Factura de Venta</option>
                      <option value="NC">NC - Nota Crédito</option>
                      <option value="ND">ND - Nota Débito</option>
                    </>
                  )}
                </select>
              </div>
              {state.invoiceType === 'purchase' ? (
                <div className="space-y-2">
                  <Label htmlFor="cost-center">Centro de Costo *</Label>
                  <Input
                    id="cost-center"
                    type="text"
                    value={state.costCenter || '0'}
                    onChange={(e) =>
                      dispatch({
                        type: 'UPDATE_FIELD',
                        payload: { field: 'costCenter', value: e.target.value }
                      })
                    }
                    required
                  />
                </div>
              ) : (
                <div className="space-y-2">
                  <Label htmlFor="seller">Vendedor *</Label>
                  <select
                    id="seller"
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                    value={state.seller || ''}
                    onChange={(e) =>
                      dispatch({
                        type: 'UPDATE_FIELD',
                        payload: { field: 'seller', value: parseInt(e.target.value) }
                      })
                    }
                    required
                  >
                    {SIIGO_CONFIG.SELLERS.map((seller) => (
                      <option key={seller.id} value={seller.id}>
                        {seller.name} - {seller.email}
                      </option>
                    ))}
                  </select>
                </div>
              )}
              <div className="space-y-2">
                <Label htmlFor="provider-invoice-number">
                  {state.invoiceType === 'purchase' ? 'Número de Factura' : 'Número de Factura'} *
                </Label>
                <Input
                  id="provider-invoice-number"
                  placeholder={state.invoiceType === 'purchase' ? 'Número de la factura' : 'Número de factura'}
                  value={state.providerInvoiceNumber}
                  onChange={(e) =>
                    dispatch({ type: 'SET_PROVIDER_INVOICE_NUMBER', payload: e.target.value })
                  }
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="invoice-date">Fecha de Factura *</Label>
                <Input
                  id="invoice-date"
                  type="date"
                  value={state.invoiceDate}
                  onChange={(e) => dispatch({
                    type: 'UPDATE_FIELD',
                    payload: { field: 'invoiceDate', value: e.target.value }
                  })}
                  required
                />
              </div>
              {state.invoiceType === 'sale' && (
                <div className="space-y-2">
                  <Label htmlFor="due-date">Fecha de Vencimiento *</Label>
                  <Input
                    id="due-date"
                    type="date"
                    value={state.dueDate}
                    onChange={(e) => dispatch({
                      type: 'UPDATE_FIELD',
                      payload: { field: 'dueDate', value: e.target.value }
                    })}
                    required
                  />
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Items */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Ítems de la Factura</CardTitle>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleAddItem}
                disabled={isSubmitting}
              >
                <Plus className="h-4 w-4 mr-2" />
                Agregar Ítem
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {state.items.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <p>No hay ítems en la factura</p>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={handleAddItem}
                  className="mt-2"
                  disabled={isSubmitting}
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Agregar primer ítem
                </Button>
              </div>
            ) : (
              state.items.map((item, index) => (
                <InvoiceItemForm
                  key={item.id}
                  item={item}
                  index={index}
                  isLastItem={index === state.items.length - 1}
                  onUpdate={(id: string, field: keyof InvoiceItem, value: string | number | boolean | { type?: string; value?: number } | undefined) => {
                    dispatch({
                      type: 'UPDATE_ITEM',
                      payload: { id, field, value }
                    })
                  }}
                  onRemove={(id) => dispatch({ type: 'REMOVE_ITEM', payload: id })}
                  ivaPercentage={state.ivaPercentage}
                  disabled={isSubmitting}
                />
              ))
            )}
          </CardContent>
        </Card>

        {/* Totales */}
        <Card>
          <CardHeader>
            <CardTitle>Resumen de Totales</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="flex justify-between">
                <span>Subtotal:</span>
                <span className="font-medium">
                  ${calculateSubtotal(state.items).toLocaleString("es-CO", { minimumFractionDigits: 2 })} {state.currency || 'COP'}
                </span>
              </div>
              <div className="flex justify-between">
                <span>IVA ({state.ivaPercentage}%):</span>
                <span className="font-medium">
                  ${calculateIVA(state.items, state.ivaPercentage).toLocaleString("es-CO", { minimumFractionDigits: 2 })} {state.currency || 'COP'}
                </span>
              </div>
              {state.invoiceType === 'sale' && state.dueDate && (
                <div className="flex justify-between text-sm text-muted-foreground">
                  <span>Vencimiento:</span>
                  <span>{new Date(state.dueDate).toLocaleDateString('es-CO')}</span>
                </div>
              )}
              <Separator />
              <div className="flex justify-between text-lg font-bold">
                <span>Total:</span>
                <span className="text-green-600">
                  ${calculateTotal(state.items, state.ivaPercentage).toLocaleString("es-CO", { minimumFractionDigits: 2 })} {state.currency || 'COP'}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Observaciones */}
        <Card>
          <CardHeader>
            <CardTitle>Observaciones</CardTitle>
          </CardHeader>
          <CardContent>
            <Textarea
              placeholder="Observaciones adicionales (opcional)"
              value={state.observations}
              onChange={(e) => dispatch({
                type: 'UPDATE_FIELD',
                payload: { field: 'observations', value: e.target.value }
              })}
              rows={3}
            />
          </CardContent>
        </Card>

        {/* Botones */}
        <div className="flex justify-end gap-4">
          <Button
            type="button"
            variant="outline"
            size="lg"
            onClick={() => window.history.back()}
            disabled={isSubmitting}
          >
            Cancelar
          </Button>
          <Button
            type="submit"
            size="lg"
            disabled={isSubmitting || state.items.length === 0}
          >
            <Send className="mr-2 h-4 w-4" />
            {isSubmitting ? 'Enviando a Siigo...' : `Enviar Factura de ${state.invoiceType === 'purchase' ? 'Compra' : 'Venta'} a Siigo`}
          </Button>
        </div>
      </form>
    </div>
  );
}