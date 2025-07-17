
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
    // In a real scenario, this might cause the API to consistently fail.
  }
} else {
  adminApp = getApps()[0];
}

const db = getFirestore(adminApp!);

export async function GET(request: Request) {
  try {
    const tenantsSnapshot = await db.collection('users').where('tenantId', '!=', null).get();
    const tenantIds: string[] = [];

    if (tenantsSnapshot.empty) {
      console.log('API get-tenants: No users with tenantId found in Firestore.');
      return NextResponse.json({ tenantIds: [] });
    }

    tenantsSnapshot.forEach(doc => {
      const data = doc.data();
      const tenantId = data.tenantId as string; 

      if (tenantId && !tenantIds.includes(tenantId)) {
        tenantIds.push(tenantId);
      }
    });

    console.log('API get-tenants: Processed tenants from users collection:', tenantIds);
    return NextResponse.json({ tenantIds });

  } catch (error) {
    console.error('API get-tenants: Error fetching tenants from users collection:', error);
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
