
"use client";

import { useState, useEffect, useCallback } from "react";
import type { SLA, TicketPriority } from "@/lib/types";
import { NAV_ITEMS, TICKET_PRIORITIES } from "@/lib/constants";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PlusCircle, Search, Filter, ShieldCheck } from "lucide-react";
import { useAuth } from "@/contexts/auth-context";
import { useToast } from "@/hooks/use-toast";
import { Skeleton } from "@/components/ui/skeleton";
import { db } from "@/lib/firebase";
import { collection, addDoc, getDocs, deleteDoc, doc, serverTimestamp, query, orderBy, Timestamp, setDoc } from "firebase/firestore";
import { SlaListItem } from "@/components/settings/slas/sla-list-item";
import { AddEditSlaDialog } from "@/components/settings/slas/add-edit-sla-dialog";
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
import { isValid, parseISO } from "date-fns";

export default function SlaManagementPage() {
  const navItem = NAV_ITEMS.flatMap(item => item.subItems || []).find(item => item.href === '/settings/slas');
  const PageIcon = navItem?.icon || ShieldCheck;

  const [slas, setSlas] = useState<SLA[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingSla, setEditingSla] = useState<SLA | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [slaToDelete, setSlaToDelete] = useState<SLA | null>(null);

  const { currentUser } = useAuth();
  const { toast } = useToast();

  const parseTimestampField = (fieldValue: any): string => {
    if (!fieldValue) return new Date(0).toISOString(); // Fallback for safety, though createdAt should always exist
    if (fieldValue instanceof Timestamp) {
        return fieldValue.toDate().toISOString();
    }
    if (typeof fieldValue === 'string') {
        const parsedDate = parseISO(fieldValue);
        if (isValid(parsedDate)) {
            return parsedDate.toISOString();
        }
    }
    console.warn("Formato de fecha inesperado en SLA:", fieldValue);
    return new Date(0).toISOString();
  };


  const fetchSlas = useCallback(async () => {
    if (!currentUser) {
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    try {
      const q = query(collection(db, "slas"), orderBy("name", "asc"));
      const querySnapshot = await getDocs(q);
      const fetchedSlas = querySnapshot.docs.map(docSnap => {
        const data = docSnap.data();
        return {
          id: docSnap.id,
          ...data,
          createdAt: parseTimestampField(data.createdAt),
          updatedAt: data.updatedAt ? parseTimestampField(data.updatedAt) : undefined,
        } as SLA;
      });
      setSlas(fetchedSlas);
    } catch (error) {
      console.error("Error fetching SLAs:", error);
      toast({ title: "Error al Cargar SLAs", description: String(error), variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  }, [currentUser, toast]);

  useEffect(() => {
    fetchSlas();
  }, [fetchSlas]);

  const handleSaveSla = async (slaData: Omit<SLA, 'id' | 'createdAt' | 'updatedAt'>, id?: string) => {
    if (!currentUser) {
      toast({ title: "Error de autenticación", variant: "destructive" });
      return false;
    }
    setIsLoading(true); // Indicate saving process
    try {
      const docId = id || doc(collection(db, "slas")).id;
      const dataToSave: any = {
        ...slaData,
        updatedAt: serverTimestamp(),
      };
      if (!id) { // If it's a new SLA
        dataToSave.createdAt = serverTimestamp();
      }
      
      await setDoc(doc(db, "slas", docId), dataToSave, { merge: true });
      toast({ title: id ? "SLA Actualizado" : "SLA Creado", description: `El SLA "${slaData.name}" ha sido guardado.` });
      fetchSlas(); // Refresh list
      setIsLoading(false);
      return true;
    } catch (error) {
      console.error("Error saving SLA:", error);
      toast({ title: "Error al Guardar SLA", variant: "destructive" });
      setIsLoading(false);
      return false;
    }
  };
  
  const confirmDeleteSla = (sla: SLA) => {
    setSlaToDelete(sla);
  };

  const handleDeleteSla = async () => {
    if (!slaToDelete || !currentUser) return;
    setIsLoading(true);
    try {
      await deleteDoc(doc(db, "slas", slaToDelete.id)); 
      toast({ title: "SLA Eliminado", description: `El SLA "${slaToDelete.name}" ha sido eliminado.` });
      fetchSlas(); // Refresh list
    } catch (error) {
      console.error("Error deleting SLA:", error);
      toast({ title: "Error al Eliminar SLA", variant: "destructive" });
    } finally {
      setSlaToDelete(null);
      setIsLoading(false);
    }
  };

  const filteredSlas = slas.filter(sla =>
    sla.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (sla.description && sla.description.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  if (currentUser?.role !== 'admin' && currentUser?.role !== 'supervisor') {
    return (
        <Card className="m-auto mt-10 max-w-md">
            <CardHeader>
                <CardTitle className="flex items-center gap-2"><ShieldCheck className="h-6 w-6 text-destructive"/>Acceso Denegado</CardTitle>
                <CardDescription>No tienes permisos para gestionar SLAs.</CardDescription>
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
                Gestión de Acuerdos de Nivel de Servicio (SLAs)
                </CardTitle>
                <CardDescription>
                Define y administra los SLAs para la resolución de tickets de soporte.
                </CardDescription>
            </div>
            <Button onClick={() => { setEditingSla(null); setIsDialogOpen(true); }} disabled={isLoading}>
              <PlusCircle className="mr-2 h-4 w-4" /> Nuevo SLA
            </Button>
          </div>
           <div className="flex gap-2 mt-4">
            <div className="relative flex-grow">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input 
                    type="search" 
                    placeholder="Buscar SLAs por nombre o descripción..." 
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
          {isLoading && slas.length === 0 ? ( // Show skeleton only on initial load
            <div className="space-y-4">
              {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-24 w-full" />)}
            </div>
          ) : filteredSlas.length > 0 ? (
            <div className="space-y-4">
              {filteredSlas.map(sla => (
                <SlaListItem 
                  key={sla.id} 
                  sla={sla}
                  onEdit={() => { setEditingSla(sla); setIsDialogOpen(true); }}
                  onDelete={() => confirmDeleteSla(sla)}
                />
              ))}
            </div>
          ) : (
            <p className="text-center text-muted-foreground py-8">
              {searchTerm ? "No se encontraron SLAs con ese criterio." : "No hay SLAs definidos. Empieza creando uno."}
            </p>
          )}
        </CardContent>
      </Card>

      <AddEditSlaDialog
        isOpen={isDialogOpen}
        onOpenChange={setIsDialogOpen}
        slaToEdit={editingSla}
        onSave={handleSaveSla}
        ticketPriorities={TICKET_PRIORITIES}
      />

      {slaToDelete && (
        <AlertDialog open={!!slaToDelete} onOpenChange={() => setSlaToDelete(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>¿Estás seguro?</AlertDialogTitle>
              <AlertDialogDescription>
                Esta acción no se puede deshacer. El SLA &quot;{slaToDelete.name}&quot; será eliminado permanentemente.
                Los tickets existentes asociados a este SLA no se verán afectados directamente, pero no se aplicará más.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel onClick={() => setSlaToDelete(null)}>Cancelar</AlertDialogCancel>
              <AlertDialogAction onClick={handleDeleteSla} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                Sí, eliminar SLA
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}
    </div>
  );
}
