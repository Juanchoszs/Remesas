import { NextResponse } from 'next/server';
import { sql } from '@/lib/db';
// import { getCurrentUser } from '@/lib/auth';

// Definir interfaz para los registros de archivos subidos
interface UploadedFileRecord {
  id: number;
  file_name: string;
  document_type: string;
  month: number;
  year: number;
  user_id: number;
  uploaded_at: string;
  file_size: number;
  mime_type: string;
  total_value: number;
}

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const documentType = searchParams.get('documentType') || undefined;
    const monthParam = searchParams.get('month');
    const yearParam = searchParams.get('year');
    const fileName = searchParams.get('fileName') || undefined;
    const month = monthParam ? parseInt(monthParam, 10) : undefined;
    const year = yearParam ? parseInt(yearParam, 10) : undefined;

    // Para el historial no dependemos de autenticación: no filtrar por user_id
    let rows: UploadedFileRecord[] = [];

    // Filtro específico por nombre de archivo (útil para validaciones de duplicado)
    if (fileName) {
      rows = await sql`
        SELECT * FROM uploaded_files
        WHERE file_name = ${fileName}
        ORDER BY uploaded_at DESC
      ` as UploadedFileRecord[];
      return NextResponse.json({ success: true, data: rows });
    }

    if (documentType && month && year) {
      rows = await sql`
        SELECT * FROM uploaded_files
        WHERE document_type = ${documentType}
          AND month = ${month}
          AND year = ${year}
        ORDER BY uploaded_at DESC
      ` as UploadedFileRecord[];
    } else if (documentType && month) {
      rows = await sql`
        SELECT * FROM uploaded_files
        WHERE document_type = ${documentType}
          AND month = ${month}
        ORDER BY uploaded_at DESC
      ` as UploadedFileRecord[];
    } else if (documentType && year) {
      rows = await sql`
        SELECT * FROM uploaded_files
        WHERE document_type = ${documentType}
          AND year = ${year}
        ORDER BY uploaded_at DESC
      ` as UploadedFileRecord[];
    } else if (documentType) {
      rows = await sql`
        SELECT * FROM uploaded_files
        WHERE document_type = ${documentType}
        ORDER BY uploaded_at DESC
      ` as UploadedFileRecord[];
    } else if (month && year) {
      rows = await sql`
        SELECT * FROM uploaded_files
        WHERE month = ${month}
          AND year = ${year}
        ORDER BY uploaded_at DESC
      ` as UploadedFileRecord[];
    } else if (month) {
      rows = await sql`
        SELECT * FROM uploaded_files
        WHERE month = ${month}
        ORDER BY uploaded_at DESC
      ` as UploadedFileRecord[];
    } else if (year) {
      rows = await sql`
        SELECT * FROM uploaded_files
        WHERE year = ${year}
        ORDER BY uploaded_at DESC
      ` as UploadedFileRecord[];
    } else {
      rows = await sql`
        SELECT * FROM uploaded_files
        ORDER BY uploaded_at DESC
      ` as UploadedFileRecord[];
    }

    return NextResponse.json({ success: true, data: rows });
  } catch (error) {
    console.error('Error in GET /api/analiticas/uploads:', error);
    const msg = error instanceof Error ? error.message : 'Error desconocido';
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}
