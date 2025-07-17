
"use client";

import { useState, useEffect, useCallback } from "react";
import type { EscalationRule, User, SLA, SupportQueue, TicketPriority } from "@/lib/types";
import { NAV_ITEMS, ESCALATION_CONDITION_TYPES, ESCALATION_ACTION_TYPES, TICKET_PRIORITIES } from "@/lib/constants";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PlusCircle, Search, Filter, ClockIcon, AlertTriangle } from "lucide-react";
import { useAuth } from "@/contexts/auth-context";
import { useToast } from "@/hooks/use-toast";
import { Skeleton } from "@/components/ui/skeleton";
import { db } from "@/lib/firebase";
import { collection, addDoc, getDocs, deleteDoc, doc, serverTimestamp, query, orderBy, Timestamp, setDoc } from "firebase/firestore";
import { AddEditEscalationRuleDialog } from "@/components/settings/escalation-rules/add-edit-escalation-rule-dialog";
import { EscalationRuleListItem } from "@/components/settings/escalation-rules/escalation-rule-list-item";
import { Input } from "@/components/ui/input";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";


export default function EscalationRulesPage() {
  const navItem = NAV_ITEMS.flatMap(item => item.subItems || []).find(item => item.href === '/settings/escalation-rules');
  const PageIcon = navItem?.icon || ClockIcon;

  const [rules, setRules] = useState<EscalationRule[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [slas, setSlas] = useState<SLA[]>([]);
  const [supportQueues, setSupportQueues] = useState<SupportQueue[]>([]);


  const [isLoading, setIsLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingRule, setEditingRule] = useState<EscalationRule | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [ruleToDelete, setRuleToDelete] = useState<EscalationRule | null>(null);

  const { currentUser, getAllUsers } = useAuth();
  const { toast } = useToast();

  const fetchData = useCallback(async () => {
    if (!currentUser) {
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    try {
      const rulesQuery = query(collection(db, "escalationRules"), orderBy("order", "asc"));
      const slasQuery = query(collection(db, "slas"), orderBy("name", "asc"));
      const queuesQuery = query(collection(db, "supportQueues"), orderBy("name", "asc"));

      const [rulesSnapshot, slasSnapshot, queuesSnapshot, allUsersData] = await Promise.all([
        getDocs(rulesQuery),
        getDocs(slasQuery),
        getDocs(queuesQuery),
        getAllUsers(),
      ]);

      const fetchedRules = rulesSnapshot.docs.map(docSnap => ({ 
        id: docSnap.id, 
        ...docSnap.data(), 
        createdAt: (docSnap.data().createdAt as Timestamp)?.toDate().toISOString() || new Date(0).toISOString(),
        updatedAt: (docSnap.data().updatedAt as Timestamp)?.toDate().toISOString() || undefined,
       } as EscalationRule));
      setRules(fetchedRules);
      
      const fetchedSlas = slasSnapshot.docs.map(docSnap => ({ 
        id: docSnap.id, 
        ...docSnap.data(),
        createdAt: (docSnap.data().createdAt as Timestamp)?.toDate().toISOString() || new Date(0).toISOString(),
        updatedAt: (docSnap.data().updatedAt as Timestamp)?.toDate().toISOString() || undefined,
       } as SLA));
      setSlas(fetchedSlas);

      const fetchedQueues = queuesSnapshot.docs.map(docSnap => ({ 
        id: docSnap.id, 
        ...docSnap.data(),
        createdAt: (docSnap.data().createdAt as Timestamp)?.toDate().toISOString() || new Date(0).toISOString(),
        updatedAt: (docSnap.data().updatedAt as Timestamp)?.toDate().toISOString() || undefined,
      } as SupportQueue));
      setSupportQueues(fetchedQueues);
      
      setUsers(allUsersData);

    } catch (error) {
      console.error("Error fetching escalation rules data:", error);
      toast({ title: "Error al Cargar Reglas", description: String(error), variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  }, [currentUser, toast, getAllUsers]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleSaveRule = async (ruleData: Omit<EscalationRule, 'id' | 'createdAt' | 'updatedAt'>, id?: string) => {
    if (!currentUser) {
      toast({ title: "Error de autenticación", variant: "destructive" });
      return false;
    }
    try {
      const docId = id || doc(collection(db, "escalationRules")).id;
      const dataToSave: any = { // Use 'any' temporarily to allow optional fields
        ...ruleData,
        updatedAt: serverTimestamp(),
      };
      if (!id) {
        dataToSave.createdAt = serverTimestamp();
      }

      // Ensure optional fields that might be empty strings are converted to null or not sent if undefined
      Object.keys(dataToSave).forEach(key => {
        if (dataToSave[key as keyof typeof dataToSave] === undefined) {
            delete dataToSave[key as keyof typeof dataToSave];
        }
        if (dataToSave[key as keyof typeof dataToSave] === "") {
            dataToSave[key as keyof typeof dataToSave] = null;
        }
      });
      
      await setDoc(doc(db, "escalationRules", docId), dataToSave, { merge: true });
      toast({ title: id ? "Regla Actualizada" : "Regla Creada", description: `La regla de escalado "${ruleData.name}" ha sido guardada.` });
      fetchData(); // Refresh list
      return true;
    } catch (error) {
      console.error("Error saving escalation rule:", error);
      toast({ title: "Error al Guardar Regla", variant: "destructive" });
      return false;
    }
  };
  
  const confirmDeleteRule = (rule: EscalationRule) => {
    setRuleToDelete(rule);
  };

  const handleDeleteRule = async () => {
    if (!ruleToDelete || !currentUser) return;
    try {
      await deleteDoc(doc(db, "escalationRules", ruleToDelete.id)); 
      toast({ title: "Regla Eliminada", description: `La regla "${ruleToDelete.name}" ha sido eliminada.` });
      fetchData(); // Refresh list
    } catch (error) {
      console.error("Error deleting escalation rule:", error);
      toast({ title: "Error al Eliminar Regla", variant: "destructive" });
    } finally {
      setRuleToDelete(null);
    }
  };

  const filteredRules = rules.filter(rule =>
    rule.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (rule.description && rule.description.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  if (currentUser?.role !== 'admin' && currentUser?.role !== 'supervisor') {
    return (
        <Card className="m-auto mt-10 max-w-md">
            <CardHeader>
                <CardTitle className="flex items-center gap-2"><ClockIcon className="h-6 w-6 text-destructive"/>Acceso Denegado</CardTitle>
                <CardDescription>No tienes permisos para gestionar reglas de escalado.</CardDescription>
            </CardHeader>
        </Card>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <Card className="shadow-lg">
        <CardHeader>
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
            <div>
                <CardTitle className="flex items-center gap-2 text-2xl">
                <PageIcon className="h-6 w-6 text-primary" />
                Reglas de Escalado de Tickets
                </CardTitle>
                <CardDescription>
                Define reglas para escalar tickets automáticamente si no se cumplen los SLAs o permanecen inactivos. La ejecución de estas reglas ocurre en el backend.
                </CardDescription>
            </div>
            <Button onClick={() => { setEditingRule(null); setIsDialogOpen(true); }} disabled={isLoading}>
              <PlusCircle className="mr-2 h-4 w-4" /> Nueva Regla
            </Button>
          </div>
           <div className="flex gap-2 mt-4">
            <div className="relative flex-grow">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input 
                    type="search" 
                    placeholder="Buscar reglas por nombre o descripción..." 
                    className="pl-8 w-full"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                />
            </div>
            {/* <Button variant="outline" disabled>
                <Filter className="mr-2 h-4 w-4" /> Filtrar
            </Button> */}
        </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-4">
              {[...Array(2)].map((_, i) => <Skeleton key={i} className="h-28 w-full" />)}
            </div>
          ) : filteredRules.length > 0 ? (
            <div className="space-y-4">
              {filteredRules.map(rule => (
                <EscalationRuleListItem 
                  key={rule.id} 
                  rule={rule}
                  users={users}
                  supportQueues={supportQueues}
                  onEdit={() => { setEditingRule(rule); setIsDialogOpen(true); }}
                  onDelete={() => confirmDeleteRule(rule)}
                />
              ))}
            </div>
          ) : (
            <p className="text-center text-muted-foreground py-8">
              {searchTerm ? "No se encontraron reglas con ese criterio." : "No hay reglas de escalado definidas. Empieza creando una."}
            </p>
          )}
        </CardContent>
      </Card>
      
      <Card className="mt-4 bg-green-50 border-green-200">
        <CardHeader>
          <CardTitle className="flex items-center text-green-700 text-lg gap-2">
            <AlertTriangle className="h-5 w-5" />
            Estado de Desarrollo
          </CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-green-600">
          <ul className="list-disc list-inside space-y-2">
            <li>
              <strong>Definición de Reglas (UI):</strong>
              <Badge variant="default" className="ml-2 bg-green-500 hover:bg-green-600 text-white">Implementado</Badge>
              <p className="text-xs pl-5">Puedes crear, editar y eliminar reglas de escalado. Los datos para SLAs y Colas se cargan desde Firestore.</p>
            </li>
            <li>
              <strong>Ejecución de Reglas (Backend):</strong>
              <Badge variant="default" className="ml-2 bg-green-500 hover:bg-green-600 text-white">Activo (Backend Implementado)</Badge>
              <p className="text-xs pl-5">La Cloud Function `evaluateEscalationRules` está implementada y procesa las reglas activas periódicamente. Se recomienda monitorear su ejecución y logs.</p>
            </li>
             <li>
              <strong>Logs de Escalados:</strong>
              <Badge variant="default" className="ml-2 bg-green-500 hover:bg-green-600 text-white">Implementado (UI y Backend)</Badge>
              <p className="text-xs pl-5">La Cloud Function `logEscalationEvent` registra los logs. Puedes visualizarlos en "Administración" {">"} "Historial de Escalados".</p>
            </li>
             <li>
              <strong>Tipos de Condiciones/Acciones Avanzadas:</strong>
              <Badge variant="default" className="ml-2 bg-yellow-500 hover:bg-yellow-600 text-black">Parcial (UI/Backend Planeado)</Badge>
              <p className="text-xs pl-5">Se han añadido ejemplos en la UI (ej. Webhook). La implementación completa de condiciones/acciones más complejas (ej. análisis de sentimiento) requerirá desarrollo adicional en UI y backend.</p>
            </li>
             <li>
              <strong>Horarios Laborales en SLAs:</strong>
              <Badge variant="default" className="ml-2 bg-orange-500 hover:bg-orange-600 text-white">Pendiente (Backend)</Badge>
              <p className="text-xs pl-5">La lógica para que los SLAs consideren `businessHoursOnly` no está implementada en la Cloud Function y requiere una configuración de horario laboral.</p>
            </li>
          </ul>
        </CardContent>
      </Card>


      <AddEditEscalationRuleDialog
        isOpen={isDialogOpen}
        onOpenChange={setIsDialogOpen}
        ruleToEdit={editingRule}
        onSave={handleSaveRule}
        allUsers={users}
        allSlas={slas}
        allQueues={supportQueues}
        allPriorities={TICKET_PRIORITIES}
      />

      {ruleToDelete && (
        <AlertDialog open={!!ruleToDelete} onOpenChange={() => setRuleToDelete(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>¿Estás seguro?</AlertDialogTitle>
              <AlertDialogDescription>
                Esta acción no se puede deshacer. La regla de escalado &quot;{ruleToDelete.name}&quot; será eliminada permanentemente.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel onClick={() => setRuleToDelete(null)}>Cancelar</AlertDialogCancel>
              <AlertDialogAction onClick={handleDeleteRule} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                Sí, eliminar regla
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}
    </div>
  );
}
