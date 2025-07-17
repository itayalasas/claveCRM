'use client';
import { useState, useEffect, useCallback } from "react";
import { ChatList } from "@/components/live-chat/agent-panel/chat-list";
import { ChatWindow } from "@/components/live-chat/agent-panel/chat-window";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { LayoutGrid, MessageSquare, Search, Filter, History } from "lucide-react";
import type { ChatSession, ChatMessage, User, Lead, Ticket, Contact, PipelineStage } from "@/lib/types";
import { AddEditLeadDialog } from "@/components/pipeline/add-edit-lead-dialog";
import { AddEditTicketDialog } from "@/components/tickets/add-edit-ticket-dialog";
import { LinkChatToEntityDialog } from "@/components/live-chat/agent-panel/link-chat-to-entity-dialog";
import { INITIAL_PIPELINE_STAGES } from "@/lib/constants";
import { useAuth } from "@/contexts/auth-context";
import { db } from "@/lib/firebase";
import { collection, query, where, orderBy, onSnapshot, doc, updateDoc, addDoc, serverTimestamp, Timestamp, getDocs, setDoc, type DocumentSnapshot, type QueryDocumentSnapshot } from "firebase/firestore"; // Added DocumentSnapshot
import { useToast } from "@/hooks/use-toast";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { isValid, parseISO } from "date-fns"; // For robust date checking
import { logSystemEvent } from "@/lib/auditLogger";

// Helper function to map Firestore document data to ChatSession
const mapDocToChatSession = (docSnap: QueryDocumentSnapshot | DocumentSnapshot): ChatSession => {
  const data = docSnap.data() as any; // Use any for data to handle potential missing fields gracefully

  let createdAtISO = new Date(0).toISOString(); // Default to epoch for sorting if undefined
  if (data.createdAt instanceof Timestamp) {
    createdAtISO = data.createdAt.toDate().toISOString();
  } else if (typeof data.createdAt === 'string' && isValid(parseISO(data.createdAt))) {
    createdAtISO = data.createdAt;
  } else if (data.createdAt && typeof data.createdAt.toDate === 'function') { // Handle older Timestamp-like objects
    createdAtISO = data.createdAt.toDate().toISOString();
  }


  let lastMessageAtISO = new Date(0).toISOString(); // Default to epoch for sorting
  if (data.lastMessageAt instanceof Timestamp) {
    lastMessageAtISO = data.lastMessageAt.toDate().toISOString();
  } else if (typeof data.lastMessageAt === 'string' && isValid(parseISO(data.lastMessageAt))) {
    lastMessageAtISO = data.lastMessageAt;
  } else if (data.lastMessageAt && typeof data.lastMessageAt.toDate === 'function') {
    lastMessageAtISO = data.lastMessageAt.toDate().toISOString();
  }

  return {
    id: docSnap.id,
    visitorId: data.visitorId || '',
    visitorName: data.visitorName || undefined,
    agentId: data.agentId || null,
    status: data.status || 'pending',
    createdAt: createdAtISO,
    lastMessageAt: lastMessageAtISO,
    initialMessage: data.initialMessage || undefined,
    currentPageUrl: data.currentPageUrl || undefined,
    relatedLeadId: data.relatedLeadId || undefined,
    relatedContactId: data.relatedContactId || undefined,
    relatedTicketId: data.relatedTicketId || undefined,
  } as ChatSession;
};


