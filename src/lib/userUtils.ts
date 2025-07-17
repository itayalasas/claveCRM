import { collection, getDocs, Timestamp as FirestoreTimestamp } from "firebase/firestore";
import { db } from "./firebase"; // Asumiendo que db está exportado desde @/lib/firebase
import type { User } from "./types"; // Asegúrate que la ruta y la interfaz User sean correctas

export async function getAllUsers(): Promise<User[]> {
  try {
    const usersCollectionRef = collection(db, "users");
    const querySnapshot = await getDocs(usersCollectionRef);
    const users = querySnapshot.docs.map(docSnap => {
      const data = docSnap.data();
      const createdAtTimestamp = data.createdAt as FirestoreTimestamp;
      return {
        id: docSnap.id,
        email: data.email || "",
        name: data.name || "",
        tenantId: data.tenantId || "",
        role: data.role || "",
        avatarUrl: data.avatarUrl || undefined,
        createdAt: createdAtTimestamp ? createdAtTimestamp.toDate().toISOString() : undefined,
        // Añade cualquier otro campo que necesites y que esté en tus documentos de usuario
      } as User; // Puedes hacer un type assertion si estás seguro de la estructura
    });
    console.log("getAllUsers fetched:", users); // Log para depuración
    return users;
  } catch (error) {
    console.error("Error al obtener todos los usuarios desde userUtils:", error);
    throw error; 
  }
}
