
import { NextResponse, type NextRequest } from 'next/server';

// Limpia la URL base, eliminando protocolo y puerto.
const BASE_HOST = (process.env.NEXT_PUBLIC_BASE_URL || 'localhost:3000').replace(/^https?:\/\//, '').replace(/:\d+$/, '');

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
  
  // Excluir rutas de API y assets estáticos.
  if (
    url.pathname.startsWith('/api/') ||
    url.pathname.startsWith('/_next/') ||
    url.pathname.startsWith('/static/') ||
    url.pathname.includes('.') 
  ) {
    return NextResponse.next();
  }

  // Obtener hostname y limpiarlo.
  let hostname = (request.headers.get('host') || BASE_HOST).replace(/:\d+$/, '');
  
  // Normalizar para entornos de preview de Vercel/Netlify
  if (process.env.NEXT_PUBLIC_VERCEL_URL && hostname.endsWith(process.env.NEXT_PUBLIC_VERCEL_URL)) {
    hostname = BASE_HOST;
  }
  // Normalizar para entornos de desarrollo como Firebase Studio/IDX
  if (hostname.endsWith('cloudworkstations.dev') || hostname.endsWith('app.idx.dev')) {
      hostname = BASE_HOST;
  }


  let tenantId: string | null = null;
  
  // Lógica de detección de subdominio
  if (hostname !== BASE_HOST) {
    // Si el hostname NO es el dominio base, intentamos extraer el subdominio.
    const potentialSubdomain = hostname.replace(`.${BASE_HOST}`, '');
    
    // Verificar si el subdominio extraído es válido.
    const validTenants = await fetchValidTenantSubdomains(request);
    if (validTenants.includes(potentialSubdomain)) {
      tenantId = potentialSubdomain;
      console.log(`Middleware: Tenant identificado: ${tenantId}`);
    } else {
      console.warn(`Middleware: Subdominio desconocido '${potentialSubdomain}'. Se tratará como dominio base.`);
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
