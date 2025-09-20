import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  // Redirigir a la ruta consolidada de datos que usa la BD
  const target = new URL('/api/analiticas/data', request.url);
  return NextResponse.redirect(target, 307);
}
