import { NextResponse } from 'next/server';
import { sql } from '@/lib/db';

// Definición de tipos
interface ChartDataRow {
  month: number | string;
  year: number | string;
  total_value: string | number;
  processed_rows: number;
}

export async function GET(request: Request) {
  try {
    // Obtener parámetros de la URL
    const { searchParams } = new URL(request.url);
    const documentType = searchParams.get('documentType') || 'FC';
    const timeRange = searchParams.get('timeRange') || 'month';
    
    // TODO: Implementar autenticación real
    const userId = 1; // Temporalmente fijo, debería venir de la sesión

    // Obtener valores de fecha actual para filtros
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth() + 1; // Los meses en JS son 0-11
    const currentQuarter = Math.floor((currentMonth - 1) / 3) + 1;

    // Construir la consulta SQL con parámetros seguros
    let query = `
      WITH meses AS (
        SELECT 
          EXTRACT(MONTH FROM uploaded_at)::integer as mes,
          EXTRACT(YEAR FROM uploaded_at)::integer as anio,
          COALESCE(SUM(total_value), 0) as valor_total,
          COALESCE(SUM(processed_rows), 0) as filas_procesadas
        FROM 
          uploaded_files
        WHERE 
          user_id = ${userId}
          AND document_type = '${documentType}'
    `;

    // Añadir condiciones de filtrado según el rango de tiempo
    switch (timeRange) {
      case 'day':
        query += " AND uploaded_at >= CURRENT_DATE - INTERVAL '30 days'";
        break;
      case 'week':
        query += " AND uploaded_at >= CURRENT_DATE - INTERVAL '12 weeks'";
        break;
      case 'month':
        query += ` AND (EXTRACT(YEAR FROM uploaded_at) = ${currentYear} OR 
                       (EXTRACT(YEAR FROM uploaded_at) = ${currentYear - 1} AND 
                        EXTRACT(MONTH FROM uploaded_at) > ${currentMonth}))`;
        break;
      case 'quarter':
        const quarterStartMonth = (currentQuarter - 1) * 3 + 1;
        query += ` AND ((EXTRACT(YEAR FROM uploaded_at) = ${currentYear} AND 
                         EXTRACT(MONTH FROM uploaded_at) >= ${quarterStartMonth}) OR 
                        (EXTRACT(YEAR FROM uploaded_at) = ${currentYear - 1} AND 
                         EXTRACT(MONTH FROM uploaded_at) > ${quarterStartMonth}))`;
        break;
      case 'year':
        query += ` AND EXTRACT(YEAR FROM uploaded_at) >= ${currentYear - 4}`;
        break;
      default:
        query += ` AND (EXTRACT(YEAR FROM uploaded_at) = ${currentYear} OR 
                       (EXTRACT(YEAR FROM uploaded_at) = ${currentYear - 1} AND 
                        EXTRACT(MONTH FROM uploaded_at) > ${currentMonth}))`;
    }

    // Continuar con el resto de la consulta
    query += `
        GROUP BY 
          EXTRACT(YEAR FROM uploaded_at),
          EXTRACT(MONTH FROM uploaded_at)
      )
      SELECT 
        mes as month,
        anio as year,
        valor_total as total_value,
        filas_procesadas as processed_rows
      FROM 
        meses
      ORDER BY 
        anio ASC, mes ASC
    `;

    // Ejecutar la consulta SQL
    const result = await sql.unsafe(query) as unknown as { rows: ChartDataRow[] };


    // Format data for the chart
    const labels: string[] = [];  
    const values: number[] = [];
    
    result.rows.forEach((row: ChartDataRow) => {
      const monthNumber = typeof row.month === 'string' ? parseInt(row.month, 10) : row.month;
      const year = typeof row.year === 'string' ? parseInt(row.year, 10) : row.year;
      
      const monthNames = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
      const monthIndex = Number.isInteger(monthNumber) ? Math.max(0, Math.min(11, monthNumber - 1)) : 0;
      const monthName = monthNames[monthIndex] || '';
      
      const totalValue = typeof row.total_value === 'string' 
        ? parseFloat(row.total_value) 
        : Number(row.total_value);
      
      labels.push(`${monthName} ${year}`);
      values.push(Number.isFinite(totalValue) ? totalValue : 0);
    });

    return NextResponse.json({
      success: true,
      data: {
        labels,
        values,
        total: values.reduce((sum, val) => sum + val, 0).toFixed(2),
        count: values.length,
        documentType,
        timeRange
      }
    });

  } catch (error) {
    console.error('Error fetching chart data:', error);
    return NextResponse.json(
      { success: false, error: 'Error al cargar los datos del gráfico' },
      { status: 500 }
    );
  }
}
