
"use client";

import { useState, useEffect, useCallback } from "react";
import type { SupportQueue, User, SLA } from "@/lib/types";
import { NAV_ITEMS } from "@/lib/constants"; // Removed INITIAL_SUPPORT_QUEUES, INITIAL_USERS, INITIAL_SLAS
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PlusCircle, Search, Filter, LayersIcon } from "lucide-react";
import { useAuth } from "@/contexts/auth-context";
import { useToast } from "@/hooks/use-toast";
import { Skeleton } from "@/components/ui/skeleton";
import { db } from "@/lib/firebase";
import { collection, addDoc, getDocs, deleteDoc, doc, serverTimestamp, query, orderBy, Timestamp, setDoc } from "firebase/firestore";
import { SupportQueueListItem } from "@/components/settings/support-queues/support-queue-list-item";
import { AddEditSupportQueueDialog } from "@/components/settings/support-queues/add-edit-support-queue-dialog";
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

export default function SupportQueueManagementPage() {
  const navItem = NAV_ITEMS.flatMap(item => item.subItems || []).find(item => item.href === '/settings/support-queues');
  const PageIcon = navItem?.icon || LayersIcon;

  const [queues, setQueues] = useState<SupportQueue[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [slas, setSlas] = useState<SLA[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingQueue, setEditingQueue] = useState<SupportQueue | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [queueToDelete, setQueueToDelete] = useState<SupportQueue | null>(null);

  const { currentUser, getAllUsers } = useAuth();
  const { toast } = useToast();

  const fetchData = useCallback(async () => {
    if (!currentUser) {
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    try {
      const qQueues = query(collection(db, "supportQueues"), orderBy("name", "asc")); // Order by name for consistency
      const queuesSnapshot = await getDocs(qQueues);
      const fetchedQueues = queuesSnapshot.docs.map(docSnap => {
        const data = docSnap.data();
        return { 
          id: docSnap.id, 
          ...data, 
          createdAt: (data.createdAt as Timestamp)?.toDate().toISOString() || new Date(0).toISOString(),
          updatedAt: (data.updatedAt as Timestamp)?.toDate().toISOString() || undefined,
        } as SupportQueue
      });
      setQueues(fetchedQueues);
      
      const allUsers = await getAllUsers();
      setUsers(allUsers);

      const qSlas = query(collection(db, "slas"), orderBy("name", "asc"));
      const slasSnapshot = await getDocs(qSlas);
      const fetchedSlas = slasSnapshot.docs.map(docSnap => {
        const data = docSnap.data();
        return { 
          id: docSnap.id, 
          ...data,
          createdAt: (data.createdAt as Timestamp)?.toDate().toISOString() || new Date(0).toISOString(),
          updatedAt: (data.updatedAt as Timestamp)?.toDate().toISOString() || undefined,
        } as SLA
      });
      setSlas(fetchedSlas);

    } catch (error) {
      console.error("Error fetching support queues data:", error);
      toast({ title: "Error al Cargar Datos", description: String(error), variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  }, [currentUser, toast, getAllUsers]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleSaveQueue = async (queueData: Omit<SupportQueue, 'id' | 'createdAt' | 'updatedAt'>, id?: string) => {
    if (!currentUser) {
      toast({ title: "Error de autenticación", variant: "destructive" });
      return false;
    }
    try {
      const docId = id || doc(collection(db, "supportQueues")).id;
      const dataToSave: any = { // Use any to allow optional fields from form
        ...queueData,
        updatedAt: serverTimestamp(),
      };
      if (!id) { // Only set createdAt if new
        dataToSave.createdAt = serverTimestamp();
      }

      // Ensure optional fields that might be empty strings/NO_SELECTION_VALUE are converted to null or not sent if undefined
      Object.keys(dataToSave).forEach(key => {
        if (dataToSave[key as keyof typeof dataToSave] === undefined) {
            delete dataToSave[key as keyof typeof dataToSave];
        }
        // Ensure specific fields that might use NO_SELECTION_VALUE are nulled if that's the case
        if ((key === 'defaultAssigneeUserId' || key === 'defaultSlaId') && dataToSave[key as keyof typeof dataToSave] === "__NONE__") {
            dataToSave[key as keyof typeof dataToSave] = null;
        }
      });
      
      await setDoc(doc(db, "supportQueues", docId), dataToSave, { merge: true }); 
      toast({ title: id ? "Cola Actualizada" : "Cola Creada", description: `La cola de soporte "${queueData.name}" ha sido guardada.` });
      fetchData(); // Refresh list
      return true;
    } catch (error) {
      console.error("Error saving support queue:", error);
      toast({ title: "Error al Guardar Cola", variant: "destructive" });
      return false;
    }
  };
  
  const confirmDeleteQueue = (queue: SupportQueue) => {
    setQueueToDelete(queue);
  };

  const handleDeleteQueue = async () => {
    if (!queueToDelete || !currentUser) return;
    try {
      await deleteDoc(doc(db, "supportQueues", queueToDelete.id)); 
      toast({ title: "Cola Eliminada", description: `La cola de soporte "${queueToDelete.name}" ha sido eliminada.` });
      fetchData(); // Refresh list
    } catch (error) {
      console.error("Error deleting support queue:", error);
      toast({ title: "Error al Eliminar Cola", variant: "destructive" });
    } finally {
      setQueueToDelete(null);
    }
  };

  const filteredQueues = queues.filter(queue =>
    queue.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (queue.description && queue.description.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  if (currentUser?.role !== 'admin' && currentUser?.role !== 'supervisor') {
    return (
        <Card className="m-auto mt-10 max-w-md">
            <CardHeader>
                <CardTitle className="flex items-center gap-2"><LayersIcon className="h-6 w-6 text-destructive"/>Acceso Denegado</CardTitle>
                <CardDescription>No tienes permisos para gestionar colas de soporte.</CardDescription>
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
                Gestión de Colas de Soporte
                </CardTitle>
                <CardDescription>
                Organiza los tickets en colas personalizadas para diferentes equipos o tipos de problemas.
                </CardDescription>
            </div>
            <Button onClick={() => { setEditingQueue(null); setIsDialogOpen(true); }} disabled={isLoading}>
              <PlusCircle className="mr-2 h-4 w-4" /> Nueva Cola
            </Button>
          </div>
           <div className="flex gap-2 mt-4">
            <div className="relative flex-grow">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input 
                    type="search" 
                    placeholder="Buscar colas por nombre o descripción..." 
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
              {[...Array(2)].map((_, i) => <Skeleton key={i} className="h-20 w-full" />)}
            </div>
          ) : filteredQueues.length > 0 ? (
            <div className="space-y-4">
              {filteredQueues.map(queue => (
                <SupportQueueListItem 
                  key={queue.id} 
                  queue={queue}
                  users={users}
                  slas={slas}
                  onEdit={() => { setEditingQueue(queue); setIsDialogOpen(true); }}
                  onDelete={() => confirmDeleteQueue(queue)}
                />
              ))}
            </div>
          ) : (
            <p className="text-center text-muted-foreground py-8">
              {searchTerm ? "No se encontraron colas con ese criterio." : "No hay colas de soporte definidas. Empieza creando una."}
            </p>
          )}
        </CardContent>
      </Card>

      <AddEditSupportQueueDialog
        isOpen={isDialogOpen}
        onOpenChange={setIsDialogOpen}
        queueToEdit={editingQueue}
        onSave={handleSaveQueue}
        allUsers={users}
        allSlas={slas}
      />

      {queueToDelete && (
        <AlertDialog open={!!queueToDelete} onOpenChange={() => setQueueToDelete(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>¿Estás seguro?</AlertDialogTitle>
              <AlertDialogDescription>
                Esta acción no se puede deshacer. La cola de soporte &quot;{queueToDelete.name}&quot; será eliminada permanentemente.
                Los tickets actualmente en esta cola deberán ser reasignados.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel onClick={() => setQueueToDelete(null)}>Cancelar</AlertDialogCancel>
              <AlertDialogAction onClick={handleDeleteQueue} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                Sí, eliminar cola
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}
    </div>
  );
}

    