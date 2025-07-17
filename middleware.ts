
import { NextResponse, type NextRequest } from 'next/server';

const BASE_HOST = process.env.NEXT_PUBLIC_BASE_URL || 'localhost:9000';

// Cache para los tenant IDs y timestamp de la última carga
let cachedTenantIds: string[] | null = null;
let lastFetchTimestamp: number = 0;
const CACHE_DURATION_MS = 5 * 60 * 1000; // 5 minutos, ajústalo según sea necesario

async function fetchProcessedTenantIds(request: NextRequest): Promise<string[]> {
  const now = Date.now();
  if (cachedTenantIds && (now - lastFetchTimestamp < CACHE_DURATION_MS)) {
    console.log("Middleware: fetchProcessedTenantIds - Usando caché de tenant IDs");
    return cachedTenantIds;
  }

  console.log("Middleware: fetchProcessedTenantIds - Realizando fetch a la API /api/get-tenants");
  try {
    // Construir la URL absoluta para la llamada fetch dentro del middleware
    // ya que el middleware se ejecuta en el "edge" y no conoce el host relativo por defecto.
    const apiUrl = new URL('/api/get-tenants', request.nextUrl.origin);
    
    const response = await fetch(apiUrl.toString(), {
        // Considera añadir headers si tu API los requiere, ej. para autenticación interna
        // cache: 'no-store' // Para asegurar que siempre obtienes la data más fresca si no usas revalidate en la API route
    });

    if (!response.ok) {
      console.error(`Middleware: Error al hacer fetch a /api/get-tenants: ${response.status} ${response.statusText}`);
      // Devolver la caché antigua si existe, o una lista vacía/default si no.
      return cachedTenantIds || []; 
    }

    const data = await response.json();
    if (data && Array.isArray(data.tenantIds)) {
      cachedTenantIds = data.tenantIds;
      lastFetchTimestamp = now;
      console.log("Middleware: fetchProcessedTenantIds - Tenant IDs actualizados desde la API:", cachedTenantIds);
      return cachedTenantIds!;
    } else {
      console.warn("Middleware: fetchProcessedTenantIds - La respuesta de la API no tiene el formato esperado.");
      return cachedTenantIds || []; // Devolver la caché antigua si existe
    }
  } catch (error) {
    console.error("Middleware: fetchProcessedTenantIds - Excepción durante el fetch:", error);
    // Devolver la caché antigua si existe, o una lista vacía/default si no.
    return cachedTenantIds || [];
  }
}

export async function middleware(request: NextRequest) {
  const url = request.nextUrl.clone();
  let hostname = request.headers.get('host') || BASE_HOST;

  if (hostname.includes(':') && !BASE_HOST.includes(':')) {
    hostname = hostname.split(':')[0];
  }
  
  console.log(`Middleware: Hostname original: ${request.headers.get('host')}`);
  console.log(`Middleware: Hostname procesado: ${hostname}`);
  console.log(`Middleware: BASE_HOST: ${BASE_HOST}`);

  // Excluir /api/get-tenants de la lógica de tenant para evitar bucles y procesamiento innecesario
  if (url.pathname.startsWith('/api/get-tenants')) {
    return NextResponse.next();
  }

  if (
    url.pathname.startsWith('/api/') || // otras rutas de api
    url.pathname.startsWith('/_next/') ||
    url.pathname.startsWith('/static/') ||
    url.pathname.includes('.') 
  ) {
    return NextResponse.next();
  }

  const KNOWN_TENANTS = await fetchProcessedTenantIds(request);
  console.log(`Middleware: KNOWN_TENANTS cargados dinámicamente: ${KNOWN_TENANTS}`);

  const parts = hostname.replace(`.${BASE_HOST}`, '').split('.');
  let tenantId: string | null = null;
  
  console.log(`Middleware: Parts después de reemplazar BASE_HOST y split: ${parts}`);

  if (hostname === BASE_HOST || parts[0] === 'www' || hostname.endsWith(process.env.NEXT_PUBLIC_VERCEL_URL || 'nevermatchthis.com')) {
    console.log(`Middleware: Acceso al dominio base o preview de Vercel: ${hostname}`);
  } else if (parts.length > 0 && parts[0] !== BASE_HOST.split('.')[0] && parts[0] !== '') {
    tenantId = parts[0];
    if (!KNOWN_TENANTS.includes(tenantId) && tenantId !== process.env.NEXT_PUBLIC_ADMIN_SUBDOMAIN) {
        console.warn(`Middleware: Subdominio desconocido '${tenantId}'. Se tratará como si no hubiera tenant específico.`);
        tenantId = null; 
    } else {
        console.log(`Middleware: Tenant identificado: ${tenantId}`);
    }
  } else {
    console.log(`Middleware: No se pudo identificar un tenant específico para el hostname: ${hostname}. Parts: ${parts}`);
  }

  const requestHeaders = new Headers(request.headers);
  if (tenantId) {
    requestHeaders.set('x-tenant-id', tenantId);
    console.log(`Middleware: Estableciendo header x-tenant-id: ${tenantId}`);
  } else {
    requestHeaders.delete('x-tenant-id'); 
    console.log(`Middleware: No se estableció x-tenant-id.`);
  }

  return NextResponse.next({
    request: {
      headers: requestHeaders,
    },
  });
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\.(?:svg|png|jpg|jpeg|gif|webp)$).*)', // Ajustado para no excluir todas las /api
  ],
};
