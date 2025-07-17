
import { NextResponse } from 'next/server';
import { initializeApp, getApps, cert, App } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

// --- Configuración de Firebase Admin SDK ---
// Es crucial que Firebase Admin SDK se inicialice correctamente.
// Esta es una configuración genérica. ADÁPTALA a tu proyecto.

let adminApp: App;

if (!getApps().length) {
  const serviceAccountJson = process.env.FIREBASE_ADMIN_SERVICE_ACCOUNT_JSON;

  if (serviceAccountJson) {
    const serviceAccount = JSON.parse(serviceAccountJson);
    adminApp = initializeApp({
      credential: cert(serviceAccount),
    });
  } else if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    // Si GOOGLE_APPLICATION_CREDENTIALS está configurado (apuntando a la ruta del archivo JSON),
    // initializeApp() lo usará automáticamente.
    adminApp = initializeApp();
    console.log('Firebase Admin SDK inicializado con GOOGLE_APPLICATION_CREDENTIALS.');
  } else {
    // Fallback para entornos donde ADC podría estar implícitamente disponible (ej. Google Cloud Functions, Cloud Run)
    // o si no se proporcionan credenciales explícitas y se espera que funcione de otra manera.
    try {
        adminApp = initializeApp();
        console.warn("Firebase Admin SDK inicializado sin credenciales explícitas. Dependiendo del entorno (ej. emulador local sin configuración ADC), esto podría no funcionar para acceder a Firestore.");
    } catch (e: any) {
        console.error("Error CRÍTICO al inicializar Firebase Admin SDK:", e.message);
        // No se puede continuar si Firebase Admin no se inicializa.
        // En un escenario real, podrías arrojar un error aquí para detener el inicio del servidor
        // o manejarlo de forma que la API devuelva un error claro.
    }
  }
} else {
  adminApp = getApps()[0];
}

const db = getFirestore(adminApp);
// --- Fin Configuración de Firebase Admin SDK ---

export async function GET(request: Request) {
  try {
    const tenantsSnapshot = await db.collection('tenants').get();
    const tenantIds: string[] = [];

    if (tenantsSnapshot.empty) {
      console.log('API get-tenants: No tenants found in Firestore.');
      return NextResponse.json({ tenantIds: [] });
    }

    tenantsSnapshot.forEach(doc => {
      const data = doc.data();
      // El campo que contiene el dominio, ej: "clavecrm.midominio.com" o "clavecrm.com"
      const domainField = data.domain as string; 

      if (domainField && typeof domainField === 'string' && domainField.includes('.')) {
        const tenantId = domainField.split('.')[0];
        // Filtros básicos: no tomar 'www', 'localhost', o subdominios que coincidan con tu dominio base.
        // Ajusta 'process.env.NEXT_PUBLIC_BASE_URL_HOSTNAME_PART' si es necesario, o elimina si no aplica.
        const baseHostNamePart = (process.env.NEXT_PUBLIC_BASE_URL || '').split('.')[0]?.toLowerCase();
        
        if (tenantId && 
            tenantId.toLowerCase() !== 'www' && 
            tenantId.toLowerCase() !== 'localhost' &&
            (baseHostNamePart ? tenantId.toLowerCase() !== baseHostNamePart : true)
           ) {
          tenantIds.push(tenantId);
        }
      } else {
        console.warn(`API get-tenants: Documento de tenant ${doc.id} tiene un campo 'domain' ausente o con formato inválido: ${domainField}`);
      }
    });

    // Eliminar duplicados si los hubiera (aunque los identificadores de tenant deberían ser únicos)
    const uniqueTenantIds = [...new Set(tenantIds)];
    console.log('API get-tenants: Tenants procesados:', uniqueTenantIds);

    return NextResponse.json({ tenantIds: uniqueTenantIds });

  } catch (error) {
    console.error('API get-tenants: Error fetching tenants:', error);
    let errorMessage = 'Internal Server Error';
    if (error instanceof Error) {
        errorMessage = error.message;
    }
    // En desarrollo, podrías querer enviar más detalles del error.
    // En producción, sé más genérico.
    return NextResponse.json({ 
      error: 'Failed to fetch tenants from Firestore.', 
      details: process.env.NODE_ENV === 'development' ? errorMessage : undefined 
    }, { status: 500 });
  }
}

// Opcional: Configuración de la ruta para controlar el cacheo o el comportamiento dinámico.
// export const dynamic = 'force-dynamic'; // Asegura que la ruta se ejecute en cada solicitud.
// export const revalidate = 60; // Opcional: Regenera la página cada 60 segundos (ISR).
// Elige la estrategia que mejor se adapte a la frecuencia con la que cambian tus tenants.
// Para tenants que cambian raramente, 'revalidate' es una buena opción.
// Si cambian muy frecuentemente o necesitas la data más actualizada siempre, 'force-dynamic' o sin estas líneas (comportamiento por defecto de Next.js para rutas dinámicas).
