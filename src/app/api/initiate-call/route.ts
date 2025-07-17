
import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const { toNumber } = await request.json();

    if (!toNumber) {
      console.error("API Route (initiate-call): Error - 'toNumber' es requerido.");
      return NextResponse.json({ success: false, error: "El número de teléfono (toNumber) es requerido." }, { status: 400 });
    }

    // URL de tu función en Firebase (AJUSTA REGIÓN Y PROYECTO SI ES NECESARIO)
    // Ejemplo: https://us-central1-TU_PROYECTO_ID.cloudfunctions.net/initiateTwilioCall
    // O si es una Cloud Run v2: https://YOUR_FUNCTION_URL-run.app/initiateTwilioCall (esta URL la obtienes de Cloud Run)
    const fnUrl = `https://initiatetwiliocall-qmsru4jg3q-uc.a.run.app/initiateTwilioCall`; // Reemplaza con la URL real de tu función

    console.log(`API Route (initiate-call): Forwarding call request to ${toNumber} via Cloud Function: ${fnUrl}`);

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    // Añadir el encabezado de autorización si el secreto está definido
    if (process.env.CALL_FN_SECRET) {
      headers['Authorization'] = `Bearer ${process.env.CALL_FN_SECRET}`;
      console.log("API Route (initiate-call): Enviando encabezado de Autorización.");
    } else {
      console.warn("API Route (initiate-call): La variable de entorno CALL_FN_SECRET no está configurada. Llamando a la Cloud Function sin encabezado de Autorización.");
      // Considera si quieres permitir llamadas sin secreto o devolver un error aquí si el secreto es obligatorio.
      // Por ahora, procederá sin él, pero tu Cloud Function debería rechazarlo si espera un secreto.
    }

    const cloudFunctionResponse = await fetch(fnUrl, {
      method: 'POST',
      headers: headers,
      body: JSON.stringify({ toNumber })
    });

    if (!cloudFunctionResponse.ok) {
      const errorText = await cloudFunctionResponse.text();
      console.error(`API Route (initiate-call): Error desde Cloud Function (${cloudFunctionResponse.status}): ${errorText}`);
      return NextResponse.json({ success: false, error: `Error del servidor de llamadas: ${errorText}` }, { status: cloudFunctionResponse.status || 500 });
    }

    const data = await cloudFunctionResponse.json();
    console.log("API Route (initiate-call): Respuesta exitosa desde Cloud Function:", data);
    return NextResponse.json({ success: true, ...data });

  } catch (error: any) {
    console.error("API Route (initiate-call): Error procesando solicitud initiate-call:", error);
    let errorMessage = "Error interno del servidor en la ruta API.";
    if (error instanceof TypeError && error.message.toLowerCase().includes('failed to fetch')) {
        errorMessage = "No se pudo conectar al servicio de llamadas. Verifica la URL de la Cloud Function y la conectividad de red. Podría ser un problema de CORS si la Cloud Function no está configurada correctamente.";
        console.error("API Route (initiate-call): Error 'Failed to fetch'. Revisa la URL de la Cloud Function, conectividad, y si la Cloud Function está accesible y configurada para CORS si aplica (aunque para server-to-server CORS no es el problema usual).");
    } else {
        errorMessage = error.message || errorMessage;
    }
    return NextResponse.json({ success: false, error: errorMessage }, { status: 500 });
  }
}