export default function AgentPanelPage() {
  const [liveSessions, setLiveSessions] = useState<ChatSession[]>([]);
  const [historySessions, setHistorySessions] = useState<ChatSession[]>([]);
  const [selectedSession, setSelectedSession] = useState<ChatSession | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  
  const [isLoadingLiveSessions, setIsLoadingLiveSessions] = useState(true);
  const [isLoadingHistorySessions, setIsLoadingHistorySessions] = useState(false);
  const [isLoadingMessages, setIsLoadingMessages] = useState(false);
  const [isLoadingSupportData, setIsLoadingSupportData] = useState(true);

  const { currentUser, getAllUsers } = useAuth();
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState<"live" | "history">("live");
  const [historySearchTerm, setHistorySearchTerm] = useState("");

  // CRM Data for dialogs
  const [leads, setLeads] = useState<Lead[]>([]);
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [pipelineStages, setPipelineStages] = useState<PipelineStage[]>(INITIAL_PIPELINE_STAGES);


  // Dialog states
  const [isAddLeadDialogOpen, setIsAddLeadDialogOpen] = useState(false);
  const [leadInitialData, setLeadInitialData] = useState<Partial<Lead> | null>(null);
  
  const [isAddTicketDialogOpen, setIsAddTicketDialogOpen] = useState(false);
  const [ticketInitialData, setTicketInitialData] = useState<Partial<Ticket> | null>(null);

  const [isLinkEntityDialogOpen, setIsLinkEntityDialogOpen] = useState(false);
  const [sessionToLink, setSessionToLink] = useState<ChatSession | null>(null);

  const linkedLeadForSelectedSession = selectedSession?.relatedLeadId ? leads.find(l => l.id === selectedSession.relatedLeadId) : null;
  const linkedTicketForSelectedSession = selectedSession?.relatedTicketId ? tickets.find(t => t.id === selectedSession.relatedTicketId) : null;


  // Fetch live sessions
  useEffect(() => {
    if (!currentUser || activeTab !== "live") {
      if (activeTab !== "live") setIsLoadingLiveSessions(false);
      return;
    }
    setIsLoadingLiveSessions(true);
    const q = query(
      collection(db, "chatSessions"),
      where("status", "in", ["pending", "active"]),
      orderBy("lastMessageAt", "desc")
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const sessions = snapshot.docs.map(mapDocToChatSession);
      setLiveSessions(sessions);
      setIsLoadingLiveSessions(false);
    }, (error) => {
      console.error("Error al obtener sesiones de chat en vivo: ", error);
      toast({ title: "Error al cargar chats en vivo", description: "No se pudieron obtener las sesiones de chat.", variant: "destructive" });
      setIsLoadingLiveSessions(false);
    });
    return () => unsubscribe();
  }, [currentUser, toast, activeTab]);

  // Fetch history sessions
  const fetchHistorySessions = useCallback(async () => {
    if (!currentUser || activeTab !== "history") return;
    setIsLoadingHistorySessions(true);
    try {
      const q = query(
        collection(db, "chatSessions"),
        where("status", "==", "closed"),
        orderBy("lastMessageAt", "desc")
      );
      const snapshot = await getDocs(q);
      const sessions = snapshot.docs.map(mapDocToChatSession);
      setHistorySessions(sessions);
    } catch (error) {
      console.error("Error al obtener historial de chat: ", error);
      toast({ title: "Error al cargar historial", description: "No se pudo obtener el historial de chats.", variant: "destructive" });
    } finally {
      setIsLoadingHistorySessions(false);
    }
  }, [currentUser, toast, activeTab]);

  useEffect(() => {
    if (activeTab === "history") {
      fetchHistorySessions();
    } else {
      setHistorySessions([]); 
    }
  }, [activeTab, fetchHistorySessions]);

  // Fetch CRM support data (Leads, Contacts, Users, Tickets)
   const fetchCRMSData = useCallback(async () => {
    setIsLoadingSupportData(true);
    try {
      const [leadsSnapshot, contactsSnapshot, usersData, ticketsSnapshot] = await Promise.all([
        getDocs(query(collection(db, "leads"), orderBy("createdAt", "desc"))),
        getDocs(query(collection(db, "contacts"), orderBy("createdAt", "desc"))),
        getAllUsers(),
        getDocs(query(collection(db, "tickets"), orderBy("createdAt", "desc"))),
      ]);
      setLeads(leadsSnapshot.docs.map(d => ({id: d.id, ...d.data() } as Lead)));
      setContacts(contactsSnapshot.docs.map(d => ({id: d.id, ...d.data() } as Contact)));
      setUsers(usersData);
      setTickets(ticketsSnapshot.docs.map(d => ({id: d.id, ...d.data()} as Ticket)));
    } catch (error) {
      console.error("Error al obtener datos CRM:", error);
      toast({ title: "Error al cargar datos CRM", variant: "destructive" });
    } finally {
      setIsLoadingSupportData(false);
    }
  }, [getAllUsers, toast]);

  useEffect(() => {
    fetchCRMSData();
  }, [fetchCRMSData]);


  // Fetch messages for selected session
  useEffect(() => {
    if (selectedSession?.id && currentUser) {
      setIsLoadingMessages(true);
      const messagesQuery = query(
        collection(db, `chatSessions/${selectedSession.id}/messages`),
        orderBy("timestamp", "asc")
      );
      const unsubscribeMessages = onSnapshot(messagesQuery, (snapshot) => {
        const fetchedMessages = snapshot.docs.map(docSnap => {
            const data = docSnap.data();
            let timestampISO = new Date(0).toISOString(); // Default
            if (data.timestamp instanceof Timestamp) {
                timestampISO = data.timestamp.toDate().toISOString();
            } else if (typeof data.timestamp === 'string' && isValid(parseISO(data.timestamp))) {
                timestampISO = data.timestamp;
            }
            return {
                id: docSnap.id,
                ...data,
                timestamp: timestampISO,
            } as ChatMessage
        });
        setMessages(fetchedMessages);
        setIsLoadingMessages(false);
      }, (error) => {
        console.error(`Error al obtener mensajes para la sesión ${selectedSession.id}: `, error);
        toast({ title: "Error al cargar mensajes", description: "No se pudieron obtener los mensajes del chat.", variant: "destructive" });
        setIsLoadingMessages(false);
      });
      return () => unsubscribeMessages();
    } else {
      setMessages([]);
    }
  }, [selectedSession, currentUser, toast]);


  const handleSelectSession = async (session: ChatSession) => {
    setSelectedSession(session);
    if (session.status === 'pending' && currentUser && currentUser.role !== 'user' && activeTab === 'live') { 
      try {
        await updateDoc(doc(db, "chatSessions", session.id), {
          agentId: currentUser.id,
          status: "active",
          lastMessageAt: serverTimestamp()
        });
        toast({ title: "Chat Asignado", description: `Te has asignado al chat con ${session.visitorName || session.visitorId}` });
      } catch (error) {
        console.error("Error al asignar chat:", error);
        toast({ title: "Error al asignar chat", variant: "destructive" });
      }
    }
  };

  const handleSendMessage = async (text: string) => {
    if (!selectedSession || !currentUser || !text.trim() || activeTab === 'history') return;
    try {
      await addDoc(collection(db, `chatSessions/${selectedSession.id}/messages`), {
        sessionId: selectedSession.id,
        senderId: currentUser.id,
        senderName: currentUser.name, 
        senderType: "agent",
        text: text.trim(),
        timestamp: serverTimestamp()
      });
      await updateDoc(doc(db, "chatSessions", selectedSession.id), {
        lastMessageAt: serverTimestamp()
      });
    } catch (error) {
      console.error("Error al enviar mensaje:", error);
      toast({ title: "Error al enviar mensaje", variant: "destructive"});
    }
  };
  
  const handleCloseChat = async () => {
    if (!selectedSession || activeTab === 'history' || !currentUser) return;
    try {
      await updateDoc(doc(db, "chatSessions", selectedSession.id), {
        status: "closed",
        lastMessageAt: serverTimestamp()
      });
      toast({ title: "Chat Cerrado", description: `La conversación con ${selectedSession.visitorName || selectedSession.visitorId} ha sido cerrada.`});
      
      await logSystemEvent(
        currentUser,
        'update',
        'ChatSession',
        selectedSession.id,
        `Chat con "${selectedSession.visitorName || selectedSession.visitorId}" cerrado por agente ${currentUser.name}.`
      );
      
      const justClosedSessionId = selectedSession.id;
      setSelectedSession(null);
      setMessages([]);
      // Move from live to history if on live tab
      if (activeTab === 'live') {
        setLiveSessions(prev => prev.filter(s => s.id !== justClosedSessionId));
        // fetchHistorySessions(); // Optionally, fetch history again
      }

    } catch (error) {
      console.error("Error al cerrar chat:", error);
      toast({ title: "Error al cerrar chat", variant: "destructive"});
    }
  };

  const handleOpenCreateLeadDialog = (session: ChatSession) => {
    setLeadInitialData({
      name: session.visitorName || `Lead desde Chat ${session.visitorId.substring(0,6)}`,
      details: `Chat iniciado el ${new Date(session.createdAt).toLocaleString()}.\nID Sesión: ${session.id}\nMensaje inicial: ${session.initialMessage || 'N/A'}`,
      email: session.visitorName && session.visitorName.includes('@') ? session.visitorName : '',
      stageId: pipelineStages.find(s => s.name === 'Nuevo Lead')?.id || pipelineStages[0]?.id || '',
    });
    setSessionToLink(session);
    setIsAddLeadDialogOpen(true);
  };

  const handleSaveLeadFromChat = async (leadData: Lead) => {
    if (!currentUser || !sessionToLink) return;
    const leadId = leadData.id || doc(collection(db, "leads")).id;
    try {
        const leadDocRef = doc(db, "leads", leadId);
        const firestoreSafeLead = {
            ...leadData,
            id: leadId,
            createdAt: leadData.createdAt ? Timestamp.fromDate(new Date(leadData.createdAt)) : Timestamp.now(),
            updatedAt: Timestamp.now(),
            expectedCloseDate: leadData.expectedCloseDate ? Timestamp.fromDate(new Date(leadData.expectedCloseDate)) : null,
            email: leadData.email || null,
            phone: leadData.phone || null,
            company: leadData.company || null,
            details: leadData.details || null,
            value: leadData.value || 0, 
            score: leadData.score || 0,
            probability: leadData.probability || 0,
        };
        await setDoc(leadDocRef, firestoreSafeLead, { merge: true });
        
        await updateDoc(doc(db, "chatSessions", sessionToLink.id), {
          relatedLeadId: leadId,
          visitorName: leadData.name, // Update visitorName in chat session
          lastMessageAt: serverTimestamp() 
        });

        toast({ title: "Lead Creado y Vinculado", description: `Lead "${leadData.name}" creado y vinculado al chat.` });
        fetchCRMSData(); 
        setSelectedSession(prev => prev ? {...prev, relatedLeadId: leadId, visitorName: leadData.name } : null); 
         await logSystemEvent(
            currentUser,
            'create',
            'Lead',
            leadId,
            `Lead "${leadData.name}" creado desde chat con ${sessionToLink.visitorName || sessionToLink.visitorId} (ID Sesión: ${sessionToLink.id}). Chat vinculado.`
         );
    } catch (error) {
        console.error("Error al guardar lead desde chat:", error);
        toast({ title: "Error al Guardar Lead", variant: "destructive" });
    }
    setIsAddLeadDialogOpen(false);
    setLeadInitialData(null);
    setSessionToLink(null);
  };

  const handleOpenCreateTicketDialog = (session: ChatSession) => {
    setTicketInitialData({
        title: `Ticket desde Chat: ${session.visitorName || session.visitorId.substring(0,6)}`,
        description: `Chat iniciado el ${new Date(session.createdAt).toLocaleString()}.\nID Sesión: ${session.id}\nMensaje inicial del visitante:\n${session.initialMessage || 'El visitante no proveyó un mensaje inicial.'}`,
        reporterUserId: session.visitorId, 
        status: 'Abierto',
        priority: 'Media',
        assigneeUserId: currentUser?.id, 
    });
    setSessionToLink(session);
    setIsAddTicketDialogOpen(true);
  };

  const handleSaveTicketFromChat = async (ticketData: Partial<Ticket>) => {
     if (!currentUser || !sessionToLink) return;
    const ticketId = ticketData.id || doc(collection(db, "tickets")).id;
    try {
        const ticketDocRef = doc(db, "tickets", ticketId);
        const firestoreSafeTicket: Ticket = {
            id: ticketId,
            title: ticketData.title || `Ticket desde Chat ${sessionToLink.visitorId.substring(0,6)}`,
            description: ticketData.description || "",
            status: ticketData.status || 'Abierto',
            priority: ticketData.priority || 'Media',
            createdAt: ticketData.createdAt ? ticketData.createdAt : new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            reporterUserId: sessionToLink.visitorId, 
            assigneeUserId: ticketData.assigneeUserId || currentUser?.id || undefined,
            relatedLeadId: ticketData.relatedLeadId || undefined,
            attachments: ticketData.attachments || [],
            solutionDescription: ticketData.solutionDescription || "",
            solutionAttachments: ticketData.solutionAttachments || [],
            comments: ticketData.comments || [],
        };
        
        const dataToSave = {
            ...firestoreSafeTicket,
            createdAt: Timestamp.fromDate(new Date(firestoreSafeTicket.createdAt)),
            updatedAt: Timestamp.fromDate(new Date(firestoreSafeTicket.updatedAt!)),
            assigneeUserId: firestoreSafeTicket.assigneeUserId || null,
            relatedLeadId: firestoreSafeTicket.relatedLeadId || null,
            solutionDescription: firestoreSafeTicket.solutionDescription || "",
            solutionAttachments: firestoreSafeTicket.solutionAttachments || [],
        }

        await setDoc(ticketDocRef, dataToSave, { merge: true });
        
        await updateDoc(doc(db, "chatSessions", sessionToLink.id), {
          relatedTicketId: ticketId,
          // visitorName could also be updated here if desired, e.g. if a contact is found for the ticket reporter
          lastMessageAt: serverTimestamp()
        });
        toast({ title: "Ticket Creado y Vinculado", description: `Ticket "${firestoreSafeTicket.title}" creado y vinculado al chat.` });
        fetchCRMSData(); 
        setSelectedSession(prev => prev ? {...prev, relatedTicketId: ticketId} : null);
        await logSystemEvent(
            currentUser,
            'create',
            'Ticket',
            ticketId,
            `Ticket "${firestoreSafeTicket.title}" creado desde chat con ${sessionToLink.visitorName || sessionToLink.visitorId} (ID Sesión: ${sessionToLink.id}). Chat vinculado.`
         );
    } catch (error) {
        console.error("Error al guardar ticket desde chat:", error);
        toast({ title: "Error al Guardar Ticket", variant: "destructive", description: String(error) });
    }
    setIsAddTicketDialogOpen(false);
    setTicketInitialData(null);
    setSessionToLink(null);
  };
  
  const handleOpenLinkEntityDialog = (session: ChatSession) => {
    setSessionToLink(session);
    setIsLinkEntityDialogOpen(true);
  };

  const handleLinkEntityToChat = async (sessionId: string, entityType: 'lead' | 'contact', entityId: string) => {
    if (!currentUser || !sessionToLink) {
        toast({ title: "Error de autenticación o sesión", description: "No se pudo verificar el usuario o la sesión de chat.", variant: "destructive"});
        return;
    }
    try {
      const firestoreUpdate: any = { lastMessageAt: serverTimestamp() };
      let newVisitorName = sessionToLink.visitorName || `Visitante ${sessionToLink.visitorId.substring(0,6)}`;
      let linkedEntityName = "";
      let linkedEntityTypeDisplay = "";

      if (entityType === 'lead') {
        firestoreUpdate.relatedLeadId = entityId;
        const lead = leads.find(l => l.id === entityId);
        if (lead) {
            newVisitorName = lead.name;
            linkedEntityName = lead.name;
            linkedEntityTypeDisplay = "Lead";
            firestoreUpdate.visitorName = newVisitorName;
        }
      }
      if (entityType === 'contact') {
        firestoreUpdate.relatedContactId = entityId;
        const contact = contacts.find(c => c.id === entityId);
        if (contact) {
            newVisitorName = `${contact.firstName || ""} ${contact.lastName || ""}`.trim() || contact.email;
            linkedEntityName = newVisitorName;
            linkedEntityTypeDisplay = "Contacto";
            firestoreUpdate.visitorName = newVisitorName;
        }
      }

      await updateDoc(doc(db, "chatSessions", sessionId), firestoreUpdate);
      
      const successMessage = `El chat ha sido vinculado exitosamente a ${linkedEntityTypeDisplay} "${linkedEntityName}". El visitante ahora se muestra como "${newVisitorName}".`;
      toast({ title: "Chat Vinculado", description: successMessage });
      
      const localUpdate: Partial<ChatSession> = { lastMessageAt: new Date().toISOString(), visitorName: newVisitorName };
      if (entityType === 'lead') localUpdate.relatedLeadId = entityId;
      if (entityType === 'contact') localUpdate.relatedContactId = entityId;
      
      setSelectedSession(prev => {
        if (prev && prev.id === sessionId) {
          return { ...prev, ...localUpdate };
        }
        return prev;
      });

      const updateList = (list: ChatSession[]) => list.map(s => s.id === sessionId ? { ...s, ...localUpdate } : s);
      setLiveSessions(updateList);
      setHistorySessions(updateList);

      await logSystemEvent(
        currentUser,
        'update',
        'ChatSession',
        sessionId,
        `Chat vinculado a ${linkedEntityTypeDisplay} "${linkedEntityName}" (ID: ${entityId}). Nombre del visitante actualizado a "${newVisitorName}".`
      );

    } catch (error) {
      console.error("Error vinculando entidad al chat:", error);
      toast({ title: "Error al Vincular", description: "No se pudo vincular la entidad al chat.", variant: "destructive"});
    }
    setIsLinkEntityDialogOpen(false);
    setSessionToLink(null);
  };


  const filteredHistorySessions = historySessions.filter(session => 
    (session.visitorName && session.visitorName.toLowerCase().includes(historySearchTerm.toLowerCase())) ||
    session.visitorId.toLowerCase().includes(historySearchTerm.toLowerCase()) ||
    (session.initialMessage && session.initialMessage.toLowerCase().includes(historySearchTerm.toLowerCase()))
  );

  return (
    <div className="flex flex-col h-[calc(100vh-var(--header-height,4rem)-2rem)] gap-6">
      <Card className="shadow-lg shrink-0">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-2xl">
            <LayoutGrid className="h-6 w-6 text-primary" />
            Panel de Agente de Chat en Vivo
          </CardTitle>
          <CardDescription>
            Gestiona las conversaciones de chat con los visitantes de tu sitio web.
          </CardDescription>
        </CardHeader>
      </Card>

      <Tabs value={activeTab} onValueChange={(value) => { setActiveTab(value as "live" | "history"); setSelectedSession(null); setMessages([]);}} className="flex-grow flex flex-col">
        <TabsList className="grid w-full grid-cols-2 shrink-0">
          <TabsTrigger value="live">
            <MessageSquare className="mr-2 h-4 w-4" /> Chats en Vivo
          </TabsTrigger>
          <TabsTrigger value="history">
            <History className="mr-2 h-4 w-4" /> Historial de Chats
          </TabsTrigger>
        </TabsList>

        <TabsContent value="live" className="flex-grow mt-0">
          <div className="flex-grow grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-4 overflow-hidden h-full pt-4">
            <Card className="md:col-span-1 lg:col-span-1 flex flex-col h-full">
              <CardHeader className="p-3 pb-1 shrink-0">
                <CardTitle className="text-base">Conversaciones Activas/Pendientes</CardTitle>
              </CardHeader>
              <CardContent className="flex-grow overflow-y-auto p-2">
                <ChatList
                  sessions={liveSessions}
                  selectedSessionId={selectedSession?.id || null}
                  onSelectSession={handleSelectSession}
                  isLoading={isLoadingLiveSessions}
                  currentAgentId={currentUser?.id || null}
                />
              </CardContent>
            </Card>
            <Card className="md:col-span-2 lg:col-span-3 flex flex-col h-full">
              {selectedSession && activeTab === 'live' && currentUser ? (
                <ChatWindow
                  session={selectedSession}
                  messages={messages}
                  onSendMessage={handleSendMessage}
                  isLoadingMessages={isLoadingMessages}
                  currentAgent={{id: currentUser.id, name: currentUser.name, avatarUrl: currentUser.avatarUrl}}
                  onCloseChat={handleCloseChat}
                  isReadOnly={false}
                  onOpenCreateLeadDialog={handleOpenCreateLeadDialog}
                  onOpenCreateTicketDialog={handleOpenCreateTicketDialog}
                  onOpenLinkEntityDialog={handleOpenLinkEntityDialog}
                  linkedLead={linkedLeadForSelectedSession}
                  linkedTicket={linkedTicketForSelectedSession}
                />
              ) : (
                <div className="flex-grow flex flex-col items-center justify-center text-muted-foreground p-6 text-center">
                  <MessageSquare size={48} className="mb-4 text-primary" />
                  <p className="text-lg font-semibold">Panel de Chat en Vivo</p>
                  <p className="text-sm">Selecciona una conversación activa o pendiente de la lista.</p>
                </div>
              )}
            </Card>
          </div>
        </TabsContent>
        
        <TabsContent value="history" className="flex-grow mt-0">
          <div className="flex-grow grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-4 overflow-hidden h-full pt-4">
            <Card className="md:col-span-1 lg:col-span-1 flex flex-col h-full">
              <CardHeader className="p-3 pb-1 shrink-0">
                <CardTitle className="text-base">Historial de Conversaciones</CardTitle>
                  <div className="flex gap-2 mt-2">
                    <div className="relative flex-grow">
                        <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
                        <Input 
                            type="search" 
                            placeholder="Buscar en historial..." 
                            className="pl-8 w-full h-8 text-xs"
                            value={historySearchTerm}
                            onChange={(e) => setHistorySearchTerm(e.target.value)}
                        />
                    </div>
                    <Button variant="outline" size="sm" className="h-8 text-xs" disabled>
                        <Filter className="mr-1.5 h-3.5 w-3.5" /> Filtrar
                    </Button>
                </div>
              </CardHeader>
              <CardContent className="flex-grow overflow-y-auto p-2">
                <ChatList
                  sessions={filteredHistorySessions}
                  selectedSessionId={selectedSession?.id || null}
                  onSelectSession={handleSelectSession}
                  isLoading={isLoadingHistorySessions}
                  currentAgentId={currentUser?.id || null}
                  isHistoryList={true}
                />
              </CardContent>
            </Card>
            <Card className="md:col-span-2 lg:col-span-3 flex flex-col h-full">
              {selectedSession && activeTab === 'history' && currentUser ? (
                <ChatWindow
                  session={selectedSession}
                  messages={messages}
                  onSendMessage={() => {}} 
                  isLoadingMessages={isLoadingMessages}
                  currentAgent={{id: currentUser.id, name: currentUser.name, avatarUrl: currentUser.avatarUrl}}
                  onCloseChat={() => setSelectedSession(null)} 
                  isReadOnly={true}
                  onOpenCreateLeadDialog={handleOpenCreateLeadDialog} 
                  onOpenCreateTicketDialog={handleOpenCreateTicketDialog} 
                  onOpenLinkEntityDialog={handleOpenLinkEntityDialog} 
                  linkedLead={linkedLeadForSelectedSession}
                  linkedTicket={linkedTicketForSelectedSession}
                />
              ) : (
                <div className="flex-grow flex flex-col items-center justify-center text-muted-foreground p-6 text-center">
                  <History size={48} className="mb-4 text-primary" />
                  <p className="text-lg font-semibold">Historial de Chats</p>
                  <p className="text-sm">Selecciona una conversación cerrada de la lista para ver la transcripción.</p>
                </div>
              )}
            </Card>
          </div>
        </TabsContent>
      </Tabs>

      {isAddLeadDialogOpen && selectedSession && (
        <AddEditLeadDialog
          isOpen={isAddLeadDialogOpen}
          onOpenChange={setIsAddLeadDialogOpen}
          stages={pipelineStages}
          leadToEdit={leadInitialData} 
          onSave={handleSaveLeadFromChat}
          isSubmitting={isLoadingSupportData} 
          trigger={<span/>}
        />
      )}

      {isAddTicketDialogOpen && selectedSession && currentUser && (
         <AddEditTicketDialog
            isOpen={isAddTicketDialogOpen}
            onOpenChange={setIsAddTicketDialogOpen}
            ticketToEdit={ticketInitialData}
            leads={leads}
            users={users}
            onSave={handleSaveTicketFromChat}
            trigger={<span/>}
         />
      )}

      {isLinkEntityDialogOpen && sessionToLink && (
        <LinkChatToEntityDialog
            isOpen={isLinkEntityDialogOpen}
            onOpenChange={setIsLinkEntityDialogOpen}
            session={sessionToLink}
            leads={leads}
            contacts={contacts}
            onLink={handleLinkEntityToChat}
        />
      )}

    </div>
  );
}
