
"use client";

import { useState, useEffect, useCallback } from "react";
import type { Meeting, Lead, User, Contact, Resource } from "@/lib/types";
import { NAV_ITEMS, INITIAL_RESOURCES } from "@/lib/constants";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { CalendarDays, PlusCircle, List, AlertTriangle } from "lucide-react";
import { AddEditMeetingDialog } from "@/components/calendar/add-edit-meeting-dialog";
import { CalendarView } from "@/components/calendar/calendar-view";
import { MeetingListItem } from "@/components/calendar/meeting-list-item"; 
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/auth-context";
import { db } from "@/lib/firebase";
import { collection, query, where, orderBy, getDocs, doc, setDoc, deleteDoc, Timestamp, onSnapshot } from "firebase/firestore";
import { Skeleton } from "@/components/ui/skeleton";
import { useRouter } from 'next/navigation';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import { getAllUsers } from "@/lib/userUtils"; // <-- AÑADIDO: Importar la nueva función

export default function CalendarPage() {
  const navItem = NAV_ITEMS.flatMap(item => item.subItems || item).find(item => item.href === '/calendar');
  const PageIcon = navItem?.icon || CalendarDays;

  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [resources, setResources] = useState<Resource[]>([]);

  const [isLoadingMeetings, setIsLoadingMeetings] = useState(true);
  const [isLoadingSupportData, setIsLoadingSupportData] = useState(true);
  const [isMeetingDialogOpen, setIsMeetingDialogOpen] = useState(false);
  const [editingMeeting, setEditingMeeting] = useState<Meeting | null>(null);

  const { toast } = useToast();
  // CAMBIO: getAllUsers eliminado de useAuth()
  const { currentUser, loading: authLoading, hasPermission } = useAuth(); 
  const router = useRouter();

  useEffect(() => {
    let unsubscribe: (() => void) | undefined;
    if (!authLoading) {
      if (!currentUser || !hasPermission('ver-calendario')) {
        router.push('/access-denied');
      } else {
        setIsLoadingMeetings(true); // Mover isLoading a true antes de la suscripción
        const q = query(collection(db, "meetings"), orderBy("createdAt", "desc"));
        unsubscribe = onSnapshot(q, (querySnapshot) => {
            const fetchedMeetings = querySnapshot.docs.map(docSnap => {
                const data = docSnap.data();
                return {
                id: docSnap.id,
                ...data,
                startTime: (data.startTime as Timestamp)?.toDate().toISOString() || new Date().toISOString(),
                endTime: (data.endTime as Timestamp)?.toDate().toISOString() || new Date().toISOString(),
                createdAt: (data.createdAt as Timestamp)?.toDate().toISOString() || new Date().toISOString(),
                updatedAt: (data.updatedAt as Timestamp)?.toDate().toISOString() || undefined,
                } as Meeting;
            });
            setMeetings(fetchedMeetings);
            setIsLoadingMeetings(false);
        }, (error) => {
            console.error("Error al obtener reuniones en tiempo real:", error);
            toast({ title: "Error al Cargar Reuniones", variant: "destructive" });
            setIsLoadingMeetings(false);
        });
      }
    } else {
        setIsLoadingMeetings(true);
    }
    return () => { unsubscribe?.(); };
  }, [currentUser, authLoading, hasPermission, router, toast]);

  const fetchSupportData = useCallback(async () => {
    setIsLoadingSupportData(true);
    try {
      // CAMBIO: Llamar a getAllUsers importada
      const [leadsSnapshot, contactsSnapshot, allUsersData, resourcesData] = await Promise.all([
        getDocs(collection(db, "leads")),
        getDocs(collection(db, "contacts")),
        getAllUsers(), 
        Promise.resolve(INITIAL_RESOURCES) 
      ]);

      setLeads(leadsSnapshot.docs.map(docSnap => ({ id: docSnap.id, ...docSnap.data() } as Lead)));
      setContacts(contactsSnapshot.docs.map(docSnap => ({id: docSnap.id, ...docSnap.data()} as Contact)));
      setUsers(allUsersData); // CAMBIO: Usar el resultado de getAllUsers()
      setResources(resourcesData as Resource[]); 
      
    } catch (error) {
      console.error("Error al obtener datos de soporte (leads, contactos, usuarios, recursos):", error);
      toast({ title: "Error al Cargar Datos de Soporte", variant: "destructive"});
    } finally {
      setIsLoadingSupportData(false);
    }
  // CAMBIO: getAllUsers eliminado de dependencias
  }, [toast]);

  useEffect(() => {
    // Solo llamar a fetchSupportData si no estamos cargando la autenticación
    // y el usuario está presente (implica que tiene permiso por el primer useEffect)
    if(!authLoading && currentUser) {
        fetchSupportData();
    }
  }, [authLoading, currentUser, fetchSupportData]); // fetchSupportData es ahora estable

  const handleSendGridEvents = async (meetingDataFromDialog: Omit<Meeting, 'id' | 'createdAt' | 'createdByUserId'>, existingMeetingId?: string) => {
    if (!currentUser) {
      toast({ title: "Error", description: "Debe iniciar sesión para guardar reuniones.", variant: "destructive" });
      return false;
    }
    
    const isProcessing = isLoadingMeetings; 
    if (isProcessing) return false; 

    const meetingIdToUse = existingMeetingId || doc(collection(db, "meetings")).id;

    try {
      const startDateTime = parseISO(meetingDataFromDialog.startTime);
      const endDateTime = parseISO(meetingDataFromDialog.endTime);

      const dataForFirestore: { [key: string]: any } = {
        title: meetingDataFromDialog.title,
        description: meetingDataFromDialog.description !== undefined ? meetingDataFromDialog.description : null,
        startTime: Timestamp.fromDate(startDateTime),
        endTime: Timestamp.fromDate(endDateTime),
        attendees: meetingDataFromDialog.attendees,
        location: meetingDataFromDialog.location !== undefined ? meetingDataFromDialog.location : null,
        conferenceLink: meetingDataFromDialog.conferenceLink !== undefined ? meetingDataFromDialog.conferenceLink : null,
        relatedLeadId: meetingDataFromDialog.relatedLeadId || null,
        status: meetingDataFromDialog.status,
        resourceId: meetingDataFromDialog.resourceId || null,
        updatedAt: Timestamp.now(),
      };

      if (!existingMeetingId) {
        dataForFirestore.createdByUserId = currentUser.id;
        dataForFirestore.createdAt = Timestamp.now();
      }
      
      await setDoc(doc(db, "meetings", meetingIdToUse), dataForFirestore, { merge: true });

      toast({ title: existingMeetingId ? "Reunión Actualizada" : "Reunión Creada", description: `La reunión "${meetingDataFromDialog.title}" ha sido guardada.` });
      setIsMeetingDialogOpen(false);
      
      const oldMeeting = existingMeetingId ? meetings.find(m => m.id === existingMeetingId) : null;
      const attendeesChanged = JSON.stringify(oldMeeting?.attendees?.map(a => ({email:a.email, status:a.status})).sort()) !== JSON.stringify(meetingDataFromDialog.attendees.map(a => ({email:a.email, status:a.status})).sort());
      const timeChanged = oldMeeting ? (oldMeeting.startTime !== startDateTime.toISOString() || oldMeeting.endTime !== endDateTime.toISOString()) : false;
      const statusChanged = oldMeeting ? oldMeeting.status !== meetingDataFromDialog.status : false;


      if (!existingMeetingId || attendeesChanged || timeChanged || (statusChanged && (meetingDataFromDialog.status === 'Confirmada' || meetingDataFromDialog.status === 'Cancelada'))) {
        toast({ 
          title: "Procesando Invitaciones/Actualizaciones...", 
          description: "Las invitaciones o actualizaciones se enviarán a los asistentes en segundo plano por la Cloud Function.", 
          variant: "default", 
          duration: 7000 
        });
      }
      return true;
    } catch (error) {
      console.error("Error guardando reunión:", error);
      toast({ title: "Error al Guardar Reunión", variant: "destructive", description: String(error) });
      return false;
    }
  };

  const handleDeleteMeeting = async (meetingId: string) => {
    if (!window.confirm("¿Estás seguro de que quieres eliminar esta reunión?")) return;
    try {
      await deleteDoc(doc(db, "meetings", meetingId));
      toast({ title: "Reunión Eliminada", description: "La reunión ha sido eliminada." });
    } catch (error) {
      console.error("Error eliminando reunión:", error);
      toast({ title: "Error al Eliminar Reunión", variant: "destructive" });
    }
  };
  
  const openNewMeetingDialog = () => {
    setEditingMeeting(null);
    setIsMeetingDialogOpen(true);
  };

  const openEditMeetingDialog = (meeting: Meeting) => {
    setEditingMeeting(meeting);
    setIsMeetingDialogOpen(true);
  };

  const isLoadingPage = authLoading || isLoadingMeetings || isLoadingSupportData; // CAMBIO: Usar authLoading

  if (authLoading) { // Mostrar loader principal si auth está cargando
    return (
      <div className="flex flex-col gap-6 p-6 w-full">
        <Skeleton className="h-12 w-1/4" />
        <Skeleton className="h-80 w-full" />
      </div>
    );
  }
  // Si llegamos aquí, authLoading es false.
  // El primer useEffect ya manejó la redirección si no hay currentUser o no hay permiso.
  // Si no hay currentUser en este punto (y authLoading es false), es un estado anómalo o ya redirigido.
  if (!currentUser) {
      return <div className="flex justify-center items-center h-screen w-full"><p>Verificando sesión...</p></div>;
  }

  return (
    // CAMBIO: Añadido w-full
    <div className="flex flex-col gap-6 w-full">
      <Card className="shadow-lg w-full"> {/* Asegurar que Card también pueda expandirse */} 
        <CardHeader>
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
            <div>
              <CardTitle className="flex items-center gap-2 text-2xl">
                <PageIcon className="h-6 w-6 text-primary" />
                {navItem?.label || "Calendario y Reuniones"}
              </CardTitle>
              <CardDescription>
                Gestiona tu agenda, programa reuniones, envía invitaciones y recibe recordatorios.
              </CardDescription>
            </div>
            {/* Verificar permiso para crear reunión */} 
            {hasPermission('crear-reunion') && (
              <Button onClick={openNewMeetingDialog} disabled={isLoadingPage}> 
                <PlusCircle className="mr-2 h-4 w-4" /> Nueva Reunión
              </Button>
            )}
          </div>
        </CardHeader>
      </Card>

      <Tabs defaultValue="calendar" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="calendar"><CalendarDays className="mr-2 h-4 w-4" />Vista de Calendario</TabsTrigger>
          <TabsTrigger value="list"><List className="mr-2 h-4 w-4" />Lista de Reuniones</TabsTrigger>
        </TabsList>
        <TabsContent value="calendar">
           {isLoadingPage ? ( // CAMBIO: Usar isLoadingPage
             <div className="space-y-4 mt-4">
                <Skeleton className="h-80 w-full rounded-md" />
            </div>
          ) : (
          <CalendarView 
            meetings={meetings} 
            onEditMeeting={openEditMeetingDialog}
            leads={leads}
            users={users}
            resources={resources}
            />
          )}
        </TabsContent>
        <TabsContent value="list">
          {isLoadingMeetings ? (
             <div className="space-y-4 mt-4">
                <Skeleton className="h-20 w-full rounded-md" />
                <Skeleton className="h-20 w-full rounded-md" />
                <Skeleton className="h-20 w-full rounded-md" />
            </div>
          ) : meetings.length > 0 ? (
            <div className="space-y-4 mt-4">
              {meetings.map(meeting => (
                <MeetingListItem 
                  key={meeting.id}
                  meeting={meeting}
                  leads={leads}
                  users={users}
                  resources={resources}
                  onEdit={openEditMeetingDialog}
                  onDelete={handleDeleteMeeting}
                  // Asumiendo que MeetingListItem puede necesitar estos permisos
                  canEdit={hasPermission('editar-reunion')}
                  canDelete={hasPermission('eliminar-reunion')}
                />
              ))}
            </div>
          ) : (
            <Card className="mt-4 w-full"> {/* Asegurar que Card también pueda expandirse */} 
              <CardContent className="pt-6 text-center text-muted-foreground">
                No hay reuniones programadas.
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>
      
       <Card className="mt-4 bg-amber-50 border-amber-200 w-full"> {/* Asegurar que Card también pueda expandirse */} 
        <CardHeader>
          <CardTitle className="flex items-center text-amber-700 text-lg gap-2">
            <AlertTriangle className="h-5 w-5" />
            Estado de Desarrollo de Funcionalidades
          </CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-amber-600">
          <ul className="list-disc list-inside space-y-2">
            <li>
              <strong>Envío de invitaciones (.ics) y recordatorios por correo electrónico:</strong> 
              <Badge variant="default" className="ml-2 bg-yellow-500 hover:bg-yellow-600 text-black">Backend Pendiente</Badge>
              <p className="text-xs pl-5">La funcionalidad para preparar y enviar invitaciones está lista en el frontend. La Cloud Function `sendMeetingInvitation` está definida pero necesita pruebas exhaustivas y ajustes para asegurar la correcta generación de .ics y el envío de correos a todos los asistentes.</p>
            </li>
            <li>
              <strong>Vistas de calendario por semana y día completamente interactivas:</strong>
              <Badge variant="default" className="ml-2 bg-orange-500 hover:bg-orange-600 text-black">En Desarrollo</Badge>
              <p className="text-xs pl-5">La vista de calendario mensual actual resalta los días con eventos. Vistas más detalladas (semana/día) e interactivas se implementarán progresivamente. Esto requiere una librería de calendario más robusta.</p>
            </li>
             <li>
              <strong>Asignación de salas o recursos para reuniones:</strong>
              <Badge variant="default" className="ml-2 bg-green-500 hover:bg-green-600 text-white">Parcialmente Implementado</Badge>
              <p className="text-xs pl-5">Se permite seleccionar un recurso de una lista predefinida. La gestión de la disponibilidad de recursos en tiempo real y la prevención de conflictos está en desarrollo.</p>
            </li>
            <li>
              <strong>Sincronización con calendarios externos (Google Calendar, Outlook):</strong>
              <Badge variant="outline" className="ml-2 border-gray-500 text-gray-600">Planeado (Avanzado)</Badge>
              <p className="text-xs pl-5">Esta funcionalidad es compleja y se considera para futuras versiones mayores.</p>
            </li>
          </ul>
          <p className="mt-4 font-semibold">Las funcionalidades se implementarán progresivamente.</p>
        </CardContent>
      </Card>

      <AddEditMeetingDialog
        isOpen={isMeetingDialogOpen}
        onOpenChange={setIsMeetingDialogOpen}
        meetingToEdit={editingMeeting}
        onSave={handleSendGridEvents}
        leads={leads}
        contacts={contacts}
        users={users}
        resources={resources}
        currentUser={currentUser}
      />
    </div>
  );
}

