"use client";

import React, { useEffect, useMemo, useState, useCallback } from "react";
import { toast } from "sonner";
import { RefreshCw, Trash2, Loader2, AlertTriangle } from "lucide-react";
import type { DocumentType } from "@/types/document.types";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";

type UploadedRow = {
  id: number;
  file_name: string;
  document_type: DocumentType | string;
  month: number;
  year: number;
  total_value: number;
  processed_rows: number;
  uploaded_at: string;
};

interface HistorialSubidasProps {
  documentType?: DocumentType | "ALL";
  onDeleted?: () => Promise<void> | void;
}

export function HistorialSubidas({ documentType = "ALL", onDeleted }: HistorialSubidasProps) {
  const [rows, setRows] = useState<UploadedRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [typeFilter, setTypeFilter] = useState<DocumentType | "ALL">(documentType);
  const [monthFilter, setMonthFilter] = useState<number | "ALL">("ALL");
  const [yearFilter, setYearFilter] = useState<number | "ALL">("ALL");

  const query = useMemo(() => {
    const params = new URLSearchParams();
    if (typeFilter && typeFilter !== "ALL") params.set("documentType", typeFilter);
    if (monthFilter !== "ALL") params.set("month", String(monthFilter));
    if (yearFilter !== "ALL") params.set("year", String(yearFilter));
    return params.toString() ? `?${params.toString()}` : "";
  }, [typeFilter, monthFilter, yearFilter]);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/analiticas/uploads${query}`);
      const data = await res.json();
      if (!res.ok || !data?.success) {
        throw new Error(data?.error || "No se pudieron cargar los registros");
      }
      setRows(data.data || []);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Error desconocido";
      setError(msg);
      toast.error("Error cargando historial", { description: msg });
    } finally {
      setLoading(false);
    }
  };

  const monthNames = [
    "Enero","Febrero","Marzo","Abril","Mayo","Junio",
    "Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"
  ];

  const currentYear = new Date().getFullYear();
  const yearOptions = useMemo(() => {
    // Construir opciones a partir de los datos cargados o últimos 5 años
    const yearsFromData = Array.from(new Set(rows.map(r => r.year))).sort((a,b) => b - a);
    if (yearsFromData.length > 0) return yearsFromData;
    return Array.from({ length: 5 }, (_, i) => currentYear - i);
  }, [rows, currentYear]);

  const handleBulkDelete = async () => {
    if (typeFilter === "ALL" || monthFilter === "ALL" || yearFilter === "ALL") {
      toast.error("Para eliminar en bloque, selecciona Tipo, Mes y Año");
      return;
    }
    const mes = monthNames[(monthFilter as number) - 1];
    const confirmed = window.confirm(`¿Eliminar todas las facturas de ${typeFilter} del mes ${mes} ${yearFilter}?`);
    if (!confirmed) return;
    const toastId = toast.loading("Eliminando registros filtrados...");
    try {
      const res = await fetch('/api/analiticas/eliminar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          documentType: typeFilter,
          month: monthFilter,
          year: yearFilter,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data?.success) {
        throw new Error(data?.error || data?.details || 'No se pudo eliminar');
      }
      await load();
      if (onDeleted) await onDeleted();
      toast.success(`Eliminados ${data.deletedCount || 0} registros`, { id: toastId });
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Error desconocido';
      toast.error('Error en eliminación masiva', { id: toastId, description: msg });
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query]);

  const formatMoney = (v: number) =>
    new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 }).format(
      Number(v || 0)
    );

  const [isDeleting, setIsDeleting] = useState<number | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [rowToDelete, setRowToDelete] = useState<UploadedRow | null>(null);

  const handleDeleteClick = (row: UploadedRow, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    console.log('Mostrando diálogo de confirmación para:', row.id, row.file_name);
    setRowToDelete(row);
    setDeleteDialogOpen(true);
  };

  const handleDelete = useCallback(async (row: UploadedRow) => {
    if (!row) {
      console.error('No se proporcionó un registro para eliminar');
      return;
    }

    const toastId = toast.loading(`Eliminando ${row.file_name}...`);
    setIsDeleting(row.id);
    
    try {
      console.log('Iniciando eliminación para el registro:', row);
      
      // Intentamos eliminar por ID
      console.log('Enviando solicitud de eliminación para ID:', row.id);
      const res = await fetch("/api/analiticas/eliminar", {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          "Accept": "application/json"
        },
        body: JSON.stringify({
          id: row.id,
          fileName: row.file_name,
          documentType: row.document_type,
          month: row.month,
          year: row.year
        }),
      });

      const data = await res.json().catch(() => ({}));
      console.log('Respuesta del servidor:', { status: res.status, data });
      
      if (!res.ok) {
        const errorMsg = data?.error || data?.details || `Error ${res.status}: ${res.statusText}`;
        console.error('Error en la respuesta del servidor:', errorMsg);
        throw new Error(errorMsg);
      }

      if (!data?.success) {
        const errorMsg = data?.error || data?.details || 'No se pudo eliminar el registro';
        console.error('Error en la eliminación:', errorMsg);
        throw new Error(errorMsg);
      }

      console.log('Eliminación exitosa, recargando datos...');
      
      // Refrescar la tabla
      await load();
      
      // Notificar al componente padre para actualizar las analíticas
      if (onDeleted) {
        await onDeleted();
      }

      toast.success("Registro eliminado exitosamente", { id: toastId });
    } catch (e) {
      console.error('Error en handleDelete:', e);
      const msg = e instanceof Error ? e.message : "Error desconocido al eliminar el registro";
      toast.error("Error al eliminar", { 
        id: toastId, 
        description: msg,
        action: {
          label: "Reintentar",
          onClick: () => handleDelete(row)
        }
      });
    } finally {
      setIsDeleting(null);
    }
  }, [load, onDeleted]);
  return (
    <>
      <ConfirmDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        title="¿Estás seguro?"
        description={
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-2 text-yellow-600 dark:text-yellow-500">
              <AlertTriangle className="h-5 w-5" />
              <span>Esta acción no se puede deshacer</span>
            </div>
            <p>
              ¿Estás seguro de que deseas eliminar el archivo <strong>{rowToDelete?.file_name}</strong>?
            </p>
          </div>
        }
        confirmText="Sí, eliminar"
        cancelText="Cancelar"
        variant="destructive"
        onConfirm={() => {
          if (rowToDelete) {
            handleDelete(rowToDelete);
          }
        }}
        onCancel={() => {
          console.log('Eliminación cancelada por el usuario');
          setRowToDelete(null);
        }}
      />
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-medium">Historial de Subidas</h3>
        <button
          onClick={load}
          className="inline-flex items-center text-sm text-blue-600 hover:text-blue-800 px-3 py-1 rounded hover:bg-blue-50"
          disabled={loading}
        >
          <RefreshCw className="h-4 w-4 mr-1" />
          {loading ? "Cargando..." : "Actualizar"}
        </button>
      </div>

      {error && (
        <div className="text-sm text-red-600">{error}</div>
      )}

      {/* Filtros */}
      <div className="flex flex-wrap items-end gap-3">
        <div>
          <label className="block text-xs text-gray-600 mb-1">Tipo</label>
          <select
            className="px-3 py-2 border rounded-md text-sm"
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value as DocumentType | 'ALL')}
          >
            <option value="ALL">Todos</option>
            <option value="FC">FC</option>
            <option value="RP">RP</option>
            <option value="DS">DS</option>
            <option value="ND">ND</option>
          </select>
        </div>
        <div>
          <label className="block text-xs text-gray-600 mb-1">Mes</label>
          <select
            className="px-3 py-2 border rounded-md text-sm"
            value={monthFilter}
            onChange={(e) => setMonthFilter(e.target.value === 'ALL' ? 'ALL' : Number(e.target.value))}
          >
            <option value="ALL">Todos</option>
            {monthNames.map((m, i) => (
              <option key={i} value={i+1}>{m}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs text-gray-600 mb-1">Año</label>
          <select
            className="px-3 py-2 border rounded-md text-sm"
            value={yearFilter}
            onChange={(e) => setYearFilter(e.target.value === 'ALL' ? 'ALL' : Number(e.target.value))}
          >
            <option value="ALL">Todos</option>
            {yearOptions.map(y => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <button
            onClick={load}
            className="inline-flex items-center text-sm text-blue-600 hover:text-blue-800 px-3 py-2 rounded border hover:bg-blue-50"
            disabled={loading}
            title="Aplicar filtros"
          >
            <RefreshCw className="h-4 w-4 mr-1" /> {loading ? 'Cargando...' : 'Aplicar'}
          </button>
          <button
            onClick={handleBulkDelete}
            className="inline-flex items-center text-sm text-red-600 hover:text-red-800 px-3 py-2 rounded border hover:bg-red-50"
            disabled={loading}
            title="Eliminar todo del filtro"
          >
            <Trash2 className="h-4 w-4 mr-1" /> Eliminar del mes
          </button>
        </div>
      </div>

      <div className="overflow-auto border rounded-md">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-50 text-gray-700">
            <tr>
              <th className="text-left px-3 py-2">Fecha</th>
              <th className="text-left px-3 py-2">Tipo</th>
              <th className="text-left px-3 py-2">Mes</th>
              <th className="text-left px-3 py-2">Año</th>
              <th className="text-left px-3 py-2">Total</th>
              <th className="text-left px-3 py-2">Filas</th>
              <th className="text-left px-3 py-2">Archivo</th>
              <th className="text-right px-3 py-2">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td colSpan={8} className="text-center text-gray-500 py-6">
                  {loading ? "Cargando..." : "No hay registros"}
                </td>
              </tr>
            )}
            {rows.map((r) => (
              <tr key={r.id} className="border-t hover:bg-gray-50">
                <td className="px-3 py-2 whitespace-nowrap">
                  {new Date(r.uploaded_at).toLocaleString("es-CO")}
                </td>
                <td className="px-3 py-2">{r.document_type}</td>
                <td className="px-3 py-2">{String(r.month).padStart(2, "0")}</td>
                <td className="px-3 py-2">{r.year}</td>
                <td className="px-3 py-2">{formatMoney(r.total_value)}</td>
                <td className="px-3 py-2">{r.processed_rows}</td>
                <td className="px-3 py-2 truncate max-w-xs" title={r.file_name}>{r.file_name}</td>
                <td className="px-3 py-2 text-right">
                  <button
                    onClick={(e) => handleDeleteClick(r, e)}
                    className="inline-flex items-center text-xs text-red-600 hover:text-red-800 px-2 py-1 rounded hover:bg-red-50 disabled:opacity-50 disabled:cursor-not-allowed"
                    disabled={loading || isDeleting === r.id}
                    title={isDeleting === r.id ? "Eliminando..." : "Eliminar registro"}
                  >
                    {isDeleting === r.id ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                        <span>Eliminando...</span>
                      </>
                    ) : (
                      <>
                        <Trash2 className="h-4 w-4 mr-1" />
                        <span>Eliminar</span>
                      </>
                    )}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
    </>
  );
}
