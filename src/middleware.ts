
import { NextResponse, type NextRequest } from 'next/server';

const BASE_HOST = (process.env.NEXT_PUBLIC_BASE_URL || 'localhost').replace(/:\d+$/, '');

// Cache for tenant IDs and timestamp of the last fetch
let cachedTenantIds: string[] | null = null;
let lastFetchTimestamp: number = 0;
const CACHE_DURATION_MS = 5 * 60 * 1000; // 5 minutes, adjust as needed

async function fetchProcessedTenantIds(request: NextRequest): Promise<string[]> {
  const now = Date.now();
  if (cachedTenantIds && (now - lastFetchTimestamp < CACHE_DURATION_MS)) {
    console.log("Middleware: fetchProcessedTenantIds - Using cached tenant IDs");
    return cachedTenantIds;
  }

  console.log("Middleware: fetchProcessedTenantIds - Fetching from API /api/get-tenants");
  try {
    const apiUrl = new URL('/api/get-tenants', request.nextUrl.origin);
    
    const response = await fetch(apiUrl.toString(), {
        // cache: 'no-store' // Use this to ensure fresh data if you don't use revalidate in the API route
    });

    if (!response.ok) {
      console.error(`Middleware: Error fetching /api/get-tenants: ${response.status} ${response.statusText}`);
      return cachedTenantIds || []; 
    }

    const data = await response.json();
    if (data && Array.isArray(data.tenantIds)) {
      cachedTenantIds = data.tenantIds;
      lastFetchTimestamp = now;
      console.log("Middleware: fetchProcessedTenantIds - Tenant IDs updated from API:", cachedTenantIds);
      return cachedTenantIds!;
    } else {
      console.warn("Middleware: fetchProcessedTenantIds - API response not in expected format.");
      return cachedTenantIds || [];
    }
  } catch (error) {
    console.error("Middleware: fetchProcessedTenantIds - Exception during fetch:", error);
    return cachedTenantIds || [];
  }
}

export async function middleware(request: NextRequest) {
  const url = request.nextUrl.clone();
  let hostname = (request.headers.get('host') || BASE_HOST).replace(/:\d+$/, '');

  console.log(`Middleware: Processing request for hostname: ${hostname}`);

  // Exclude API routes and static assets from tenant logic
  if (
    url.pathname.startsWith('/api/') ||
    url.pathname.startsWith('/_next/') ||
    url.pathname.startsWith('/static/') ||
    url.pathname.includes('.') 
  ) {
    return NextResponse.next();
  }

  const KNOWN_TENANTS = await fetchProcessedTenantIds(request);
  console.log(`Middleware: Dynamically loaded KNOWN_TENANTS: ${KNOWN_TENANTS}`);

  const parts = hostname.replace(`.${BASE_HOST}`, '').split('.');
  let tenantId: string | null = null;
  
  if (hostname === BASE_HOST || parts[0] === 'www' || (process.env.NEXT_PUBLIC_VERCEL_URL && hostname.endsWith(process.env.NEXT_PUBLIC_VERCEL_URL))) {
    console.log(`Middleware: Accessing base domain or Vercel preview: ${hostname}`);
  } else if (parts.length > 0 && parts[0] !== BASE_HOST.split('.')[0] && parts[0] !== '') {
    tenantId = parts[0];
    if (!KNOWN_TENANTS.includes(tenantId)) {
        console.warn(`Middleware: Unknown subdomain '${tenantId}'. Treating as no specific tenant.`);
        tenantId = null; 
    } else {
        console.log(`Middleware: Tenant identified: ${tenantId}`);
    }
  } else {
    console.log(`Middleware: Could not identify a specific tenant for hostname: ${hostname}.`);
  }

  const requestHeaders = new Headers(request.headers);
  if (tenantId) {
    requestHeaders.set('x-tenant-id', tenantId);
    console.log(`Middleware: Setting header x-tenant-id: ${tenantId}`);
  } else {
    requestHeaders.delete('x-tenant-id'); 
    console.log(`Middleware: No x-tenant-id header set.`);
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
