
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
  
  if (
    url.pathname.startsWith('/api/') ||
    url.pathname.startsWith('/_next/') ||
    url.pathname.startsWith('/static/') ||
    url.pathname.includes('.') 
  ) {
    return NextResponse.next();
  }

  let hostname = (request.headers.get('host') || BASE_HOST).replace(/:\d+$/, '');
  
  // Si el hostname es el del entorno de desarrollo, lo tratamos como el dominio base.
  if (hostname.endsWith('cloudworkstations.dev') || hostname.endsWith('app.idx.dev')) {
      hostname = BASE_HOST;
  }

  let tenantId: string | null = null;
  
  if (hostname.toLowerCase() !== BASE_HOST.toLowerCase()) {
    const potentialSubdomain = hostname.replace(`.${BASE_HOST}`, '');
    
    // Aquí podrías añadir una llamada a una API para validar que el subdominio existe en tu DB
    // Por ahora, asumimos que cualquier subdominio es un tenantId potencial.
    // Esto se gestiona mejor con una lista de tenants válidos.
    const validTenants = await fetchValidTenantSubdomains(request);
    if (validTenants.includes(potentialSubdomain)) {
        tenantId = potentialSubdomain;
        console.log(`Middleware: Tenant identificado: ${tenantId}`);
    } else {
        console.warn(`Middleware: Subdominio desconocido '${potentialSubdomain}'. Redirigiendo al dominio base.`);
        return NextResponse.redirect(new URL(url.pathname, `https://${BASE_HOST}`));
    }
  } else {
    console.log(`Middleware: Acceso al dominio base: ${hostname}`);
  }

  const requestHeaders = new Headers(request.headers);
  if (tenantId) {
    requestHeaders.set('x-tenant-id', tenantId);
    console.log(`Middleware: Estableciendo cabecera x-tenant-id: ${tenantId}`);
  } else {
    requestHeaders.delete('x-tenant-id'); 
    console.log(`Middleware: Sin cabecera x-tenant-id.`);
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
