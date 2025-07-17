
import { NextResponse } from 'next/server';
import { initializeApp, getApps, cert, App } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

let adminApp: App;

if (!getApps().length) {
  try {
    const serviceAccountJson = process.env.FIREBASE_ADMIN_SERVICE_ACCOUNT_JSON;
    if (serviceAccountJson) {
      const serviceAccount = JSON.parse(serviceAccountJson);
      adminApp = initializeApp({
        credential: cert(serviceAccount),
      });
      console.log('API get-tenants: Firebase Admin SDK initialized with service account JSON.');
    } else {
      console.error("API get-tenants: FIREBASE_ADMIN_SERVICE_ACCOUNT_JSON env variable not set.");
      throw new Error("Firebase Admin SDK credentials not found.");
    }
  } catch (e: any) {
    console.error("API get-tenants: CRITICAL error initializing Firebase Admin SDK:", e.message);
  }
} else {
  adminApp = getApps()[0];
}

const db = getFirestore(adminApp!);

export async function GET(request: Request) {
  try {
    const tenantsSnapshot = await db.collection('tenants').get();
    const subdomains: string[] = [];

    if (tenantsSnapshot.empty) {
      console.log('API get-tenants: No documents found in "tenants" collection.');
      return NextResponse.json({ tenantIds: [] });
    }

    const baseDomain = (process.env.NEXT_PUBLIC_BASE_URL || '').replace(/:\d+$/, '');

    tenantsSnapshot.forEach(doc => {
      const data = doc.data();
      const tenantDomain = data.domain as string; 
      
      if (tenantDomain && typeof tenantDomain === 'string' && tenantDomain.toLowerCase() !== baseDomain.toLowerCase()) {
        const subdomain = tenantDomain.split('.')[0];
        if (subdomain && subdomain.toLowerCase() !== 'www') {
           subdomains.push(subdomain);
        }
      } else {
        // This includes cases where tenantDomain matches baseDomain, which we don't treat as a subdomain.
        console.log(`API get-tenants: Document ${doc.id} has a domain that is the base domain or is invalid. Skipping.`);
      }
    });
    
    const uniqueSubdomains = [...new Set(subdomains)];

    console.log('API get-tenants: Processed valid subdomains from "tenants" collection:', uniqueSubdomains);
    // The middleware expects a list of valid subdomains (which it calls tenantIds for simplicity).
    return NextResponse.json({ tenantIds: uniqueSubdomains });

  } catch (error) {
    console.error('API get-tenants: Error fetching from "tenants" collection:', error);
    let errorMessage = 'Internal Server Error';
    if (error instanceof Error) {
        errorMessage = error.message;
    }
    return NextResponse.json({ 
      error: 'Failed to fetch tenants from Firestore.', 
      details: process.env.NODE_ENV === 'development' ? errorMessage : undefined 
    }, { status: 500 });
  }
}

export const dynamic = 'force-dynamic';
