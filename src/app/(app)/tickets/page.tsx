
"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import type { Ticket, Lead, User, TicketStatus, TicketPriority, Comment, SLA, SupportQueue } from "@/lib/types";
import { NAV_ITEMS, TICKET_STATUSES, TICKET_PRIORITIES, INITIAL_SLAS, INITIAL_SUPPORT_QUEUES } from "@/lib/constants";
import { TicketItem } from "@/components/tickets/ticket-item";
import { AddEditTicketDialog } from "@/components/tickets/add-edit-ticket-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PlusCircle, Search, Filter, ShieldCheck, Clock, Zap as ZapIcon, AlertTriangle, ClipboardList, LayersIcon, ShieldAlertIcon, RotateCcw, HelpCircleIcon, SmilePlus } from "lucide-react";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/auth-context";
import { Skeleton } from "@/components/ui/skeleton";
import { db, storage } from "@/lib/firebase";
import { collection, getDocs, doc, setDoc, updateDoc, deleteDoc, query, orderBy, where, Timestamp, writeBatch, arrayUnion, onSnapshot } from "firebase/firestore";
import { ref as storageRef, deleteObject } from "firebase/storage";
import { format, parseISO, startOfMonth, isValid as isValidDate } from "date-fns";
import { es } from 'date-fns/locale';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useSearchParams, useRouter } from "next/navigation";
import { getAllUsers } from "@/lib/userUtils"; // <-- AÑADIDO: Importar la nueva función


// Helper function to safely parse date fields from Firestore
const parseFirestoreDate = (fieldValue: any): string | undefined => {
  if (!fieldValue) return undefined;
  if (fieldValue instanceof Timestamp) {
    return fieldValue.toDate().toISOString();
  }
  if (typeof fieldValue === 'string') {
    const parsed = parseISO(fieldValue);
    if (isValidDate(parsed)) {
      return parsed.toISOString();
    }
  }
  // Log unexpected format but don't crash
  console.warn("Unexpected date format received from Firestore:", fieldValue);
  return undefined;
};


