
export class SiigoAuthError extends Error {
  constructor(message: string, public readonly details?: unknown) {
    super(message);
    this.name = 'SiigoAuthError';
  }
}

let __siigoCachedToken: string | null = null;
let __siigoCachedExpiry = 0; // epoch ms
let __siigoTokenPromise: Promise<string> | null = null;

const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));

export function invalidateSiigoToken() {
  __siigoCachedToken = null;
  __siigoCachedExpiry = 0;
}

export async function obtenerTokenSiigo(forceRefresh = false): Promise<string> {
  const username = process.env.SIIGO_USERNAME;
  const accessKey = process.env.SIIGO_ACCESS_KEY;
  const partnerId = process.env.SIIGO_PARTNER_ID || '';

  if (!username || !accessKey || !partnerId) {
    const errorMessage = '[SIIGO-AUTH] ❌ Credenciales faltantes';
    const missing = [
      !username && 'SIIGO_USERNAME',
      !accessKey && 'SIIGO_ACCESS_KEY',
      !partnerId && 'SIIGO_PARTNER_ID'
    ].filter(Boolean).join(', ');
    
    throw new SiigoAuthError(`${errorMessage}: ${missing}`);
  }

  const now = Date.now();
  if (!forceRefresh && __siigoCachedToken && now < __siigoCachedExpiry) {
    return __siigoCachedToken;
  }
  if (!forceRefresh && __siigoTokenPromise) {
    return __siigoTokenPromise;
  }

  const credentials = Buffer.from(`${username}:${accessKey}`).toString('base64');
  const authUrl = process.env.SIIGO_AUTH_URL || 'https://api.siigo.com/auth';

  const fetchToken = async (): Promise<string> => {
    // Hasta 2 intentos con manejo de 429
    for (let attempt = 1; attempt <= 2; attempt++) {
      const response = await fetch(authUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          Authorization: `Basic ${credentials}`,
          'Partner-Id': partnerId,
        },
        body: JSON.stringify({
          username,
          access_key: accessKey,
          partner_id: partnerId,
        }),
      });

      const text = await response.text();
      let responseData: any = {};
      try { responseData = text ? JSON.parse(text) : {}; } catch {}

      if (response.status === 429) {
        const retryAfter = Number(response.headers.get('retry-after') || 1);
        await delay((retryAfter > 0 ? retryAfter : 1) * 1000);
        continue;
      }

      if (!response.ok) {
        const errors = responseData?.Errors || responseData?.errors;
        const msg = Array.isArray(errors) && errors[0]?.Message
          ? errors[0].Message
          : (responseData?.error_description || responseData?.error || 'Error desconocido');
        throw new SiigoAuthError(
          `Error en autenticación: ${msg}`,
          { status: response.status, response: responseData }
        );
      }

      const token = responseData?.access_token as string | undefined;
      const expiresIn = Number(responseData?.expires_in || 3600);
      if (!token) {
        throw new SiigoAuthError('No se recibió token de acceso', responseData);
      }
      __siigoCachedToken = token;
      __siigoCachedExpiry = Date.now() + (expiresIn - 300) * 1000; // refrescar 5 min antes
      return token;
    }

    throw new SiigoAuthError('Rate limit de autenticación agotado (429)');
  };

  try {
    __siigoTokenPromise = fetchToken();
    const token = await __siigoTokenPromise;
    return token;
  } catch (error) {
    if (error instanceof SiigoAuthError) {
      console.error(`[SIIGO-AUTH] ❌ ${error.message}`);
      throw error;
    }
    const errorMessage = error instanceof Error ? error.message : 'Error desconocido';
    console.error('[SIIGO-AUTH] ❌ Error en la petición:', error);
    throw new SiigoAuthError(`Error en la petición: ${errorMessage}`, error);
  } finally {
    __siigoTokenPromise = null;
  }
}
