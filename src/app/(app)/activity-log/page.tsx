
"use client";

import { useState, useEffect, useCallback } from "react";
import type { ActivityLog, Lead, Contact, Ticket, User, Opportunity } from "@/lib/types";
import { NAV_ITEMS, ACTIVITY_LOG_USER_ACTIVITY_TYPES } from "@/lib/constants";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { FileClock, PlusCircle, Search, Filter, PhoneCall, Mic, Ear } from "lucide-react";
import { useAuth } from "@/contexts/auth-context";
import { useToast } from "@/hooks/use-toast";
import { Skeleton } from "@/components/ui/skeleton";
import { db } from "@/lib/firebase";
import { useRouter } from 'next/navigation';
import { collection, addDoc, getDocs, query, orderBy, Timestamp, serverTimestamp } from "firebase/firestore";
import { AddEditActivityLogDialog } from "@/components/activity-log/add-edit-activity-log-dialog";
import { ActivityLogListItem } from "@/components/activity-log/activity-log-list-item";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { isValid, parseISO } from "date-fns";
import { getAllUsers } from "@/lib/userUtils"; // <-- AÑADIDO: Importar la nueva función


export default function ActivityLogPage() {
  const navItem = NAV_ITEMS.flatMap(item => item.subItems || item).find(item => item.href === '/activity-log');
  const PageIcon = navItem?.icon || FileClock;

  const [activities, setActivities] = useState<ActivityLog[]>([]);
  const [isLoading, setIsLoading] = useState(true); 
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingActivity, setEditingActivity] = useState<ActivityLog | null>(null); 

  const [leads, setLeads] = useState<Lead[]>([]);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [opportunities, setOpportunities] = useState<Opportunity[]>([]); 
  const [users, setUsers] = useState<User[]>([]);

  const { currentUser, loading: authLoading, hasPermission } = useAuth(); // CAMBIO: getAllUsers eliminado
  const { toast } = useToast();
  const [searchTerm, setSearchTerm] = useState("");

  const parseTimestampField = (fieldValue: any): string => {
    if (fieldValue && typeof fieldValue.toDate === 'function') { 
      return (fieldValue as Timestamp).toDate().toISOString();
    }
    if (typeof fieldValue === 'string' && isValid(parseISO(fieldValue))) { 
      return fieldValue;
    }
    if (fieldValue && typeof fieldValue === 'object' && fieldValue.hasOwnProperty('_methodName') && fieldValue._methodName === 'serverTimestamp') {
        return new Date().toISOString(); 
    }
    return new Date().toISOString(); 
  };

  const router = useRouter();

  useEffect(() => {
    if (!authLoading) {
      if (!currentUser || !hasPermission('ver-registro-actividad')) {
        router.push('/access-denied');
      }
    }
  }, [currentUser, authLoading, hasPermission, router]);

  const fetchActivitiesAndSupportData = useCallback(async () => {
    if (!currentUser) {
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    try {
      const activityQuery = query(collection(db, "activityLogs"), orderBy("timestamp", "desc"));
      // CAMBIO: Llamar a getAllUsers importada
      const [activitySnapshot, leadsSnapshot, contactsSnapshot, ticketsSnapshot, allUsersData] = await Promise.all([
        getDocs(activityQuery),
        getDocs(collection(db, "leads")),
        getDocs(collection(db, "contacts")),
        getDocs(collection(db, "tickets")),
        getAllUsers(), 
      ]);

      const fetchedActivities = activitySnapshot.docs.map(docSnap => {
        const data = docSnap.data();
        return {
          id: docSnap.id,
          ...data,
          timestamp: parseTimestampField(data.timestamp),
          createdAt: parseTimestampField(data.createdAt),
        } as ActivityLog;
      });
      setActivities(fetchedActivities);

      setLeads(leadsSnapshot.docs.map(docSnap => ({ id: docSnap.id, ...docSnap.data() } as Lead)));
      setContacts(contactsSnapshot.docs.map(docSnap => ({id: docSnap.id, ...docSnap.data()} as Contact)));
      setTickets(ticketsSnapshot.docs.map(docSnap => ({id: docSnap.id, ...docSnap.data()} as Ticket)));
      setUsers(allUsersData); // CAMBIO: Usar el resultado de getAllUsers()

    } catch (error) {
      console.error("Error fetching activities or support data:", error);
      toast({ title: "Error al Cargar Datos", description: "No se pudieron cargar todos los datos necesarios para esta página.", variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  // CAMBIO: getAllUsers eliminado de dependencias, currentUser y toast son suficientes si getAllUsers es pura.
  }, [currentUser, toast]); 

  useEffect(() => {
    if (!authLoading && currentUser && hasPermission('ver-registro-actividad')){
      fetchActivitiesAndSupportData();
    } else if (!authLoading && !currentUser){
      setActivities([]);
      setLeads([]);
      setContacts([]);
      setTickets([]);
      setUsers([]);
      setIsLoading(false);
    }
  // CAMBIO: fetchActivitiesAndSupportData es ahora estable en sus dependencias
  }, [authLoading, currentUser, hasPermission, fetchActivitiesAndSupportData]);

  const handleSaveActivity = async (activityData: Omit<ActivityLog, 'id' | 'createdAt' | 'loggedByUserId'>) => {
    if (!currentUser) {
      toast({ title: "Error de autenticación", variant: "destructive" });
      return false;
    }
    try {
      await addDoc(collection(db, "activityLogs"), {
        ...activityData,
        timestamp: Timestamp.fromDate(new Date(activityData.timestamp)),
        loggedByUserId: currentUser.id,
        loggedByUserName: currentUser.name,
        createdAt: serverTimestamp(),
      });
      toast({ title: "Actividad Registrada", description: "La nueva actividad ha sido guardada." });
      fetchActivitiesAndSupportData();
      return true;
    } catch (error) {
      console.error("Error saving activity:", error);
      toast({ title: "Error al Guardar Actividad", variant: "destructive" });
      return false;
    }
  };

  if (authLoading) {
      return <div className="flex justify-center items-center h-screen w-full"><Skeleton className="h-12 w-12 rounded-full" /><div className="space-y-2 ml-4"><Skeleton className="h-4 w-[250px]" /><Skeleton className="h-4 w-[200px]" /></div></div>;
  }

  if (!currentUser || !hasPermission('ver-registro-actividad')) {
    return <div className="flex justify-center items-center h-screen w-full"><p>Verificando permisos...</p></div>;
  }

  const filteredActivities = activities.filter(activity =>
    activity.subject?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    activity.details.toLowerCase().includes(searchTerm.toLowerCase()) ||
    users.find(u => u.id === activity.loggedByUserId)?.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    leads.find(l => l.id === activity.relatedLeadId)?.name?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="flex flex-col gap-6 w-full"> {/* CAMBIO: Añadido w-full */} 
      <Card className="shadow-lg w-full">
        <CardHeader>
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
            <div>
                <CardTitle className="flex items-center gap-2 text-2xl">
                <PageIcon className="h-6 w-6 text-primary" />
                {navItem?.label || "Registro de Actividades"}
                </CardTitle>
                <CardDescription>
                Mantén un historial de todas las interacciones con tus clientes: llamadas, reuniones, correos y notas.
                </CardDescription>
            </div>
            {hasPermission('crear-actividad') && (
              <Button onClick={() => { setEditingActivity(null); setIsDialogOpen(true); }} disabled={isLoading}>
                <PlusCircle className="mr-2 h-4 w-4" /> Nueva Actividad
              </Button>
            )}
          </div>
           <div className="flex gap-2 mt-4">
            <div className="relative flex-grow">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input 
                    type="search" 
                    placeholder="Buscar por asunto, detalle, usuario o lead..." 
                    className="pl-8 w-full"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    disabled={isLoading} 
                />
            </div>
        </div>
        </CardHeader>
        <CardContent>
          {isLoading && activities.length === 0 ? (
            <div className="space-y-4">
              {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-20 w-full" />)}
            </div>
          ) : filteredActivities.length > 0 ? (
            <div className="space-y-4">
              {filteredActivities.map(activity => (
                <ActivityLogListItem 
                  key={activity.id} 
                  activity={activity} 
                  users={users}
                  leads={leads}
                  contacts={contacts}
                  tickets={tickets}
                  opportunities={opportunities}
                  canEdit={hasPermission('editar-actividad')}
                  canDelete={hasPermission('eliminar-actividad')}
                />
              ))}
            </div>
          ) : (
            <p className="text-center text-muted-foreground py-8">
              {searchTerm ? "No se encontraron actividades con ese criterio." : "No hay actividades registradas. Empieza añadiendo una."}
            </p>
          )}
        </CardContent>
      </Card>

      {currentUser && (
        <AddEditActivityLogDialog
          isOpen={isDialogOpen}
          onOpenChange={setIsDialogOpen}
          activityToEdit={editingActivity}
          onSave={handleSaveActivity}
          leads={leads}
          contacts={contacts}
          tickets={tickets}
          opportunities={opportunities} 
          currentUser={currentUser}
        />
      )}
    </div>
  );
}
