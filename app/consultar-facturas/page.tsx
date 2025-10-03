/* eslint-disable @typescript-eslint/no-explicit-any */
'use client';

import { useState, useEffect, useCallback } from 'react';

interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  results?: T[];
  [key: string]: unknown;
}
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useSiigoAuth } from '@/hooks/useSiigoAuth';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { FileText, Search, Loader2, Eye, RefreshCw } from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

// Using the imported InvoiceType from types

interface Customer {
  id: string;
  name: string;
  identification?: string;
  email?: string;
  phone?: string;
  address?: string;
}

interface InvoiceItem {
  id: string;
  code: string;
  description: string;
  quantity: number;
  price: number;
  total: number;
  tax?: number;
  discount?: number;
  account?: {
    code: string;
    movement: string;
  };
  due?: {
    prefix: string;
    consecutive: number;
    quote: number;
    date: string;
  };
}

interface Payment {
  id: string;
  method: string;
  value: number;
  due_date: string;
  status: string;
}

interface Invoice {
  id: string;
  number: string;
  code?: string;
  name?: string;
  description?: string;
  date: string;
  due_date?: string;
  customer?: Customer;
  supplier?: {
    id?: string;
       name?: string;
    identification?: string;
    branch_office?: string;
  };
  seller?: {
    id: string;
    name: string;
  };
  type: string;
  total: number | string;
  tax?: number | string;
  discount?: number | string;
  discount_type?: string;
  status: 'draft' | 'posted' | 'cancelled' | 'paid' | 'partially_paid' | 'overdue' | string;
  active?: boolean;
  created_at: string;
  updated_at?: string;
  items?: InvoiceItem[];
  payments?: Payment[];
  document_type?: {
    id: string;
    name: string;
    code: string;
  };
  document?: {
    id: string;
  };
  currency?: {
    code: string;
    symbol: string;
  };
  automatic_number?: boolean;
  consecutive?: number;
  observations?: string;
  balance?: number | string;
  provider_invoice?: {
    prefix?: string;
    number?: string;
  };
  metadata?: {
    description?: string;
    cost_center?: boolean;
    cost_center_mandatory?: boolean;
    automatic_number?: boolean;
    consecutive?: number;
    decimals?: boolean;
    consumption_tax?: boolean;
    reteiva?: boolean;
    reteica?: boolean;
    document_support?: boolean;
    [key: string]: unknown;
  };
  [key: string]: any; // For any additional properties
}

// Definir la interfaz para documentos Siigo
interface SiigoDocument {
  id?: string;
  number?: string;
  code?: string;
  consecutive?: number;
  date?: string;
  items?: Array<{
    id?: string;
    code?: string;
    description?: string;
    quantity?: number;
    price?: number;
    total?: number;
    account?: {
      code: string;
      movement: string;
    };
  }>;
  customer?: {
    id?: string;
    name?: string;
    identification?: string;
  };
  supplier?: {
    id?: string;
    name?: string;
    identification?: string;
    branch_office?: number;
  };
  [key: string]: unknown;
}

// <H></H>elper function to get status information
const getStatusInfo = (status: string) => {
  switch (status?.toLowerCase()) {
    case 'draft':   
      return { variant: 'outline' as const, text: 'Borrador' };
    case 'posted':
      return { variant: 'default' as const, text: 'Publicada' };
    case 'cancelled':
      return { variant: 'destructive' as const, text: 'Anulada' };
    case 'paid':
      return { variant: 'success' as const, text: 'Pagada' };
    case 'partially_paid':
      return { variant: 'warning' as const, text: 'Parcialmente Pagada' };
    case 'overdue':
      return { variant: 'destructive' as const, text: 'Vencida' };
    default:
      return { variant: 'outline' as const, text: status || 'Desconocido' };
  }
};

// Componente para mostrar una fila de factura de compra (FC)
const FCRow = ({ invoice, onView }: { invoice: Invoice, onView: () => void }) => {
  const statusInfo = getStatusInfo(invoice.status);
  
  return (
    <TableRow key={invoice.id}>
      <TableCell className="font-medium">
        <div className="flex flex-col">
          <span>{invoice.number || 'N/A'}</span>
          {invoice.provider_invoice && (
            <span className="text-xs text-muted-foreground">
              Factura Proveedor: {invoice.provider_invoice.prefix}-{invoice.provider_invoice.number}
            </span>
          )}
          <span className="text-xs text-muted-foreground">
            {invoice.document_type?.name || 'Factura de Compra'}
          </span>
        </div>
      </TableCell>
      <TableCell>
        <div className="flex flex-col">
          <span>
            {invoice.date 
              ? format(new Date(invoice.date), 'dd/MM/yyyy', { locale: es })
              : 'N/A'}
          </span>
          {invoice.due_date && (
            <span className="text-xs text-muted-foreground">
              Vence: {format(new Date(invoice.due_date), 'dd/MM/yyyy', { locale: es })}
            </span>
          )}
        </div>
      </TableCell>
      <TableCell>
        <div className="flex flex-col">
          <span className="font-medium">
            {invoice.supplier?.name || 'Sin proveedor'}
          </span>
          <div className="text-xs text-muted-foreground">
            {invoice.supplier?.identification || 'N/A'}
            {invoice.supplier?.branch_office && invoice.supplier.branch_office !== '0' && (
              <> - Sucursal: {invoice.supplier.branch_office}</>
            )}
          </div>
        </div>
      </TableCell>
      <TableCell className="text-right">
        <div className="flex flex-col items-end">
          <span className="font-semibold">
            {`$${Math.round(Number(invoice.total || 0)).toLocaleString('es-CO', {
              minimumFractionDigits: 0,
              maximumFractionDigits: 0
            })}`}
          </span>
          {invoice.balance !== undefined && Number(invoice.balance) > 0 && (
            <span className="text-xs text-muted-foreground">
              Saldo: {`$${Math.round(Number(invoice.balance || 0)).toLocaleString('es-CO', {
                minimumFractionDigits: 0,
                maximumFractionDigits: 0
              })}`}
            </span>
          )}
        </div>
      </TableCell>
      <TableCell className="text-center">
        <Tooltip>
          <TooltipTrigger asChild>
            <Badge 
              variant={['default', 'destructive', 'outline', 'secondary'].includes(statusInfo.variant) 
                ? statusInfo.variant as 'default' | 'destructive' | 'outline' | 'secondary' 
                : 'default'}
              className="whitespace-nowrap cursor-help"
            >
              {statusInfo.text}
            </Badge>
          </TooltipTrigger>
          <TooltipContent className="max-w-[300px]">
            <p className="text-sm">
              {invoice.status === 'paid' && 'Factura pagada completamente'}
              {invoice.status === 'partially_paid' && 'Factura con pago parcial'}
              {invoice.status === 'draft' && 'Documento en borrador'}
              {invoice.status === 'cancelled' && 'Documento anulado'}
              {!['paid', 'partially_paid', 'draft', 'cancelled'].includes(invoice.status) && `Estado: ${invoice.status}`}
            </p>
            {(() => {
              try {
                const dateString = invoice.metadata?.created;
                if (!dateString) return null;
                
                // Asegurarse de que dateString sea un string
                const dateStr = String(dateString);
                if (!dateStr) return null;
                
                const timestamp = Date.parse(dateStr);
                if (isNaN(timestamp)) return null;
                
                const date = new Date(timestamp);
                if (isNaN(date.getTime())) return null;
                
                return (
                  <p className="text-xs text-muted-foreground mt-1">
                    Última actualización: {date.toLocaleString('es-CO', {
                      year: 'numeric',
                      month: '2-digit',
                      day: '2-digit',
                      hour: '2-digit',
                      minute: '2-digit'
                    })}
                  </p>
                );
              } catch (error) {
                console.error('Error al formatear la fecha:', error);
                return null;
              }
            })()}
          </TooltipContent>
        </Tooltip>
      </TableCell>
      <TableCell className="text-right">
        <Button
          variant="ghost"
          size="icon"
          className="h-9 w-9 rounded-full hover:bg-primary/10 hover:text-primary transition-colors group relative"
          onClick={onView}
          title="Ver detalles de la factura"
        >
          <Eye className="h-4 w-4 group-hover:scale-110 transition-transform" />
          <span className="sr-only">Ver detalles de la factura</span>
        </Button>
      </TableCell>
    </TableRow>
  );
};