export default function TicketsPage() {
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [slas, setSlas] = useState<SLA[]>([]); 
  const [supportQueues, setSupportQueues] = useState<SupportQueue[]>([]);


  const [isLoadingTickets, setIsLoadingTickets] = useState(true);
  const [isLoadingUsers, setIsLoadingUsers] = useState(true);
  const [isLoadingLeads, setIsLoadingLeads] = useState(true);
  const [isLoadingSlasAndQueues, setIsLoadingSlasAndQueues] = useState(true);
  const [isSubmittingTicket, setIsSubmittingTicket] = useState(false);

  const [editingTicket, setEditingTicket] = useState<Ticket | null>(null);
  const [isTicketDialogOpen, setIsTicketDialogOpen] = useState(false);
  const [ticketToDelete, setTicketToDelete] = useState<Ticket | null>(null);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);


  const [searchTerm, setSearchTerm] = useState("");
  const [filterStatus, setFilterStatus] = useState<"Todos" | TicketStatus>("Todos");
  const [filterPriority, setFilterPriority] = useState<"Todas" | TicketPriority>("Todas");
  const [filterAssignee, setFilterAssignee] = useState<"Todos" | string>("Todos");
  const [ticketToOpen, setTicketToOpen] = useState<string | null>(null); 

 const { toast } = useToast();
  // CAMBIO: getAllUsers eliminado de useAuth()
  const { currentUser, loading: authLoading, hasPermission, loading: permissionsLoading } = useAuth();
  const ticketsNavItem = NAV_ITEMS.flatMap(item => item.subItems || item).find(item => item.href === '/tickets');
  const PageIcon = ticketsNavItem?.icon || ClipboardList;
  const searchParams = useSearchParams();
  const router = useRouter();

  const fetchTickets = useCallback(async () => {
    if (!currentUser) {
      setIsLoadingTickets(false);
      return undefined;
    }
    setIsLoadingTickets(true);
    try {
      const ticketsCollectionRef = collection(db, "tickets");
      const q = query(ticketsCollectionRef, orderBy("createdAt", "desc"));

      const unsubscribe = onSnapshot(q, (querySnapshot) => {
        const fetchedTickets = querySnapshot.docs.map(docSnap => {
          const data = docSnap.data();
          return {
            id: docSnap.id,
            title: data.title,
            description: data.description,
            status: data.status,
            priority: data.priority,
            createdAt: parseFirestoreDate(data.createdAt) || new Date(0).toISOString(), 
            updatedAt: parseFirestoreDate(data.updatedAt),
            reporterUserId: data.reporterUserId,
            assigneeUserId: data.assigneeUserId || undefined,
            relatedLeadId: data.relatedLeadId || undefined,
            attachments: data.attachments || [],
            comments: data.comments || [], 
            solutionDescription: data.solutionDescription || undefined,
            solutionAttachments: data.solutionAttachments || [],
            slaId: data.slaId || undefined,
            queueId: data.queueId || undefined,
            resolvedAt: parseFirestoreDate(data.resolvedAt),
            closedAt: parseFirestoreDate(data.closedAt),
            firstResponseAt: parseFirestoreDate(data.firstResponseAt),
            satisfactionSurveySentAt: parseFirestoreDate(data.satisfactionSurveySentAt),
            satisfactionRating: data.satisfactionRating || undefined,
            satisfactionComment: data.satisfactionComment || undefined,
            appliedEscalationRuleIds: data.appliedEscalationRuleIds || [],
          } as Ticket;
        });
        setTickets(fetchedTickets);
        setIsLoadingTickets(false);

      }, (error) => {
        console.error("Error al obtener tickets en tiempo real:", error);
        toast({
          title: "Error al Cargar Tickets",
          description: "No se pudieron cargar los tickets desde la base de datos.",
          variant: "destructive",
        });
        setIsLoadingTickets(false);
      });

      return unsubscribe;

    } catch (error) {
      console.error("Error al configurar la escucha de tickets:", error);
      toast({
        title: "Error al Configurar Tickets",
        description: "No se pudo iniciar la carga de tickets.",
        variant: "destructive",
      });
      setIsLoadingTickets(false);
      return undefined;
    }
  }, [currentUser, toast]);

  const fetchUsers = useCallback(async () => {
    setIsLoadingUsers(true);
    try {
      const fetchedUsers = await getAllUsers(); // CAMBIO: Usa la función importada
      setUsers(fetchedUsers);
    } catch (error) {
      console.error("Error al obtener usuarios para la página de tickets:", error);
      toast({
        title: "Error al Cargar Usuarios",
        description: "No se pudieron cargar los datos de los usuarios para la asignación de tickets.",
        variant: "destructive",
      });
    } finally {
      setIsLoadingUsers(false);
    }
  }, [toast]); // CAMBIO: getAllUsers eliminado de dependencias

  const fetchLeads = useCallback(async () => {
    setIsLoadingLeads(true);
    try {
      const leadsCollectionRef = collection(db, "leads");
      const querySnapshot = await getDocs(leadsCollectionRef);
      const fetchedLeads = querySnapshot.docs.map(docSnap => ({
        id: docSnap.id,
        ...docSnap.data()
      } as Lead));
      setLeads(fetchedLeads);
    } catch (error) {
      console.error("Error al obtener leads:", error);
      toast({
        title: "Error al Cargar Leads",
        description: "No se pudieron cargar los datos de los leads.",
        variant: "destructive",
      });
    } finally {
      setIsLoadingLeads(false);
    }
  }, [toast]);

  const fetchSlasAndQueues = useCallback(async () => {
    setIsLoadingSlasAndQueues(true);
    try {
      const slasSnapshot = await getDocs(query(collection(db, "slas"), orderBy("name")));
      setSlas(slasSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as SLA)));
      const queuesSnapshot = await getDocs(query(collection(db, "supportQueues"), orderBy("name")));
      setSupportQueues(queuesSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as SupportQueue)));
    } catch (error) {
        console.error("Error fetching SLAs or Queues:", error);
        toast({ title: "Error al cargar SLAs/Colas", variant: "destructive" });
    } finally {
        setIsLoadingSlasAndQueues(false);
    }
  }, [toast]);

  useEffect(() => {
    if (!authLoading && !permissionsLoading) {
      if (!currentUser || !hasPermission('ver-tickets')) {
        router.push('/access-denied'); 
      }
    }
  }, [currentUser, authLoading, permissionsLoading, hasPermission, router]);

  useEffect(() => {
    let unsubscribeTickets: (() => void) | undefined;
    if (!authLoading) {
        fetchUsers();
        fetchLeads();
        fetchSlasAndQueues();
        if (currentUser) {
          fetchTickets().then(unsub => {
            if (typeof unsub === 'function') { 
                unsubscribeTickets = unsub;
            }
          });
        } else {
          setTickets([]);
          setIsLoadingTickets(false);
        }
    }
    return () => {
      if (unsubscribeTickets) {
        unsubscribeTickets();
      }
    };
  // CAMBIO: fetchUsers ya no cambia su referencia si getAllUsers es importado directamente
  }, [authLoading, currentUser, fetchLeads, fetchTickets, fetchSlasAndQueues, fetchUsers]);

  useEffect(() => {
    const ticketIdFromQuery = searchParams.get('ticketId');
    if (ticketIdFromQuery && tickets.length > 0) { 
        const ticketToAutoOpen = tickets.find(t => t.id === ticketIdFromQuery);
        if (ticketToAutoOpen) {
            setTicketToOpen(ticketIdFromQuery);
        } else {
            setTicketToOpen(null); 
        }
    } else if (!ticketIdFromQuery) {
        setTicketToOpen(null); 
    }
  }, [searchParams, tickets, router]);

  const handleSaveTicket = async (ticketData: Ticket) => {
    if (!currentUser) {
      toast({ title: "Error", description: "Usuario no autenticado.", variant: "destructive" });
      return;
    }
    setIsSubmittingTicket(true);
    const isEditing = tickets.some(t => t.id === ticketData.id);
    const ticketToSave: Partial<Ticket> = {
      ...ticketData,
      solutionDescription: ticketData.solutionDescription || "",
      solutionAttachments: ticketData.solutionAttachments || [],
      updatedAt: new Date().toISOString(),
    };
    if (ticketData.status === 'Resuelto' && (!ticketData.resolvedAt || !isEditing)) {
        ticketToSave.resolvedAt = new Date().toISOString();
    }
    if (ticketData.status === 'Cerrado' && (!ticketData.closedAt || !isEditing)) {
        ticketToSave.closedAt = new Date().toISOString();
        if (!ticketData.resolvedAt && ticketData.status !== 'Resuelto') { 
            ticketToSave.resolvedAt = new Date().toISOString();
        }
    }
    try {
      const ticketDocRef = doc(db, "tickets", ticketToSave.id!);
      const firestoreData:any = {};
      for (const key in ticketToSave) {
        if (ticketToSave[key as keyof Ticket] !== undefined) {
          const typedKey = key as keyof Ticket;
          if (['createdAt', 'updatedAt', 'resolvedAt', 'closedAt', 'firstResponseAt', 'satisfactionSurveySentAt'].includes(key)) {
             const dateValue = ticketToSave[typedKey];
             if (dateValue && typeof dateValue === 'string') {
                 firestoreData[key] = Timestamp.fromDate(new Date(dateValue));
             } else if (dateValue instanceof Timestamp) {
                 firestoreData[key] = dateValue;
             } else {
                 firestoreData[key] = null;
             }
          } else {
            firestoreData[key] = ticketToSave[typedKey];
          }
        }
      }
      firestoreData.assigneeUserId = firestoreData.assigneeUserId || null;
      firestoreData.relatedLeadId = firestoreData.relatedLeadId || null;
      firestoreData.slaId = firestoreData.slaId || null;
      firestoreData.queueId = firestoreData.queueId || null;
      firestoreData.solutionDescription = firestoreData.solutionDescription || "";
      firestoreData.solutionAttachments = firestoreData.solutionAttachments || [];
      firestoreData.comments = firestoreData.comments || [];
      firestoreData.appliedEscalationRuleIds = firestoreData.appliedEscalationRuleIds || [];
      await setDoc(ticketDocRef, firestoreData, { merge: true });
      toast({
        title: isEditing ? "Ticket Actualizado" : "Ticket Creado",
        description: `El ticket "${ticketToSave.title}" ha sido ${isEditing ? 'actualizado' : 'creado'} exitosamente.`,
      });
      setEditingTicket(null);
      setIsTicketDialogOpen(false);
    } catch (error) {
      console.error("Error al guardar ticket:", error);
      toast({
        title: "Error al Guardar Ticket",
        description: "Ocurrió un error al guardar el ticket.",
        variant: "destructive",
      });
    } finally {
      setIsSubmittingTicket(false);
    }
  };

  const confirmDeleteTicket = (ticket: Ticket) => {
    setTicketToDelete(ticket);
    setIsDeleteDialogOpen(true);
  };

  const handleDeleteTicket = async () => {
    if (!ticketToDelete) return;
    const ticketId = ticketToDelete.id;
    const ticketTitle = ticketToDelete.title;
    setIsDeleteDialogOpen(false);
    try {
      if (ticketToDelete.attachments && ticketToDelete.attachments.length > 0) {
        for (const attachment of ticketToDelete.attachments) {
          try {
            const fileRef = storageRef(storage, attachment.url); await deleteObject(fileRef);
          } catch (e) { console.warn("Falló al eliminar adjunto del ticket", attachment.url, e); }
        }
      }
      if (ticketToDelete.solutionAttachments && ticketToDelete.solutionAttachments.length > 0) {
        for (const attachment of ticketToDelete.solutionAttachments) {
           try {
            const fileRef = storageRef(storage, attachment.url); await deleteObject(fileRef);
          } catch (e) { console.warn("Falló al eliminar adjunto de la solución", attachment.url, e); }
        }
      }
      const commentsColRef = collection(db, "tickets", ticketId, "comments");
      const commentsSnapshot = await getDocs(commentsColRef);
      const batch = writeBatch(db);
      for (const commentDoc of commentsSnapshot.docs) {
          const commentData = commentDoc.data() as Comment;
          if (commentData.attachments) {
              for (const att of commentData.attachments) {
                  try {
                    const commentAttRef = storageRef(storage, att.url);
                    await deleteObject(commentAttRef);
                  } catch (e) {console.warn("Error al eliminar adjunto del comentario", att.url, e)}
              }
          }
          batch.delete(commentDoc.ref);
      }
      await batch.commit();
      const ticketDocRef = doc(db, "tickets", ticketId);
      await deleteDoc(ticketDocRef);
      toast({
        title: "Ticket Eliminado",
        description: `El ticket "${ticketTitle}" ha sido eliminado exitosamente.`,
        variant: "default",
      });
    } catch (error) {
      console.error("Error al eliminar ticket:", error);
      toast({
        title: "Error al Eliminar Ticket",
        description: "Ocurrió un error al eliminar el ticket.",
        variant: "destructive",
      });
    } finally {
        setTicketToDelete(null);
    }
  };

  const handleAddComment = async (ticketId: string, commentText: string, commentAttachments: {name: string, url: string}[]) => {
    if (!currentUser) {
      toast({title: "Error", description: "Debes iniciar sesión para comentar.", variant: "destructive"});
      return;
    }
    const ticket = tickets.find(t => t.id === ticketId);
    if (!ticket) return;
    const newComment: Omit<Comment, 'id'> & { createdAt: Timestamp } = {
      userId: currentUser.id,
      userName: currentUser.name || "Usuario Anónimo",
      userAvatarUrl: currentUser.avatarUrl || null,
      text: commentText,
      createdAt: Timestamp.now(),
      attachments: commentAttachments,
    };
    try {
      const commentDocRef = doc(collection(db, "tickets", ticketId, "comments"));
      await setDoc(commentDocRef, newComment);
      const ticketDocRef = doc(db, "tickets", ticketId);
      const updateData: Partial<Ticket> = { updatedAt: new Date().toISOString() };
      if (currentUser.id !== ticket.reporterUserId && !ticket.firstResponseAt) {
        updateData.firstResponseAt = new Date().toISOString();
      }
      if (ticket.status === 'Abierto' && currentUser.id === ticket.assigneeUserId) {
         updateData.status = 'En Progreso';
         updateData.updatedAt = new Date().toISOString();
      }
      await updateDoc(ticketDocRef, {
        updatedAt: Timestamp.now(),
        ...(updateData.firstResponseAt && { firstResponseAt: Timestamp.fromDate(new Date(updateData.firstResponseAt)) }),
        ...(updateData.status && { status: updateData.status })
      });
      toast({title: "Comentario Añadido", description: "Tu comentario ha sido añadido al ticket."});
    } catch (error) {
      console.error("Error al añadir comentario:", error);
      toast({title: "Error al Comentar", description: "No se pudo añadir tu comentario.", variant: "destructive"});
    }
  };

  const handleUpdateTicketSolution = async (
    ticketId: string,
    solutionDescriptionParam: string,
    solutionAttachmentsParam: { name: string; url: string }[],
    statusParam: TicketStatus
  ) => {
    if (!currentUser) {
        toast({ title: "Error", description: "Usuario no autenticado.", variant: "destructive" });
        return;
    }
    const ticketToUpdate = tickets.find(t => t.id === ticketId);
    if (!ticketToUpdate) {
       toast({title: "Error", description: "Ticket no encontrado.", variant: "destructive"});
       return;
    }
    if (currentUser.id !== ticketToUpdate.assigneeUserId && currentUser?.role !== 'admin' && currentUser?.role !== 'supervisor') {
        toast({title: "Acción no permitida", description: "Solo el usuario asignado o un administrador/supervisor puede registrar la solución.", variant: "destructive"});
        return;
    }
    const updatedTicketData: any = {
        solutionDescription: solutionDescriptionParam,
        solutionAttachments: solutionAttachmentsParam,
        status: statusParam,
        updatedAt: Timestamp.now(),
    };
    if (statusParam === 'Resuelto' && !parseFirestoreDate(ticketToUpdate.resolvedAt)) {
      updatedTicketData.resolvedAt = Timestamp.now();
    }
    if (statusParam === 'Cerrado' && !parseFirestoreDate(ticketToUpdate.closedAt)) {
      updatedTicketData.closedAt = Timestamp.now();
      if (!updatedTicketData.resolvedAt && ticketToUpdate.status !== 'Resuelto') { 
        updatedTicketData.resolvedAt = Timestamp.now();
      }
    }
    try {
        const ticketDocRef = doc(db, "tickets", ticketId);
        await updateDoc(ticketDocRef, updatedTicketData ); 
        toast({title: "Solución Actualizada", description: `La solución para el ticket "${ticketToUpdate.title}" ha sido guardada.`});
    } catch (error) {
        console.error("Error al actualizar la solución del ticket:", error);
        toast({title: "Error al Guardar Solución", description: "No se pudo guardar la solución del ticket.", variant: "destructive"});
    }
  };

  const openNewTicketDialog = () => {
    setEditingTicket(null);
    setIsTicketDialogOpen(true);
  };

  const openEditTicketDialog = (ticket: Ticket) => {
    setEditingTicket(ticket);
    setIsTicketDialogOpen(true);
  };

  const filteredTickets = useMemo(() => {
    if (!currentUser) return [];
    return tickets
      .filter(ticket => {
        if (currentUser.role === 'admin' || currentUser.role === 'supervisor') {
          return true;
        }
        return ticket.reporterUserId === currentUser.id || ticket.assigneeUserId === currentUser.id;
      })
      .filter(ticket => {
        if (filterStatus === "Todos") return true;
        return ticket.status === filterStatus;
      })
      .filter(ticket => {
        if (filterPriority === "Todas") return true;
        return ticket.priority === filterPriority;
      })
      .filter(ticket => {
        if (filterAssignee === "Todos") return true;
        if (filterAssignee === "unassigned") return !ticket.assigneeUserId;
        return ticket.assigneeUserId === filterAssignee;
      });
  }, [tickets, filterStatus, filterPriority, filterAssignee, currentUser]);

  const allTicketStatusesForTabs: ("Todos" | TicketStatus)[] = ["Todos", ...TICKET_STATUSES];

 const isLoading = authLoading || permissionsLoading || isLoadingUsers || isLoadingTickets || isLoadingLeads || isLoadingSlasAndQueues;

  return (
    // CAMBIO: Añadido w-full
    <div className="flex flex-col gap-6 w-full">
      <Card className="shadow-lg">
        <CardHeader>
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
            <div>
              <CardTitle className="flex items-center gap-2 text-2xl">
                <PageIcon className="h-6 w-6 text-primary" />
                {ticketsNavItem?.label || "Gestión de Tickets"}
              </CardTitle>
              <CardDescription>
                Gestiona solicitudes de soporte, asigna responsables y haz seguimiento hasta la resolución.
              </CardDescription>
            </div>
             <Button onClick={openNewTicketDialog} disabled={isLoadingUsers || isSubmittingTicket}>
                <PlusCircle className="mr-2 h-5 w-5" /> Abrir Nuevo Ticket
             </Button>
          </div>
           <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
            <div className="relative md:col-span-1">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                type="search"
                placeholder="Buscar por título, descripción o ID..."
                className="pl-8 w-full"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                disabled={isLoading}
              />
            </div>
            <Select value={filterPriority} onValueChange={(value: TicketPriority | "Todas") => setFilterPriority(value)} disabled={isLoading}>
              <SelectTrigger className="w-full">
                <Filter className="h-4 w-4 mr-2" />
                <SelectValue placeholder="Filtrar por prioridad" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Todas">Todas las Prioridades</SelectItem>
                {TICKET_PRIORITIES.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}
              </SelectContent>
            </Select>
            {(currentUser?.role === 'admin' || currentUser?.role === 'supervisor') && (
                <Select value={filterAssignee} onValueChange={(value: string | "Todos") => setFilterAssignee(value)} disabled={isLoadingUsers || isLoading}>
                <SelectTrigger className="w-full">
                    <Filter className="h-4 w-4 mr-2" />
                    <SelectValue placeholder="Filtrar por asignado" />
                </SelectTrigger>
                <SelectContent>
                    <SelectItem value="Todos">Todos los Asignados</SelectItem>
                    <SelectItem value="unassigned">Sin asignar</SelectItem>
                    {users.map(user => <SelectItem key={user.id} value={user.id}>{user.name}</SelectItem>)}
                </SelectContent>
                </Select>
            )}
          </div>
        </CardHeader>
        <CardContent>
          <Tabs value={filterStatus} onValueChange={(value) => setFilterStatus(value as "Todos" | TicketStatus)}>
            <TabsList className="grid w-full grid-cols-2 sm:grid-cols-3 md:grid-cols-5">
              {allTicketStatusesForTabs.map(status => (
                <TabsTrigger key={status} value={status} disabled={isLoading}>{status}</TabsTrigger>
              ))}
            </TabsList>
          </Tabs>

          {isLoading && tickets.length === 0 ? (
            <div className="space-y-4 mt-4">
              <Skeleton className="h-24 w-full" />
              <Skeleton className="h-24 w-full" />
              <Skeleton className="h-24 w-full" />
            </div>
          ) : filteredTickets.filter(ticket =>
                ticket.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                (ticket.description && ticket.description.toLowerCase().includes(searchTerm.toLowerCase())) ||
                ticket.id.toLowerCase().includes(searchTerm.toLowerCase())
            ).length > 0 ? (
            <div className="space-y-4 mt-4">
              {filteredTickets.filter(ticket =>
                ticket.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                (ticket.description && ticket.description.toLowerCase().includes(searchTerm.toLowerCase())) ||
                ticket.id.toLowerCase().includes(searchTerm.toLowerCase())
              ).map(ticket => (
                <TicketItem
                  key={ticket.id}
                  ticket={ticket}
                  leads={leads}
                  users={users}
                  currentUser={currentUser}
                  onEdit={openEditTicketDialog}
                  onDelete={() => confirmDeleteTicket(ticket)}
                  onAddComment={handleAddComment}
                  onUpdateTicketSolution={handleUpdateTicketSolution}
                  defaultOpen={ticket.id === ticketToOpen} 
                />
              ))}
            </div>
          ) : (
            <div className="text-center py-10 text-muted-foreground">
              <p className="text-lg">No se encontraron tickets.</p>
              <p>Intenta ajustar tus filtros o abre un nuevo ticket.</p>
            </div>
          )}
        </CardContent>
      </Card>
      
      <AddEditTicketDialog
        isOpen={isTicketDialogOpen}
        onOpenChange={setIsTicketDialogOpen}
        ticketToEdit={editingTicket}
        leads={leads}
        users={users}
        slas={slas} 
        supportQueues={supportQueues} 
        onSave={handleSaveTicket}
      />

      <Card className="mt-4 bg-amber-50 border-amber-200">
        <CardHeader>
          <CardTitle className="flex items-center text-amber-700 text-lg gap-2">
            <AlertTriangle className="h-5 w-5" />
            Estado de Desarrollo de Funcionalidades Avanzadas de Tickets
          </CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-amber-600">
          <ul className="list-disc list-inside space-y-2">
            <li>
              <strong>Acuerdos de Nivel de Servicio (SLA):</strong>
              <Badge variant="default" className="ml-2 bg-green-500 hover:bg-green-600 text-white">Implementado (Básico)</Badge>
              <p className="text-xs pl-5">Gestión básica de SLAs (CRUD) y selección en ticket implementada. Alertas y aplicación de reglas de negocio (backend) pendiente.</p>
            </li>
            <li>
              <strong>Colas de Soporte:</strong>
              <Badge variant="default" className="ml-2 bg-green-500 hover:bg-green-600 text-white">Implementado (Básico)</Badge>
              <p className="text-xs pl-5">Gestión básica de Colas (CRUD) y selección en ticket implementada. Reglas de asignación automática (backend) pendiente.</p>
            </li>
            <li>
              <strong>Escalados Automáticos:</strong>
               <Badge variant="default" className="ml-2 bg-green-500 hover:bg-green-600 text-white">Implementado (Backend Activo)</Badge>
              <p className="text-xs pl-5">Las reglas definidas en "Configuración {">"} Reglas de Escalado" son procesadas por el backend. Revisa el Historial de Escalados para ver su actividad.</p>
            </li>
             <li>
                <strong>Base de Conocimiento (Knowledge Base):</strong> 
                <Badge variant="outline" className="ml-2 border-gray-500 text-gray-600">Planeado</Badge>
                <p className="text-xs pl-5">Sugerir artículos de ayuda (UI placeholder añadido en TicketItem). Creación/gestión de KB pendiente.</p>
            </li>
            <li>
                <strong>Encuestas de Satisfacción:</strong> 
                <Badge variant="default" className="ml-2 bg-green-500 hover:bg-green-600 text-white">Parcial (Backend Implementado)</Badge>
                <p className="text-xs pl-5">El envío automático de encuestas CSAT está implementado en backend. La UI para crear plantillas avanzadas y ver resultados está pendiente.</p>
            </li>
          </ul>
          <p className="mt-4 font-semibold">Estas funcionalidades se implementarán progresivamente para mejorar la gestión avanzada de tickets.</p>
        </CardContent>
      </Card>


      {ticketToDelete && (
        <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>¿Estás seguro?</AlertDialogTitle>
              <AlertDialogDescription>
                Esta acción no se puede deshacer. Esto eliminará permanentemente el ticket &quot;{ticketToDelete.title}&quot;
                y todos sus datos asociados (comentarios, adjuntos).
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel onClick={() => setTicketToDelete(null)}>Cancelar</AlertDialogCancel>
              <AlertDialogAction onClick={handleDeleteTicket} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                Sí, eliminar ticket
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}
    </div>
  );
}
