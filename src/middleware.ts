
import { NextResponse, type NextRequest } from 'next/server';

// Lee el dominio base desde las variables de entorno. Es la única fuente de verdad.
const BASE_HOST = (process.env.NEXT_PUBLIC_BASE_URL || 'localhost:3000').replace(/^https?:\/\//, '');

// Cache para los tenants válidos.
let cachedTenantIds: string[] | null = null;
let lastFetchTimestamp: number = 0;
const CACHE_DURATION_MS = 5 * 60 * 1000; // 5 minutos

async function fetchValidTenantSubdomains(request: NextRequest): Promise<string[]> {
  const now = Date.now();
  if (cachedTenantIds && (now - lastFetchTimestamp < CACHE_DURATION_MS)) {
    return cachedTenantIds;
  }

  try {
    const apiUrl = new URL('/api/get-tenants', request.nextUrl.origin);
    const response = await fetch(apiUrl.toString());

    if (!response.ok) {
      console.error(`Middleware: Error al obtener tenants: ${response.status}`);
      return cachedTenantIds || []; 
    }

    const data = await response.json();
    if (data && Array.isArray(data.tenantIds)) {
      cachedTenantIds = data.tenantIds;
      lastFetchTimestamp = now;
      console.log("Middleware: Subdominios de tenants actualizados:", cachedTenantIds);
      return cachedTenantIds!;
    }
  } catch (error) {
    console.error("Middleware: Excepción al obtener tenants:", error);
  }
  return cachedTenantIds || [];
}

export async function middleware(request: NextRequest) {
  const url = request.nextUrl.clone();
  
  // Ignorar rutas de API, assets estáticos, etc.
  if (
    url.pathname.startsWith('/api/') ||
    url.pathname.startsWith('/_next/') ||
    url.pathname.startsWith('/static/') ||
    url.pathname.includes('.') 
  ) {
    return NextResponse.next();
  }

  // Normalizar el hostname quitando el puerto.
  let hostname = (request.headers.get('host') || BASE_HOST).replace(/:\d+$/, '');
  
  // Forzar el hostname a ser el BASE_HOST si estamos en un entorno de desarrollo de Vercel/IDX
  // Esto previene que se usen URLs de preview como base para subdominios.
  if (hostname.endsWith('vercel.app') || hostname.endsWith('cloudworkstations.dev') || hostname.endsWith('app.idx.dev')) {
      hostname = BASE_HOST;
  }

  let tenantId: string | null = null;
  
  if (hostname.toLowerCase() !== BASE_HOST.toLowerCase()) {
    // Si el hostname no es el dominio base, intentamos extraer un subdominio.
    const potentialSubdomain = hostname.replace(`.${BASE_HOST}`, '');
    
    // Validar el subdominio contra una lista de tenants conocidos
    const validTenants = await fetchValidTenantSubdomains(request);
    if (validTenants.includes(potentialSubdomain)) {
        tenantId = potentialSubdomain;
        console.log(`Middleware: Tenant identificado: ${tenantId}`);
    } else {
        // Si el subdominio no es válido, redirigir al dominio base.
        console.warn(`Middleware: Subdominio desconocido '${potentialSubdomain}'. Redirigiendo al dominio base.`);
        const baseAppUrl = new URL(url.pathname, `https://${BASE_HOST}`);
        return NextResponse.redirect(baseAppUrl);
    }
  } else {
    // Estamos en el dominio base.
    console.log(`Middleware: Acceso al dominio base: ${hostname}`);
  }

  // Establecer la cabecera x-tenant-id para que el resto de la aplicación la use.
  const requestHeaders = new Headers(request.headers);
  if (tenantId) {
    requestHeaders.set('x-tenant-id', tenantId);
  } else {
    requestHeaders.delete('x-tenant-id'); 
  }
  
  return NextResponse.next({
    request: {
      headers: requestHeaders,
    },
  });
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