// Server component wrapper
export default function ConsultarFacturas() {
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
  }, []);

  if (!isClient) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <TooltipProvider>
      <ClientSideConsultarFacturas />
    </TooltipProvider>
  );
}

// Client component that will be dynamically imported
function ClientSideConsultarFacturas() {
  const router = useRouter();

  // Document categories and types
  const documentCategories = [
    {
      id: 'purchase',
      name: 'Documentos de Compra',
      types: [
        { id: 'FC', name: 'Factura de Compra', endpoint: 'documents', type: 'purchase' },
        { id: 'ND', name: 'Nota Débito', endpoint: 'documents', type: 'purchase' },
        { id: 'DS', name: 'Documento Soporte', endpoint: 'documents', type: 'purchase' },
        { id: 'RP', name: 'Recibo de Pago', endpoint: 'documents', type: 'purchase' }
      ]
    },
    {
      id: 'sale',
      name: 'Documentos de Venta',
      types: [
        { id: 'FV', name: 'Factura de Venta', endpoint: 'documents', type: 'sale' },
        { id: 'NC', name: 'Nota Crédito', endpoint: 'documents', type: 'sale' },
        { id: 'RC', name: 'Recibo de Caja', endpoint: 'documents', type: 'sale' },
        { id: 'CC', name: 'Comprobante Contable', endpoint: 'documents', type: 'sale' }
      ]
    }
  ];

  // Flatten document types for the select component
  const documentTypes = documentCategories.flatMap(category => category.types);

  const [selectedType, setSelectedType] = useState<string>('FC');
  const [loading, setLoading] = useState(false);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const { fetchWithAuth, loading: authLoading } = useSiigoAuth();
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
  const [isViewerOpen, setIsViewerOpen] = useState(false);
  const [_searchPerformed, setSearchPerformed] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const _clearFilters = () => {
    setSelectedType('FC');
    setInvoices([]);
    setSearchPerformed(false);
    setError(null);
  };

  // Función para formatear facturas de compra (FC)
  const formatFCInvoice = (invoice: any) => {
    return {
      id: invoice.id || `inv-${Math.random().toString(36).substr(2, 9)}`,
      number: invoice.number || 'N/A',
      name: invoice.name || '',
      date: invoice.date || new Date().toISOString(),
      due_date: invoice.payments && invoice.payments.length > 0 ? invoice.payments[0].due_date : '',
      supplier: {
        id: invoice.supplier?.id || '',
        name: invoice.supplier?.name || 'Proveedor no especificado',
        identification: invoice.supplier?.identification || '',
        branch_office: invoice.supplier?.branch_office != null ? String(invoice.supplier.branch_office) : '0'
      },
      total: parseFloat(invoice.total) || 0,
      balance: parseFloat(invoice.balance) || 0,
      status: invoice.balance > 0 ? 'partially_paid' : 'paid',
      created_at: invoice.metadata?.created || new Date().toISOString(),
      items: invoice.items?.map((item: any) => ({
        id: item.id || `item-${Math.random().toString(36).substr(2, 9)}`,
        code: item.code || '',
        description: item.description || 'Producto sin descripción',
        quantity: parseFloat(item.quantity) || 0,
        price: parseFloat(item.price) || 0,
        total: parseFloat(item.total) || 0,
        type: item.type || '',
        discount: parseFloat(item.discount) || 0
      })) || [],
      payments: invoice.payments?.map((payment: any) => ({
        id: payment.id || `pay-${Math.random().toString(36).substr(2, 9)}`,
        method: payment.name || 'No especificado',
        value: parseFloat(payment.value) || 0,
        due_date: payment.due_date || '',
        status: 'pending'
      })) || [],
      document_type: {
        id: 'FC',
        name: 'Factura de Compra',
        code: 'FC'
      },
      currency: { code: 'COP', symbol: '$' },
      provider_invoice: invoice.provider_invoice || null,
      observations: invoice.observations || '',
      discount_type: invoice.discount_type || 'Value',
      metadata: invoice.metadata || {}
    };
  };

  // Function to fetch documents from Siigo API based on selected type
  const fetchPurchaseInvoices = useCallback(async () => {
    if (!selectedType) return;
    
    try {
      setLoading(true);
      setError(null);
      setSearching(true);
      
      const selectedDocType = documentTypes.find(doc => doc.id === selectedType);
      if (!selectedDocType) {
        throw new Error('Tipo de documento no válido');
      }
      
      console.log(`Fetching ${selectedDocType.name} from Siigo API...`);
      
      let endpoint = '';
      let response;
      
      if (selectedType === 'FC') {
        // Endpoint específico para facturas de compra (FC)
        const params = new URLSearchParams({
          type: 'FC',
          page: '1',
          pageSize: '100',
          includeDependencies: 'true'
        });
        endpoint = `/api/siigo/documents?${params.toString()}`;
        console.log('API Endpoint (FC purchase):', endpoint);
        response = await fetch(endpoint);
      } else if (selectedDocType.type === 'sale') {
        // Usar el endpoint específico para facturas de venta
        if (selectedDocType.id === 'RC') {
          // Para recibos de caja, usar la ruta específica de vouchers
          endpoint = `/api/siigo/vouchers`;
          console.log('API Endpoint (RC vouchers):', endpoint);
        } else {
          // Para otros tipos de venta, usar la ruta de invoices
          endpoint = `/api/siigo/invoices/${selectedDocType.id.toLowerCase()}`;
          console.log('API Endpoint (sale):', endpoint);
        }
        response = await fetch(endpoint);
      } else {
        // Para otros documentos de compra
        const params = new URLSearchParams({
          type: selectedType,
          page: '1',
          pageSize: '100',
          includeDependencies: 'true'
        });
        endpoint = `/api/siigo/documents?${params.toString()}`;
        console.log('API Endpoint (purchase):', endpoint);
        response = await fetch(endpoint);
      }
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        console.error('Error response:', errorData);
        throw new Error(errorData.error || `Error al cargar ${selectedDocType.name} de Siigo`);
      }
      
      const result = await response.json();
      console.log('API Response:', result);
      
      // Process the response
      if (!result.success) {
        console.error('API Error:', result.error);
        throw new Error(result.error || 'Error al procesar la respuesta del servidor');
      }

      // Get the data from the response
      const responseData = result.data || result;
      
      // Handle different response formats
      let invoicesData = [];
      if (Array.isArray(responseData)) {
        invoicesData = responseData;
      } else if (responseData.results && Array.isArray(responseData.results)) {
        invoicesData = responseData.results;
      } else if (responseData.items && Array.isArray(responseData.items)) {
        invoicesData = responseData.items;
      } else if (responseData.data && Array.isArray(responseData.data)) {
        invoicesData = responseData.data;
      } else if (responseData.vouchers && Array.isArray(responseData.vouchers)) {
        // Handle vouchers response format specifically
        invoicesData = responseData.vouchers;
      } else if (typeof responseData === 'object' && responseData !== null) {
        // If it's an object but not an array, try to extract data from it
        const dataKeys = Object.keys(responseData);
        if (dataKeys.length > 0) {
          // If there's a key that looks like it contains an array, use that
          const arrayKey = dataKeys.find(key => 
            Array.isArray(responseData[key]) && 
            ['invoices', 'documents', 'items', 'results', 'vouchers'].includes(key.toLowerCase())
          );
          
          if (arrayKey) {
            invoicesData = responseData[arrayKey];
          } else {
            // If no array found, try to use the first array value
            const firstArray = Object.values(responseData).find(Array.isArray);
            if (firstArray) {
              invoicesData = firstArray;
            }
          }
        }
      }

      // Map and transform the data to match our Invoice interface
      const formattedInvoices = invoicesData.map((invoice: any) => {
        // Si es una factura de compra (FC), usar el formateador específico
        if (selectedType === 'FC' || invoice.type === 'FC' || invoice.document_type?.code === 'FC') {
          return formatFCInvoice(invoice);
        }
        
        // Para otros tipos de documentos, usar el formato estándar
        return {
        id: invoice.id || `inv-${Math.random().toString(36).substr(2, 9)}`,
        number: invoice.number || 'N/A',
        date: invoice.date || invoice.created_at || new Date().toISOString(),
        due_date: invoice.due_date || invoice.expiration_date || '',
        customer: {
          id: invoice.customer?.id || '',
          name: invoice.customer?.name || invoice.customer_name || 'Cliente no especificado',
          identification: invoice.customer?.identification || invoice.customer_identification || '',
          email: invoice.customer?.email || invoice.customer_email || '',
          phone: invoice.customer?.phone || invoice.customer_phone || '',
          address: invoice.customer?.address || invoice.customer_address || ''
        },
        // Ensure supplier is populated to support the Provider card in the viewer
        supplier: invoice.supplier ? {
          id: invoice.supplier.id || '',
          name: invoice.supplier.name || invoice.supplier_name || '',
          identification: invoice.supplier.identification || invoice.supplier_identification || '',
          branch_office: (invoice.supplier.branch_office ?? invoice.supplier_branch_office) != null
            ? String(invoice.supplier.branch_office ?? invoice.supplier_branch_office)
            : undefined
        } : undefined,
        seller: invoice.seller ? {
          id: invoice.seller.id || '',
          name: invoice.seller.name || ''
        } : undefined,
        type: invoice.type || 'FC',
        total: parseFloat(invoice.total) || 0,
        tax: parseFloat(invoice.tax) || 0,
        discount: parseFloat(invoice.discount) || 0,
        status: (invoice.status || 'draft').toLowerCase(),
        created_at: invoice.created_at || new Date().toISOString(),
        updated_at: invoice.updated_at || null,
        items: invoice.items?.map((item: any) => ({
          id: item.id || `item-${Math.random().toString(36).substr(2, 9)}`,
          code: item.code || item.sku || '',
          description: item.description || item.name || 'Producto sin descripción',
          quantity: parseFloat(item.quantity) || 0,
          price: parseFloat(item.price) || 0,
          total: parseFloat(item.total) || 0,
          tax: parseFloat(item.tax) || 0,
          discount: parseFloat(item.discount) || 0
        })) || [],
        payments: invoice.payments?.map((payment: any) => ({
          id: payment.id || `pay-${Math.random().toString(36).substr(2, 9)}`,
          method: payment.method || payment.payment_method || 'No especificado',
          value: parseFloat(payment.value) || 0,
          due_date: payment.due_date || payment.payment_due_date || '',
          status: payment.status || 'pending'
        })) || [],
        document_type: invoice.document_type ? {
          id: invoice.document_type.id || '',
          name: invoice.document_type.name || '',
          code: invoice.document_type.code || ''
        } : {
          id: 'FC',
          name: 'Factura de Compra',
          code: 'FC'
        },
        currency: invoice.currency ? {
          code: invoice.currency.code || 'COP',
          symbol: invoice.currency.symbol || '$'
        } : { code: 'COP', symbol: '$' },
        metadata: invoice.metadata || {}
      };
      });

      console.log('Formatted invoices:', formattedInvoices);
      setInvoices(formattedInvoices);
      setSearchPerformed(true);
    } catch (err) {
      console.error('Error fetching invoices:', err);
      setError('Error al cargar las facturas. Por favor, intente nuevamente.');
    } finally {
      setLoading(false);
      setSearching(false);
    }
  }, []);

  // Initialize component with default values and fetch purchase invoices
  useEffect(() => {
    // Document types are loaded via the fetchDocumentTypes effect
    // Fetch purchase invoices from Siigo API
    fetchPurchaseInvoices();
  }, []);
  
  // Función para actualizar la búsqueda de facturas
  const handleRefresh = () => {
    fetchPurchaseInvoices();
  };

  // Helper function to get status text and variant
  const getStatusInfo = (status: string) => {
    switch (status) {
      case 'paid':
        return { text: 'Pagada', variant: 'default' as const };
      case 'cancelled':
        return { text: 'Anulada', variant: 'destructive' as const };
      case 'draft':
        return { text: 'Borrador', variant: 'outline' as const };
      case 'overdue':
        return { text: 'Vencida', variant: 'destructive' as const };
      case 'partially_paid':
        return { text: 'Parcialmente Pagada', variant: 'default' as const };
      default:
        return { text: status, variant: 'outline' as const };
    }
  };

  // Function to render the invoices table
  const renderInvoicesTable = () => {
    if (loading) {
      return (
        <div className="flex justify-center items-center p-8">
          <Loader2 className="h-8 w-8 animate-spin text-gray-500 mb-4" />
          <span className="ml-2">Cargando facturas...</span>
        </div>
      );
    }

    return (
      <div className="mt-6">
        <div className="flex justify-between items-center mb-4">
          <div className="text-sm text-muted-foreground">
            Mostrando {invoices.length} factura(s)
          </div>
          <div className="flex space-x-2">
            <Button 
              variant="outline" 
              size="sm" 
              onClick={handleRefresh}
              disabled={searching}
            >
              {searching ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Actualizando...
                </>
              ) : (
                <>
                  <RefreshCw className="mr-2 h-4 w-4" />
                  Actualizar
                </>
              )}
            </Button>
          </div>
        </div>
        
        {/* Desktop Table View */}
        <div className="hidden md:block border rounded-md overflow-hidden">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead># Factura</TableHead>
                  <TableHead>Fecha</TableHead>
                  <TableHead>Proveedor</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                  <TableHead className="text-center">Estado</TableHead>
                  <TableHead className="w-[50px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {invoices.map((invoice) => {
                  // Componente específico para facturas de compra (FC)
                  if (invoice.document_type?.code === 'FC' || invoice.type === 'FC') {
                    return (
                      <FCRow 
                        key={invoice.id} 
                        invoice={invoice} 
                        onView={() => {
                          setSelectedInvoice(invoice);
                          setIsViewerOpen(true);
                        }} 
                      />
                    );
                  }
                  
                  // Componente estándar para otros tipos de facturas
                  return (
                    <TableRow key={invoice.id}>
                      <TableCell className="font-medium">
                        <div className="flex flex-col">
                          <span>{invoice.number || 'N/A'}</span>
                          <span className="text-xs text-muted-foreground">
                            {invoice.document_type?.name || 'Factura'}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        {invoice.date 
                          ? format(new Date(invoice.date), 'dd/MM/yyyy', { locale: es })
                          : 'N/A'}
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col">
                          <span className="font-medium">
                            {invoice.supplier?.name || invoice.customer?.name || 'Sin proveedor'}
                          </span>
                          <div className="text-xs text-muted-foreground">
                            {invoice.supplier?.identification || invoice.customer?.identification || 'N/A'}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="text-right font-semibold">
                        {`$${Math.round(Number(invoice.total)).toLocaleString('es-CO')}`}
                      </TableCell>
                      <TableCell className="text-center">
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Badge variant={getStatusInfo(invoice.status).variant} className="whitespace-nowrap cursor-help">
                              {getStatusInfo(invoice.status).text}
                            </Badge>
                          </TooltipTrigger>
                          <TooltipContent className="max-w-[300px]">
                            <p className="text-sm">
                              {invoice.status === 'draft' && 'Documento en borrador'}
                              {invoice.status === 'posted' && 'Documento registrado'}
                              {invoice.status === 'cancelled' && 'Documento anulado'}
                              {!['draft', 'posted', 'cancelled'].includes(invoice.status) && `Estado: ${invoice.status}`}
                            </p>
                            {invoice.updated_at && (
                              <p className="text-xs text-muted-foreground mt-1">
                                Última actualización: {new Date(invoice.updated_at).toLocaleString()}
                              </p>
                            )}
                          </TooltipContent>
                        </Tooltip>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-9 w-9 rounded-full hover:bg-primary/10 hover:text-primary transition-colors group relative"
                          onClick={() => {
                            setSelectedInvoice(invoice);
                            setIsViewerOpen(true);
                          }}
                          title="Ver detalles de la factura"
                        >
                          <Eye className="h-4 w-4 group-hover:scale-110 transition-transform" />
                          <span className="sr-only">Ver detalles de la factura</span>
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </div>
        
        {/* Mobile Card View */}
        <div className="md:hidden space-y-3">
          {invoices.map((invoice) => {
            const statusInfo = getStatusInfo(invoice.status);
            return (
              <Card key={invoice.id} className="overflow-hidden">
                <CardHeader className="p-4 pb-2">
                  <div className="flex justify-between items-start">
                    <div>
                      <h3 className="font-medium">
                        {invoice.number || 'N/A'}
                        <span className="ml-2 text-sm text-muted-foreground">
                          {invoice.document_type?.name || 'Factura'}
                        </span>
                      </h3>
                      <p className="text-sm text-muted-foreground">
                        {invoice.date ? format(new Date(invoice.date), 'dd/MM/yyyy', { locale: es }) : 'N/A'}
                      </p>
                    </div>
                    <Badge variant={statusInfo.variant} className="whitespace-nowrap">
                      {statusInfo.text}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="p-4 pt-0">
                  <div className="space-y-2">
                    <div>
                      <p className="font-medium">{invoice.customer?.name || 'Sin nombre'}</p>
                      {invoice.customer?.identification && (
                        <p className="text-sm text-muted-foreground">
                          {invoice.customer.identification}
                        </p>
                      )}
                    </div>
                    <div className="flex justify-between items-center pt-2 border-t">
                      <div>
                        <p className="text-sm text-muted-foreground">Impuestos</p>
                        <p>{invoice.tax ? `$${Math.round(Number(invoice.tax)).toLocaleString('es-CO')}` : '$0'}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm text-muted-foreground">Total</p>
                        <p className="font-semibold">
                          {`$${Math.round(Number(invoice.total)).toLocaleString('es-CO')}`}
                        </p>
                      </div>
                    </div>
                    <div className="pt-3">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setSelectedInvoice(invoice);
                          setIsViewerOpen(true);
                        }}
                        className="w-full bg-primary/5 hover:bg-primary/10 text-primary border-primary/20 hover:border-primary/30 transition-colors group"
                      >
                        <Eye className="h-4 w-4 mr-2 group-hover:scale-110 transition-transform" />
                        <span className="group-hover:translate-x-0.5 transition-transform">Ver detalles</span>
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>
    );
  };

  // Function to search documents with authentication
  const handleSearch = useCallback(async () => {
    if (authLoading || !selectedType) return;
    
    try {
      setSearching(true);
      setError(null);
      
      // Encontrar el tipo de documento seleccionado
      const selectedDocType = documentTypes.find(doc => doc.id === selectedType);
      if (!selectedDocType) {
        throw new Error('Tipo de documento no encontrado');
      }
      
      // Construir parámetros de consulta
      const params = new URLSearchParams({
        page: '1',
        pageSize: '100',
        includeDependencies: 'true'
      });
      
      // Para tipos de documento estándar, usar el type
      params.append('type', selectedDocType.id);
       
      // Usar el endpoint correspondiente según el tipo de documento
      let endpoint = `/api/siigo/${selectedDocType.endpoint}`;
      
      // Si es RC (Recibo de Caja), usar la ruta específica de vouchers
      if (selectedDocType.id === 'RC') {
        endpoint = `/api/siigo/vouchers`;
        // Para vouchers, no necesitamos parámetros adicionales ya que están hardcodeados en la ruta
        interface VoucherResponse extends ApiResponse {
          vouchers?: any[];
        }
        
        const result = await fetchWithAuth<VoucherResponse>(endpoint);
        
        if (!result || result?.success === false) {
          console.error('Error in response:', result);
          throw new Error(result?.error || 'Error al procesar la respuesta');
        }
        
        const raw = result?.vouchers || [];
        const documents: any[] = Array.isArray(raw) ? raw : [];
        const formattedInvoices: Invoice[] = documents.map((doc: any) => {
          // Mapear los datos de vouchers al formato de Invoice
          const docType = 'RC';
          const party = doc.customer || doc.supplier || doc.third || doc.payer || {};
          const currency = doc.currency || {};

          const items: InvoiceItem[] = Array.isArray(doc.items)
            ? doc.items.map((item: any): InvoiceItem => {
                const value = Number(item.value || 0);
                const movement = item.account?.movement;
                const _isCredit = movement === 'Credit';
                const isDebit = movement === 'Debit';
                
                return {
                  id: String(item.id ?? Math.random().toString(36).slice(2)),
                  code: item.code || item.sku || item.product_code || item?.account?.code || '',
                  description: item.description || item.name || 'Producto sin descripción',
                  quantity: typeof item.quantity !== 'undefined' ? Number(item.quantity) : 1,
                  price: value,
                  total: isDebit ? -value : value, // Debit se muestra como negativo
                  tax: Number(item.tax ?? 0),
                  discount: Number(item.discount ?? 0),
                  // Agregar información adicional para vouchers
                  account: item.account ? {
                    code: item.account.code,
                    movement: item.account.movement
                  } : undefined,
                  due: item.due ? {
                    prefix: item.due.prefix,
                    consecutive: item.due.consecutive,
                    quote: item.due.quote,
                    date: item.due.date
                  } : undefined
                };
              })
            : ([] as InvoiceItem[]);

          const payments: Payment[] = Array.isArray(doc.payments)
            ? doc.payments.map((p: any): Payment => ({
                id: String(p.id ?? Math.random().toString(36).slice(2)),
                method: p.method || p.payment_method || p.payment_mean?.name || 'No especificado',
                value: Number(p.value ?? p.amount ?? 0),
                due_date: p.due_date || p.payment_due_date || p.date || '',
                status: p.status || 'pending',
              }))
            : ([] as Payment[]);

          // Para vouchers (RC), calcular el total basado en movimientos contables
          let computedTotal: number = 0;
          
          if (doc.items && Array.isArray(doc.items)) {
            // Calcular total basado en movimientos contables
            computedTotal = doc.items.reduce((sum: number, item: any) => {
              const value = Number(item.value || 0);
              const movement = item.account?.movement;
              
              if (movement === 'Credit') {
                // Credit suma (ingresos)
                return sum + value;
              } else if (movement === 'Debit') {
                // Debit resta (egresos)
                return sum - value;
              } else {
                // Si no hay movimiento definido, usar el valor tal como está
                return sum + value;
              }
            }, 0);
          } else {
            // Fallback para otros casos
            const itemsSum: number = items.reduce((sum: number, it: InvoiceItem) => sum + (Number(it.total) || 0), 0);
            const paymentsSum: number = payments.reduce((sum: number, pay: Payment) => sum + (Number(pay.value) || 0), 0);

            if (doc.total !== undefined && doc.total !== null) {
              computedTotal = Number(doc.total);
            } else if (doc.amount !== undefined && doc.amount !== null) {
              computedTotal = Number(doc.amount);
            } else if (doc.value !== undefined && doc.value !== null) {
              computedTotal = Number(doc.value);
            } else if (itemsSum > 0) {
              computedTotal = itemsSum;
            } else {
              computedTotal = paymentsSum;
            }
          }

          const supplier = doc.supplier
            ? {
                id: String(doc.supplier.id ?? ''),
                name: doc.supplier.name || '',
                identification: String(doc.supplier.identification ?? ''),
                branch_office: doc.supplier.branch_office != null ? String(doc.supplier.branch_office) : undefined,
              }
            : undefined;

          return {
            id: String(doc.id ?? Math.random().toString(36).slice(2)),
            number: String(doc.number ?? doc.code ?? doc.consecutive ?? 'N/A'),
            date: doc.date || doc.issue_date || doc.created_at || new Date().toISOString(),
            due_date: doc.due_date || doc.expiration_date || doc.payment_due_date || '',
            customer: {
              id: String((party as any).id ?? ''),
              name: (party as any).name || doc.customer_name || doc.supplier?.name || doc.payer?.name || 'Cliente no especificado',
              identification: (party as any).identification || (party as any).identification_number || doc.customer_identification || '',
              email: (party as any).email || doc.customer_email || '',
              phone: (party as any).phone || doc.customer_phone || '',
              address: (party as any).address || doc.customer_address || '',
            },
            supplier,
            type: docType,
            total: Math.abs(computedTotal || 0),
            tax: Math.abs(Number(doc.tax ?? 0)),
            discount: Math.abs(Number(doc.discount ?? 0)),
            status: status,
            created_at: doc.created_at || new Date().toISOString(),
            updated_at: doc.updated_at || undefined,
            items,
            payments,
            document_type: {
              id: 'RC',
              name: 'Recibo de Caja',
              code: 'RC',
            },
            currency: {
              code: currency.code || 'COP',
              symbol: currency.symbol || '$',
            },
            automatic_number: doc.automatic_number,
            consecutive: doc.consecutive,
            metadata: doc.metadata || {},
          };
        });
        
        setInvoices(formattedInvoices);
        setSearchPerformed(true);
        return;
      }
      
      const result = await fetchWithAuth<ApiResponse<Invoice[]>>(`${endpoint}?${params.toString()}`);
      
      if (!result || result.success === false) {
        console.error('Error in response:', result);
        throw new Error(result?.error || 'Error al procesar la respuesta');
      }
      
      const raw = result.data || [];
      const documents: SiigoDocument[] = Array.isArray(raw)
        ? raw
        : (typeof raw === 'object' && raw !== null && Array.isArray((raw as any).results) ? (raw as any).results : []);
      const formattedInvoices: Invoice[] = documents.map((doc: any) => {
        const docType = doc.type || doc?.document_type?.code || selectedType;
        const party = doc.customer || doc.supplier || doc.third || doc.payer || {};
        const currency = doc.currency || {};

        const items: InvoiceItem[] = Array.isArray(doc.items)
          ? doc.items.map((item: any): InvoiceItem => ({
              id: String(item.id ?? Math.random().toString(36).slice(2)),
              code: item.code || item.sku || item.product_code || item?.account?.code || '',
              description: item.description || item.name || 'Producto sin descripción',
              quantity: typeof item.quantity !== 'undefined' ? Number(item.quantity) : 1,
              price: Number(item.price ?? item.value ?? 0),
              total: Number(item.total ?? item.value ?? (Number(item.quantity || 1) * Number(item.price || 0))),
              tax: Number(item.tax ?? 0),
              discount: Number(item.discount ?? 0),
            }))
          : ([] as InvoiceItem[]);

        const payments: Payment[] = Array.isArray(doc.payments)
          ? doc.payments.map((p: any): Payment => ({
              id: String(p.id ?? Math.random().toString(36).slice(2)),
              method: p.method || p.payment_method || p.payment_mean?.name || 'No especificado',
              value: Number(p.value ?? p.amount ?? 0),
              due_date: p.due_date || p.payment_due_date || p.date || '',
              status: p.status || 'pending',
            }))
          : ([] as Payment[]);

        const isRP = String(docType).toUpperCase() === 'RP';
        const itemsSum: number = items.reduce((sum: number, it: InvoiceItem) => sum + (Number(it.total) || 0), 0);
        const paymentsSum: number = payments.reduce((sum: number, pay: Payment) => sum + (Number(pay.value) || 0), 0);

        let computedTotal: number;
        if (doc.total !== undefined && doc.total !== null) {
          computedTotal = Number(doc.total);
        } else if (isRP) {
          if (doc.amount !== undefined && doc.amount !== null) {
            computedTotal = Number(doc.amount);
          } else if (doc.value !== undefined && doc.value !== null) {
            computedTotal = Number(doc.value);
          } else if (itemsSum > 0) {
            computedTotal = itemsSum;
          } else {
            computedTotal = paymentsSum;
          }
        } else {
          computedTotal = 0;
        }

        const supplier = doc.supplier
          ? {
              id: String(doc.supplier.id ?? ''),
              name: doc.supplier.name || '',
              identification: String(doc.supplier.identification ?? ''),
              branch_office: doc.supplier.branch_office != null ? String(doc.supplier.branch_office) : undefined,
            }
          : (String(docType).toUpperCase() === 'FC'
              ? {
                  id: String(party.id ?? ''),
                  name: (party as any).name || '',
                  identification: String((party as any).identification ?? (party as any).identification_number ?? ''),
                  branch_office: (party as any).branch_office != null ? String((party as any).branch_office) : undefined,
                }
              : undefined);

        return {
          id: String(doc.id ?? Math.random().toString(36).slice(2)),
          number: String(doc.number ?? doc.code ?? doc.consecutive ?? 'N/A'),
          date: doc.date || doc.issue_date || doc.created_at || new Date().toISOString(),
          due_date: doc.due_date || doc.expiration_date || doc.payment_due_date || '',
          customer: {
            id: String((party as any).id ?? ''),
            name: (party as any).name || doc.customer_name || doc.supplier?.name || doc.payer?.name || 'Cliente no especificado',
            identification: (party as any).identification || (party as any).identification_number || doc.customer_identification || '',
            email: (party as any).email || doc.customer_email || '',
            phone: (party as any).phone || doc.customer_phone || '',
            address: (party as any).address || doc.customer_address || '',
          },
          supplier,
          type: docType,
          total: Math.abs(computedTotal || 0),
          tax: Math.abs(Number(isRP ? 0 : (doc.tax ?? 0))),
          discount: Math.abs(Number(doc.discount ?? 0)),
          status: String(doc.status || 'draft').toLowerCase() as Invoice['status'],
          created_at: doc.created_at || new Date().toISOString(),
          updated_at: doc.updated_at || undefined,
          items,
          payments,
          document_type: doc.document_type
            ? {
                id: String(doc.document_type.id ?? docType),
                name: doc.document_type.name || (docType === 'RP' ? 'Recibo de Pago' : 'Factura'),
                code: doc.document_type.code || docType,
              }
            : {
                id: docType,
                name: docType === 'RP' ? 'Recibo de Pago' : 'Factura',
                code: docType,
              },
          currency: {
            code: currency.code || 'COP',
            symbol: currency.symbol || '$',
          },
          automatic_number: doc.automatic_number,
          consecutive: doc.consecutive,
          metadata: doc.metadata || {},
        };
      });
       
      setInvoices(formattedInvoices);
      setSearchPerformed(true);
    } catch (err) {
      console.error('Error searching documents:', err);
      setError('Error al buscar documentos. Por favor, intente nuevamente.');
    } finally {
      setSearching(false);
    }
  }, [authLoading, fetchWithAuth, selectedType]);

  
  const formatDate = (dateString: string, includeTime: boolean = false) => {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return 'Fecha inválida';
    
    return format(
      date, 
      includeTime ? "dd/MM/yyyy 'a las' hh:mm a" : 'dd/MM/yyyy',
      { locale: es }
    );
  };



  const closeViewer = () => {
    setIsViewerOpen(false);
    setSelectedInvoice(null);
  };

  const goToEditSelectedInvoice = () => {
    if (!selectedInvoice) return;
    const t = (selectedInvoice.type || selectedInvoice.document_type?.code || selectedType || 'FC').toString();
    router.push(`/editar-factura/${encodeURIComponent(selectedInvoice.id)}?type=${encodeURIComponent(t)}`);
  };

  const handleDeleteSelectedInvoice = async () => {
    if (!selectedInvoice) return;
    const t = (selectedInvoice.type || selectedInvoice.document_type?.code || selectedType || 'FC').toString();
    if (!confirm('¿Eliminar esta factura en Siigo? Esta acción no se puede deshacer.')) return;
    try {
      setDeleting(true);
      const res = await fetch(`/api/siigo/documents/${encodeURIComponent(selectedInvoice.id)}?type=${encodeURIComponent(t)}`, { method: 'DELETE' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || data?.success === false) {
        throw new Error(data?.error || 'Error eliminando la factura');
      }
      toast.success('Factura eliminada');
      setInvoices((prev) => prev.filter((inv) => inv.id !== selectedInvoice.id));
      closeViewer();
    } catch (e: any) {
      console.error(e);
      toast.error(e?.message || 'Error al eliminar');
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-3xl font-bold">Consultar Facturas</h1>
        <Button variant="outline" onClick={handleSearch} disabled={searching}>
          {searching ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Buscando...
            </>
          ) : (
            <>
              <Search className="mr-2 h-4 w-4" />
              Buscar Facturas
            </>
          )}
        </Button>
      </div>
      
      <Card className="mb-8">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Filtros de Búsqueda
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="type">Tipo de Factura</Label>
                
                {/* Componente tipo switch para seleccionar entre categorías */}
                <div className="flex space-x-2 mb-4">
                  {documentCategories.map((category) => (
                    <Button 
                      key={category.id}
                      variant={documentCategories.find(c => c.types.some(t => t.id === selectedType))?.id === category.id ? "default" : "outline"}
                      className="flex-1"
                      onClick={() => {
                        // Seleccionar el primer tipo de documento de esta categoría
                        if (category.types.length > 0) {
                          setSelectedType(category.types[0].id);
                        }
                      }}
                    >
                      {category.name}
                    </Button>
                  ))}
                </div>
                
                {/* Select para tipos específicos dentro de la categoría seleccionada */}
                <Select 
                  value={selectedType} 
                  onValueChange={setSelectedType}
                  disabled={loading}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Seleccione un tipo de documento" />
                  </SelectTrigger>
                  <SelectContent>
                    {documentCategories
                      .find(category => category.types.some(type => type.id === selectedType))?.types
                      .map((type) => (
                        <SelectItem key={type.id} value={type.id}>
                          {type.name}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex items-end">
                <Button 
                  onClick={handleSearch} 
                  className="w-full" 
                  disabled={loading || searching}
                >
                  {searching ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Search className="mr-2 h-4 w-4" />
                  )}
                  {searching ? 'Buscando...' : 'Buscar Facturas'}
                </Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Invoices Table */}
      <Card className="mt-6">
        <CardHeader>
          <CardTitle>{documentTypes.find((t) => t.id === selectedType)?.name || 'Documentos'}</CardTitle>
        </CardHeader>
        <CardContent>
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded mb-4">
              {error}
            </div>
          )}
          {renderInvoicesTable()}
        </CardContent>
      </Card>

      {/* Invoice Viewer Dialog */}
      <Dialog open={isViewerOpen} onOpenChange={setIsViewerOpen}>
        <DialogContent className="sm:max-w-4xl max-h-[90vh] overflow-y-auto">
          {selectedInvoice && (
            <>
              <DialogHeader className="border-b pb-4">
                <div className="space-y-2">
                  <div className="flex justify-between items-start">
                    <div>
                      <DialogTitle className="text-2xl">
                        {selectedInvoice.document_type?.name || 'Factura'} #{selectedInvoice.number}
                        {selectedInvoice.name && ` (${selectedInvoice.name})`}
                      </DialogTitle>
                      <div className="flex items-center gap-4 mt-1">
                        <span className="text-sm text-muted-foreground">
                          Fecha: {formatDate(selectedInvoice.date)}
                        </span>
                        {selectedInvoice.document?.id && (
                          <span className="text-sm text-muted-foreground">
                            Documento: {selectedInvoice.document.id}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-2xl font-bold">
                        {`$${Number(selectedInvoice.total || 0).toLocaleString('es-CO', {maximumFractionDigits: 0})}`}
                      </div>
                      {selectedInvoice.status && (
                        <Badge variant={selectedInvoice.status ? getStatusInfo(selectedInvoice.status).variant : 'outline'} className="mt-1">
                          {selectedInvoice.status ? getStatusInfo(selectedInvoice.status).text : 'Sin estado'}
                        </Badge>
                      )}
                    </div>
                  </div>
                  
                  {/* ID and Additional Info */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm text-muted-foreground pt-2 border-t">
                    <div>
                      <span className="font-medium">ID:</span> {selectedInvoice.id}
                    </div>
                    {selectedInvoice.balance !== undefined && (
                      <div>
                        <span className="font-medium">Saldo:</span>{' '}
                        <span className={Number(selectedInvoice.balance) > 0 ? 'text-amber-600' : 'text-green-600'}>
                          ${Number(selectedInvoice.balance).toLocaleString('es-CO', {maximumFractionDigits: 2})}
                        </span>
                      </div>
                    )}
                    {selectedInvoice.discount_type && (
                      <div>
                        <span className="font-medium">Tipo de descuento:</span> {selectedInvoice.discount_type}
                      </div>
                    )}
                    {selectedInvoice.observations && (
                      <div className="md:col-span-2">
                        <span className="font-medium">Observaciones:</span> {selectedInvoice.observations}
                      </div>
                    )}
                  </div>
                </div>
              </DialogHeader>

              <div className="space-y-6 py-4">
                {/* Información del Proveedor */}
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold">Información del Proveedor</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-3 border rounded-lg p-4 bg-gray-50">
                      <div className="flex justify-between items-center">
                        <h4 className="font-medium text-base">Proveedor</h4>
                      </div>
                      <div className="mt-2">
                        <div className="bg-white p-3 rounded border">
                          <div className="text-sm font-mono break-all">
                            {selectedInvoice.supplier?.identification || selectedInvoice.supplier?.id || 'No disponible'}
                          </div>
                          {selectedInvoice.supplier?.id && (
                            <div className="text-xs text-muted-foreground mt-1">
                              ID: {selectedInvoice.supplier.id}
                            </div>
                          )}
                        </div>
                        {selectedInvoice.supplier?.branch_office !== undefined && (
                          <p className="text-sm text-muted-foreground mt-2">
                            <span className="font-medium">Sucursal:</span> {selectedInvoice.supplier.branch_office}
                          </p>
                        )}
                      </div>
                    </div>
                    
                    {selectedInvoice.provider_invoice && (
                      <div className="space-y-2 border rounded-lg p-4">
                        <h4 className="font-medium">Factura del Proveedor</h4>
                        <div className="mt-2 space-y-1 text-sm">
                          <div className="flex items-center gap-2">
                            <span className="font-medium">Número:</span>
                            <span className="bg-gray-50 px-2 py-1 rounded">
                              {selectedInvoice.provider_invoice.prefix || ''} {selectedInvoice.provider_invoice.number || ''}
                            </span>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Detalles de la Factura */}
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold">
                    {selectedInvoice.type === 'DebtPayment' ? 'Detalles del Pago de Deuda' : 'Detalles de la Factura'}
                  </h3>
                  <div className="border rounded-lg overflow-hidden">
                    {selectedInvoice.type === 'DebtPayment' ? (
                      // Para pagos de deuda (RP), mostrar información específica
                      <>
                        <div className="bg-gray-50 px-4 py-3 border-b">
                          <div className="grid grid-cols-12 gap-4">
                            <div className="col-span-3 font-medium text-sm">Factura</div>
                            <div className="col-span-3 font-medium text-sm">Cuota</div>
                            <div className="col-span-3 font-medium text-sm">Fecha</div>
                            <div className="col-span-3 text-right font-medium text-sm">Valor</div>
                          </div>
                        </div>
                        
                        <div className="divide-y">
                          {selectedInvoice.items?.length ? (
                            selectedInvoice.items.map((item: any, idx: number) => {
                              return (
                                <div key={`due-${idx}`} className="px-4 py-3 hover:bg-gray-50">
                                  <div className="grid grid-cols-12 gap-4 items-center">
                                    <div className="col-span-3">
                                      <div className="font-medium">{item.due?.prefix || ''} {item.due?.consecutive || 'N/A'}</div>
                                    </div>
                                    <div className="col-span-3">
                                      <span className="text-sm font-medium">{item.due?.quote || 1}</span>
                                    </div>
                                    <div className="col-span-3">
                                      <span className="text-sm">
                                        {item.due?.date ? new Date(item.due.date).toLocaleDateString('es-CO') : 'N/A'}
                                      </span>
                                    </div>
                                    <div className="col-span-3 text-right">
                                      <div className="font-medium">
                                        ${Number(item.value || 0).toLocaleString('es-CO', {maximumFractionDigits: 2})}
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              );
                            })
                          ) : (
                            <div className="px-4 py-8 text-center text-muted-foreground">
                              No hay detalles de pago disponibles
                            </div>
                          )}
                        </div>
                      </>
                    ) : (
                      // Para otros tipos de documentos, mostrar la tabla estándar
                      <>
                        <div className="bg-gray-50 px-4 py-3 border-b">
                          <div className="grid grid-cols-12 gap-4">
                            <div className="col-span-5 font-medium text-sm">Descripción</div>
                            <div className="col-span-2 font-medium text-sm">Código</div>
                            <div className="col-span-2 font-medium text-sm">Cantidad</div>
                            <div className="col-span-3 text-right font-medium text-sm">Valor</div>
                          </div>
                        </div>
                        
                        <div className="divide-y">
                          {selectedInvoice.items?.length ? (
                            selectedInvoice.items.map((item: any, idx: number) => {
                              return (
                                <div key={`${item.id ?? 'item'}-${idx}`} className="px-4 py-3 hover:bg-gray-50">
                                  <div className="grid grid-cols-12 gap-4 items-center">
                                    <div className="col-span-5">
                                      <div className="font-medium">{item.description || 'Sin descripción'}</div>
                                      {item.type && (
                                        <div className="text-xs text-muted-foreground mt-1">
                                          Tipo: {item.type}
                                        </div>
                                      )}
                                    </div>
                                    <div className="col-span-2">
                                      <span className="text-sm font-mono">{item.code || 'N/A'}</span>
                                    </div>
                                    <div className="col-span-2 text-center">
                                      <span className="text-sm font-medium">
                                        {item.quantity || 1}
                                      </span>
                                    </div>
                                    <div className="col-span-3 text-right">
                                      <div className="font-medium">
                                        ${Math.abs(Number(item.total)).toLocaleString('es-CO', {maximumFractionDigits: 2})}
                                      </div>
                                      {item.price && item.price !== item.total && (
                                        <div className="text-xs text-muted-foreground">
                                          Precio unitario: ${Number(item.price).toLocaleString('es-CO', {maximumFractionDigits: 2})}
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                </div>
                              );
                            })
                          ) : (
                            <div className="px-4 py-8 text-center text-muted-foreground">
                              No hay artículos en esta factura
                            </div>
                          )}
                        </div>
                      </>
                    )}
                  </div>
                </div>

                {/* Pagos */}
                {selectedInvoice.type !== 'DebtPayment' ? (
                  <div className="space-y-4">
                    <h3 className="text-lg font-semibold">Pagos</h3>
                    <div className="border rounded-lg overflow-hidden">
                      <div className="bg-gray-50 px-4 py-3 border-b">
                        <div className="grid grid-cols-12 gap-4">
                          <div className="col-span-1 font-medium text-sm">ID</div>
                          <div className="col-span-5 font-medium text-sm">Nombre</div>
                          <div className="col-span-3 font-medium text-sm">Fecha de Vencimiento</div>
                          <div className="col-span-3 text-right font-medium text-sm">Valor</div>
                        </div>
                      </div>
                      
                      <div className="divide-y">
                      {selectedInvoice.payments?.length ? (
                        selectedInvoice.payments.map((payment: any, idx: number) => (
                          <div key={`payment-${payment.id ?? idx}`} className="px-4 py-3 hover:bg-gray-50">
                            <div className="grid grid-cols-12 gap-4 items-center">
                              <div className="col-span-1">
                                <span className="text-sm font-mono">{payment.id}</span>
                              </div>
                              <div className="col-span-5">
                                <div className="font-medium">{payment.name || 'Sin nombre'}</div>
                              </div>
                              <div className="col-span-3">
                                <span className="text-sm">
                                  {payment.due_date ? new Date(payment.due_date).toLocaleDateString('es-CO') : 'N/A'}
                                </span>
                              </div>
                              <div className="col-span-3 text-right font-medium">
                                ${Number(payment.value).toLocaleString('es-CO', {maximumFractionDigits: 2})}
                              </div>
                            </div>
                          </div>
                        ))
                      ) : (
                        <div className="px-4 py-8 text-center text-muted-foreground">
                          No hay pagos registrados para esta factura
                        </div>
                      )}
                    </div>
                  </div>
                </div>
                ) : selectedInvoice.payment && (
                  <div className="space-y-4">
                    <h3 className="text-lg font-semibold">Información de Pago</h3>
                    <div className="border rounded-lg overflow-hidden">
                      <div className="bg-gray-50 px-4 py-3 border-b">
                        <div className="grid grid-cols-12 gap-4">
                          <div className="col-span-2 font-medium text-sm">ID</div>
                          <div className="col-span-7 font-medium text-sm">Método de Pago</div>
                          <div className="col-span-3 text-right font-medium text-sm">Valor</div>
                        </div>
                      </div>
                      
                      <div className="divide-y">
                        <div className="px-4 py-3 hover:bg-gray-50">
                          <div className="grid grid-cols-12 gap-4 items-center">
                            <div className="col-span-2">
                              <span className="text-sm font-mono">{selectedInvoice.payment.id}</span>
                            </div>
                            <div className="col-span-7">
                              <div className="font-medium">{selectedInvoice.payment.name || 'Sin nombre'}</div>
                            </div>
                            <div className="col-span-3 text-right">
                              <div className="font-medium">
                                ${Number(selectedInvoice.payment.value || 0).toLocaleString('es-CO', {maximumFractionDigits: 2})}
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
                
                {/* Retenciones */}
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold">Retenciones</h3>
                  <div className="border rounded-lg overflow-hidden">
                    <div className="bg-gray-50 px-4 py-3 border-b">
                      <div className="grid grid-cols-12 gap-4">
                        <div className="col-span-2 font-medium text-sm">ID</div>
                        <div className="col-span-6 font-medium text-sm">Descripción</div>
                        <div className="col-span-4 text-right font-medium text-sm">Valor</div>
                      </div>
                    </div>
                    
                    <div className="divide-y">
                      {selectedInvoice.retentions?.length ? (
                        selectedInvoice.retentions.map((retention: any, idx: number) => (
                          <div key={`retention-${retention.id ?? idx}`} className="px-4 py-3 hover:bg-gray-50">
                            <div className="grid grid-cols-12 gap-4 items-center">
                              <div className="col-span-2">
                                <span className="text-sm font-mono">{retention.id || idx + 1}</span>
                              </div>
                              <div className="col-span-6">
                                <div className="font-medium">{retention.description || retention.name || 'Sin descripción'}</div>
                                {retention.type && (
                                  <div className="text-xs text-muted-foreground mt-1">
                                    Tipo: {retention.type}
                                  </div>
                                )}
                              </div>
                              <div className="col-span-4 text-right font-medium">
                                ${Number(retention.value || retention.amount || 0).toLocaleString('es-CO', {maximumFractionDigits: 2})}
                              </div>
                            </div>
                          </div>
                        ))
                      ) : (
                        <div className="px-4 py-8 text-center text-muted-foreground">
                          No hay retenciones registradas para esta factura
                        </div>
                      )}
                    </div>
                  </div>
                </div>
                
                {/* Resumen y Totales */}
                <div className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Información Adicional */}
                    <div className="space-y-2">
                      <h3 className="text-lg font-semibold">Información Adicional</h3>
                      <div className="space-y-3 text-sm">
                        {selectedInvoice.date && (
                          <div className="border rounded-lg p-3">
                            <p className="font-medium">Fecha de Factura:</p>
                            <p className="text-muted-foreground">{new Date(selectedInvoice.date).toLocaleDateString('es-CO')}</p>
                          </div>
                        )}
                        
                        {selectedInvoice.provider_invoice && (
                          <div className="border rounded-lg p-3">
                            <p className="font-medium">Factura del Proveedor:</p>
                            <p className="text-muted-foreground">
                              {selectedInvoice.provider_invoice.prefix}-{selectedInvoice.provider_invoice.number}
                            </p>
                          </div>
                        )}
                        
                        {selectedInvoice.observations && (
                          <div className="border rounded-lg p-3">
                            <p className="font-medium">Observaciones:</p>
                            <p className="text-sm text-muted-foreground whitespace-pre-wrap">{selectedInvoice.observations}</p>
                          </div>
                        )}
                        
                        {selectedInvoice.discount_type && (
                          <div className="border rounded-lg p-3">
                            <p className="font-medium">Tipo de descuento:</p>
                            <p className="text-muted-foreground">{selectedInvoice.discount_type}</p>
                          </div>
                        )}
                        
                        {selectedInvoice.balance !== undefined && (
                          <div className="border rounded-lg p-3">
                            <p className="font-medium">Saldo pendiente:</p>
                            <p className={Number(selectedInvoice.balance) > 0 ? 'text-amber-600' : 'text-green-600'}>
                              ${Number(selectedInvoice.balance).toLocaleString('es-CO', {maximumFractionDigits: 2})}
                            </p>
                          </div>
                        )}
                        
                        {(() => {
                          try {
                            const dateString = selectedInvoice.metadata?.created;
                            if (!dateString || typeof dateString !== 'string') return null;
                            
                            const timestamp = Date.parse(dateString);
                            if (isNaN(timestamp)) return null;
                            
                            const date = new Date(timestamp);
                            if (isNaN(date.getTime())) return null;
                            
                            const options: Intl.DateTimeFormatOptions = {
                              year: 'numeric',
                              month: '2-digit',
                              day: '2-digit',
                              hour: '2-digit',
                              minute: '2-digit',
                              hour12: true
                            };
                            
                            return (
                              <div className="border rounded-lg p-3">
                                <p className="font-medium">Fecha de Creación:</p>
                                <p className="text-muted-foreground">
                                  {date.toLocaleString('es-ES', options)}
                                </p>
                              </div>
                            );
                          } catch (error) {
                            console.error('Error al formatear la fecha:', error);
                            return null;
                          }
                        })()}
                      </div>
                    </div>

                    {/* Totales */}
                    <div className="space-y-2">
                      <h3 className="text-lg font-semibold">{selectedInvoice.type === 'FC' ? 'Resumen de Factura' : selectedInvoice.type === 'DebtPayment' ? 'Resumen de Pago' : 'Resumen Contable'}</h3>
                      <div className="space-y-2 text-sm">
                        {selectedInvoice.type === 'DebtPayment' ? (
                          // Para pagos de deuda (RP), mostrar información específica
                          <>
                            {selectedInvoice.payment && (
                              <div className="flex justify-between border-b pb-2">
                                <span className="font-medium">Método de pago:</span>
                                <span className="whitespace-nowrap font-medium">
                                  {selectedInvoice.payment.name || 'No especificado'}
                                </span>
                              </div>
                            )}
                            
                            {(selectedInvoice.items || [])?.map((item: InvoiceItem, idx: number) => (
                              <div key={`due-${idx}`} className="flex justify-between py-1">
                                <span>
                                  Factura: {item.due?.prefix || ''} {item.due?.consecutive || ''}
                                  {item.due?.date && <span className="text-xs text-muted-foreground ml-2">({new Date(item.due.date).toLocaleDateString('es-CO')})</span>}
                                </span>
                                <span className="whitespace-nowrap">${Number(item.total || 0).toLocaleString('es-CO', {minimumFractionDigits: 0, maximumFractionDigits: 0})}</span>
                              </div>
                            ))}
                            
                            <div className="flex justify-between pt-2 border-t mt-2 font-bold text-lg">
                              <span>Total:</span>
                              <span className="whitespace-nowrap">${Number(selectedInvoice.total || 0).toLocaleString('es-CO', {minimumFractionDigits: 0, maximumFractionDigits: 0})}</span>
                            </div>
                            
                            {selectedInvoice.observations && (
                              <div className="pt-2 border-t mt-2">
                                <p className="font-medium">Observaciones:</p>
                                <p className="text-sm text-muted-foreground whitespace-pre-wrap">{selectedInvoice.observations}</p>
                              </div>
                            )}
                          </>
                        ) : selectedInvoice.type === 'RC' ? (
                          // Para recibos de caja, mostrar el balance contable
                          <>
                            <div className="flex justify-between">
                              <span>Total Créditos:</span>
                              <span className="text-green-600 whitespace-nowrap">
                                +${selectedInvoice.items?.filter((item: any) => item.account?.movement === 'Credit')
                                  .reduce((sum: number, item: any) => sum + Number(item.price || 0), 0)
                                  .toLocaleString('es-CO', {minimumFractionDigits: 0, maximumFractionDigits: 0})}
                              </span>
                            </div>
                            
                            <div className="flex justify-between">
                              <span>Total Débitos:</span>
                              <span className="text-red-600 whitespace-nowrap">
                                -${selectedInvoice.items?.filter((item: any) => item.account?.movement === 'Debit')
                                  .reduce((sum: number, item: any) => sum + Number(item.price || 0), 0)
                                  .toLocaleString('es-CO', {minimumFractionDigits: 0, maximumFractionDigits: 0})}
                              </span>
                            </div>
                            
                            <div className="flex justify-between pt-2 border-t mt-2 font-bold text-lg">
                              <span>Balance:</span>
                              <span className={`whitespace-nowrap ${Number(selectedInvoice.total || 0) === 0 ? 'text-green-600' : 'text-red-600'}`}>
                                {Number(selectedInvoice.total || 0) === 0 ? '✓ Balanceado' : `$${Number(selectedInvoice.total || 0).toLocaleString('es-CO', {minimumFractionDigits: 0, maximumFractionDigits: 0})}`}
                              </span>
                            </div>
                          </>
                        ) : selectedInvoice.type === 'FC' ? (
                          // Para facturas de compra (FC), mostrar un resumen simplificado
                          <>
                            <div className="flex justify-between border-b pb-2">
                              <span className="font-medium">Subtotal:</span>
                              <span className="whitespace-nowrap font-medium">
                                ${(Number(selectedInvoice.total || 0) - (Number(selectedInvoice.tax || 0)) - (Number(selectedInvoice.discount || 0)))
                                  .toLocaleString('es-CO', {minimumFractionDigits: 0, maximumFractionDigits: 0})}
                              </span>
                            </div>
                            
                            {selectedInvoice.discount && Number(selectedInvoice.discount) > 0 && (
                              <div className="flex justify-between py-1">
                                <span>Descuento:</span>
                                <span className="text-red-600 whitespace-nowrap">
                                  -${Number(selectedInvoice.discount || 0).toLocaleString('es-CO', {minimumFractionDigits: 0, maximumFractionDigits: 0})}
                                </span>
                              </div>
                            )}
                            
                            {selectedInvoice.tax && Number(selectedInvoice.tax) > 0 && (
                              <div className="flex justify-between py-1">
                                <span>IVA:</span>
                                <span className="whitespace-nowrap">${Number(selectedInvoice.tax || 0).toLocaleString('es-CO', {minimumFractionDigits: 0, maximumFractionDigits: 0})}</span>
                              </div>
                            )}
                            
                            {selectedInvoice.retentions?.length > 0 && (
                              <div className="flex justify-between py-1">
                                <span>Retenciones:</span>
                                <span className="text-red-600 whitespace-nowrap">
                                  -${selectedInvoice.retentions.reduce((sum: number, retention: any) => 
                                    sum + Number(retention.value || retention.amount || 0), 0)
                                    .toLocaleString('es-CO', {minimumFractionDigits: 0, maximumFractionDigits: 0})}
                                </span>
                              </div>
                            )}
                            
                            <div className="flex justify-between pt-2 border-t mt-2 font-bold text-lg">
                              <span>Total:</span>
                              <span className="whitespace-nowrap">${Number(selectedInvoice.total || 0).toLocaleString('es-CO', {minimumFractionDigits: 0, maximumFractionDigits: 0})}</span>
                            </div>
                            
                            {selectedInvoice.balance !== undefined && Number(selectedInvoice.balance) > 0 && (
                              <div className="flex justify-between pt-2 border-t mt-2">
                                <span className="font-medium">Saldo pendiente:</span>
                                <span className="text-amber-600 whitespace-nowrap font-medium">${Number(selectedInvoice.balance).toLocaleString('es-CO', {minimumFractionDigits: 0, maximumFractionDigits: 0})}</span>
                              </div>
                            )}
                          </>
                        ) : (
                          // Para otros tipos de documentos, mostrar el resumen normal
                          <>
                            <div className="flex justify-between">
                              <span>Subtotal:</span>
                              <span className="whitespace-nowrap">
                                ${(Number(selectedInvoice.total || 0) - (Number(selectedInvoice.tax || 0)) - (Number(selectedInvoice.discount || 0)))
                                  .toLocaleString('es-CO', {minimumFractionDigits: 0, maximumFractionDigits: 0})}
                              </span>
                            </div>
                            
                            {selectedInvoice.discount && Number(selectedInvoice.discount) > 0 && (
                              <div className="flex justify-between">
                                <span>Descuento:</span>
                                <span className="text-red-600 whitespace-nowrap">
                                  -${Number(selectedInvoice.discount || 0).toLocaleString('es-CO', {minimumFractionDigits: 0, maximumFractionDigits: 0})}
                                </span>
                              </div>
                            )}
                            
                            {selectedInvoice.tax && Number(selectedInvoice.tax) > 0 && (
                              <div className="flex justify-between">
                                <span>Impuestos:</span>
                                <span className="whitespace-nowrap">${Number(selectedInvoice.tax || 0).toLocaleString('es-CO', {minimumFractionDigits: 0, maximumFractionDigits: 0})}</span>
                              </div>
                            )}
                            
                            <div className="flex justify-between pt-2 border-t mt-2 font-bold text-lg">
                              <span>Total:</span>
                              <span className="whitespace-nowrap">${Number(selectedInvoice.total || 0).toLocaleString('es-CO', {minimumFractionDigits: 0, maximumFractionDigits: 0})}</span>
                            </div>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <DialogFooter className="border-t pt-4 flex gap-2">
                <Button variant="outline" onClick={goToEditSelectedInvoice}>Editar</Button>
                <Button variant="destructive" onClick={handleDeleteSelectedInvoice} disabled={deleting}>{deleting ? 'Eliminando...' : 'Eliminar'}</Button>
                <Button variant="outline" onClick={closeViewer}>Cerrar</Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}