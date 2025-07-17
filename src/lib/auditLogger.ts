
import { db } from './firebase';
import { collection, addDoc, serverTimestamp, Timestamp } from 'firebase/firestore';
import type { ActivityLogSystemAuditActionType, User } from './types';

export async function logSystemEvent(
  performingUser: User | null,
  actionType: ActivityLogSystemAuditActionType,
  entityType?: string,
  entityId?: string,
  actionDetails?: string,
  subject?: string
) {
  if (!performingUser) {
    console.warn("Attempted to log system event without a performing user. Event not logged.");
    // In some cases, like automated system events, you might want a generic 'system' user.
    // For now, we require a user.
    return;
  }

  try {
    const logEntry = {
      category: 'system_audit' as const,
      type: actionType,
      subject: subject || `${entityType || 'Sistema'} ${actionType}`,
      details: actionDetails || `Acción ${actionType} realizada en ${entityType || 'sistema'}${entityId ? ` (ID: ${entityId})` : ''}.`,
      timestamp: serverTimestamp(), // Changed to serverTimestamp
      loggedByUserId: performingUser.id,
      loggedByUserName: performingUser.name,
      entityType: entityType,
      entityId: entityId,
      createdAt: serverTimestamp(), // Firestore server timestamp
    };
    await addDoc(collection(db, "activityLogs"), logEntry);
  } catch (error) {
    console.error("Error logging system event to Firestore:", error);
    // Optionally, you could implement a fallback logging mechanism here
  }
}

