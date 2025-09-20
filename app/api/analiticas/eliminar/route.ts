import { NextResponse } from 'next/server';
import { sql, deleteUploadedFile } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';

export async function POST(request: Request) {
  // Mover la declaración de body al inicio para que esté disponible en el catch
  let body;
  try {
    body = await request.json();
    console.log('Solicitud de eliminación recibida:', JSON.stringify(body, null, 2));
    const { id, fileName, documentType, month, year } = body || {};
    
    // Validar que tengamos al menos un identificador
    if (!id && !(fileName || (documentType && month && year))) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Parámetros insuficientes',
          details: 'Se requiere al menos un ID o la combinación de tipo, mes y año' 
        },
        { status: 400 }
      );
    }

    // Obtener el ID de usuario actual
    let userId = 1;
    try {
      const user = await getCurrentUser();
      if (user?.id) userId = user.id;
    } catch (e) {
      console.warn('No se pudo obtener el usuario actual, usando ID 1');
    }

    // Si tenemos un ID, intentamos eliminar por ID
    if (id) {
      console.log(`Iniciando eliminación para ID: ${id}, Usuario: ${userId}`);
      
      try {
        // Usamos la función deleteUploadedFile que maneja la lógica de eliminación
        const { success, deletedCount } = await deleteUploadedFile(Number(id), userId);
        
        if (success) {
          console.log(`Eliminación exitosa. Registros eliminados: ${deletedCount}`);
          return NextResponse.json({ 
            success: true, 
            deletedCount,
            message: 'Registro eliminado exitosamente'
          });
        }
      } catch (error) {
        console.error('Error al eliminar por ID:', error);
        return NextResponse.json(
          { 
            success: false, 
            error: 'Error al eliminar el registro',
            details: error instanceof Error ? error.message : 'Error desconocido'
          },
          { status: 500 }
        );
      }
    }
    
    // Si no se proporcionó un ID, intentamos con los otros parámetros
    if (documentType && month && year) {
      try {
        // Construir la consulta dinámicamente usando template literals
        let result;
        
        if (fileName) {
          // Eliminar con nombre de archivo
          result = await sql`
            DELETE FROM uploaded_files
            WHERE document_type = ${documentType}
              AND month = ${month}
              AND year = ${year}
              AND file_name = ${fileName}
              AND (user_id = ${userId} OR ${userId} = 1)
            RETURNING *
          ` as any[];
          
          // Si no se encontró con el ID de usuario, intentar sin esa restricción
          if (!result || result.length === 0) {
            result = await sql`
              DELETE FROM uploaded_files
              WHERE document_type = ${documentType}
                AND month = ${month}
                AND year = ${year}
                AND file_name = ${fileName}
              RETURNING *
            ` as any[];
          }
        } else {
          // Eliminar sin nombre de archivo
          result = await sql`
            DELETE FROM uploaded_files
            WHERE document_type = ${documentType}
              AND month = ${month}
              AND year = ${year}
              AND (user_id = ${userId} OR ${userId} = 1)
            RETURNING *
          ` as any[];
          
          // Si no se encontró con el ID de usuario, intentar sin esa restricción
          if (!result || result.length === 0) {
            result = await sql`
              DELETE FROM uploaded_files
              WHERE document_type = ${documentType}
                AND month = ${month}
                AND year = ${year}
              RETURNING *
            ` as any[];
          }
        }
        
        if (result && result.length > 0) {
          return NextResponse.json({ 
            success: true, 
            deletedCount: result.length,
            data: result 
          });
        }
      } catch (error) {
        console.error('Error al eliminar por parámetros:', error);
        throw error;
      }
    }

    // Si llegamos aquí, no se pudo eliminar con ninguno de los métodos
    const errorMsg = id 
      ? `No se encontró ningún registro con ID ${id} o no tienes permisos para eliminarlo`
      : 'No se proporcionaron los parámetros necesarios para la eliminación';
      
    console.error(errorMsg);
    return NextResponse.json(
      { 
        success: false, 
        error: 'No se pudo eliminar el registro',
        details: errorMsg
      },
      { status: 404 }
    );
  } catch (error) {
    console.error('Error en /api/analiticas/eliminar:', error);
    const message = error instanceof Error ? error.message : 'Error desconocido';
    console.error('Error completo:', {
      message,
      stack: error instanceof Error ? error.stack : 'No hay stack trace disponible',
      body: JSON.stringify(body, null, 2)
    });
    return NextResponse.json(
      { 
        success: false, 
        error: 'Error interno del servidor', 
        details: message,
        timestamp: new Date().toISOString()
      },
      { status: 500 }
    );
  }
}
