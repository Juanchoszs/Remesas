'use client';

import dynamic from 'next/dynamic';
import Link from 'next/link';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

// Importación dinámica con deshabilitación de SSR para el componente de historial
const HistorialSubidas = dynamic(
  () => import('@/components/analiticas/historial-subidas').then(mod => mod.HistorialSubidas),
  { 
    ssr: false,
    loading: () => (
      <div className="space-y-4">
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-full" />
      </div>
    )
  }
);

export default function HistorialAnaliticasPage() {
  return (
    <div className="container mx-auto py-8 space-y-6">
      <div className="flex flex-col space-y-4 md:flex-row md:items-center md:justify-between md:space-y-0">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Historial de Subidas</h1>
          <p className="text-muted-foreground text-sm md:text-base">
            Consulta y elimina archivos cargados previamente por tipo y mes.
          </p>
        </div>
        <Link
          href="/analiticas"
          className="inline-flex items-center justify-center px-4 py-2 text-sm font-medium rounded-md border border-input bg-background hover:bg-accent hover:text-accent-foreground transition-colors w-full md:w-auto"
        >
          ← Volver a Analíticas
        </Link>
      </div>

      <Card className="shadow-sm">
        <CardHeader>
          <CardTitle>Historial de Documentos</CardTitle>
          <CardDescription>
            Usa los filtros para seleccionar Tipo, Mes y Año. Puedes eliminar por fila o por el mes completo.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border">
            <HistorialSubidas onDeleted={async () => { /* la página del panel refrescará al volver */ }} />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
