
"use client";

import type { Ticket, Lead, User, TicketPriority, TicketStatus, Comment, KnowledgeBaseArticle } from "@/lib/types";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Edit3, Trash2, User as UserIconLk, CalendarDays, LinkIcon, ShieldAlert, CheckCircle2, Waypoints, XCircle, Paperclip, MessageSquarePlus, Send, UploadCloud, MessageCircle, Briefcase, X, Brain, SmilePlus, Info, LayersIcon, ShieldCheck } from "lucide-react";
import { format, parseISO, isValid, differenceInDays } from 'date-fns';
import { es } from 'date-fns/locale'; 
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import React, { useState, useEffect } from "react";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import { db, storage } from "@/lib/firebase";
import { collection, query, orderBy, onSnapshot, Timestamp } from "firebase/firestore";
import { ref as storageRef, uploadBytesResumable, getDownloadURL, deleteObject } from "firebase/storage";
import { TICKET_STATUSES, INITIAL_KB_ARTICLES } from "@/lib/constants";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label }
from "@/components/ui/label";
import { useAuth } from "@/contexts/auth-context";
import { getUserInitials } from "@/lib/utils";
import { SuggestKbArticleDialog } from "./suggest-kb-article-dialog";

interface TicketItemProps {
  ticket: Ticket;
  leads: Lead[];
  users: User[];
  currentUser: User | null;
  onEdit: (ticket: Ticket) => void;
  onDelete: (ticketId: string) => void;
  onAddComment: (ticketId: string, commentText: string, attachments: {name: string, url: string}[]) => Promise<void>;
  onUpdateTicketSolution: (ticketId: string, solutionDescription: string, solutionAttachments: { name: string; url: string }[], status: TicketStatus) => Promise<void>;
  defaultOpen?: boolean; // New prop to control initial open state
}

const UserAvatarNameTooltip = ({ user, label, icon: IconComp, currentAuthUser }: { user?: User, label: string, icon?: React.ElementType, currentAuthUser?: User | null }) => {
    if (!user) return <span className="text-xs text-muted-foreground">{label}: N/A</span>;
    return (
      <TooltipProvider delayDuration={100}>
        <Tooltip>
          <TooltipTrigger asChild>
            <div className="flex items-center gap-1.5">
                {IconComp && <IconComp className="h-4 w-4" />}
                <Avatar className="h-5 w-5">
                  <AvatarImage src={user.avatarUrl || `https://avatar.vercel.sh/${user.email}.png`} alt={user.name} data-ai-hint="user avatar"/>
                  <AvatarFallback>{getUserInitials(user.name)}</AvatarFallback>
                </Avatar>
                <span className="text-xs hidden sm:inline">{user.name} {currentAuthUser && user.id === currentAuthUser.id ? "(Yo)" : ""}</span>
            </div>
          </TooltipTrigger>
          <TooltipContent>
            <p>{label}: {user.name}</p>
            <p className="text-xs text-muted-foreground">{user.email}</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
};

export function TicketItem({
  ticket,
  leads,
  users,
  currentUser,
  onEdit,
  onDelete,
  onAddComment,
  onUpdateTicketSolution,
  defaultOpen = false, // Default to false
}: TicketItemProps) {
  const relatedLead = ticket.relatedLeadId ? leads.find(l => l.id === ticket.relatedLeadId) : null;
  const reporter = users.find(u => u.id === ticket.reporterUserId);
  const assignee = ticket.assigneeUserId ? users.find(u => u.id === ticket.assigneeUserId) : null;

  const [internalComments, setInternalComments] = useState<Comment[]>([]);
  const [newCommentText, setNewCommentText] = useState("");
  const [commentFile, setCommentFile] = useState<File | null>(null);
  const [isUploadingCommentAttachment, setIsUploadingCommentAttachment] = useState(false);
  const [commentUploadProgress, setCommentUploadProgress] = useState(0);

  const [solutionDescription, setSolutionDescription] = useState(ticket.solutionDescription || "");
  const [solutionFile, setSolutionFile] = useState<File | null>(null);
  const [isUploadingSolutionAttachment, setIsUploadingSolutionAttachment] = useState(false);
  const [solutionUploadProgress, setSolutionUploadProgress] = useState(0);
  const [solutionStatus, setSolutionStatus] = useState<TicketStatus>(ticket.status);
  const [currentSolutionAttachments, setCurrentSolutionAttachments] = useState(ticket.solutionAttachments || []);
  
  const [isSuggestKbDialogOpen, setIsSuggestKbDialogOpen] = useState(false);


  const { toast } = useToast();

  const isCreator = currentUser?.id === ticket.reporterUserId;
  const isAssignee = currentUser?.id === ticket.assigneeUserId;
  const canManageSolution = isAssignee && ticket.status !== 'Cerrado'; // Agent can update solution if ticket is not closed
  const canEditTicket = isCreator || currentUser?.role === 'admin' || currentUser?.role === 'supervisor';

  useEffect(() => {
    if (!ticket.id) return;
    const commentsColRef = collection(db, "tickets", ticket.id, "comments");
    const qComments = query(commentsColRef, orderBy("createdAt", "asc"));

    const unsubscribe = onSnapshot(qComments, (snapshot) => {
      const fetchedComments = snapshot.docs.map(docSnap => {
        const data = docSnap.data();
        return {
          id: docSnap.id,
          userId: data.userId,
          userName: data.userName,
          userAvatarUrl: data.userAvatarUrl || null,
          text: data.text,
          createdAt: (data.createdAt as Timestamp)?.toDate().toISOString() || new Date().toISOString(),
          attachments: data.attachments || [],
        } as Comment;
      });
      setInternalComments(fetchedComments);
    }, (error) => {
      console.error(`Error al obtener comentarios para ticket ${ticket.id}: `, error);
      toast({
        title: "Error al Cargar Comentarios",
        description: "No se pudieron actualizar los comentarios en tiempo real.",
        variant: "destructive"
      });
    });

    return () => unsubscribe();
  }, [ticket.id, toast]);


  const getPriorityBadge = (priority: TicketPriority) => {
    switch (priority) {
      case 'Alta': return <Badge variant="destructive" className="capitalize flex items-center gap-1"><ShieldAlert className="h-3 w-3" /> {priority}</Badge>;
      case 'Media': return <Badge variant="default" className="bg-amber-500 hover:bg-amber-600 text-white capitalize">{priority}</Badge>;
      case 'Baja': return <Badge variant="secondary" className="capitalize">{priority}</Badge>;
      default: return <Badge variant="outline" className="capitalize">{priority}</Badge>;
    }
  };

  const getStatusBadge = (status: TicketStatus) => {
    switch (status) {
      case 'Abierto': return <Badge variant="outline" className="border-blue-500 text-blue-500 flex items-center gap-1"><Waypoints className="h-3 w-3" /> {status}</Badge>;
      case 'En Progreso': return <Badge variant="default" className="bg-purple-500 hover:bg-purple-600 text-white flex items-center gap-1"><Waypoints className="h-3 w-3" /> {status}</Badge>;
      case 'Resuelto': return <Badge variant="default" className="bg-green-500 hover:bg-green-600 text-white flex items-center gap-1"><CheckCircle2 className="h-3 w-3" /> {status}</Badge>;
      case 'Cerrado': return <Badge variant="secondary" className="flex items-center gap-1"><XCircle className="h-3 w-3" /> {status}</Badge>;
      default: return <Badge variant="outline">{status}</Badge>;
    }
  };

  const handleCommentFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files && event.target.files[0]) {
      setCommentFile(event.target.files[0]);
    } else {
      setCommentFile(null);
    }
  };

  const handleNewCommentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCommentText.trim() && !commentFile) {
      toast({title: "Comentario Vacío", description: "Escribe un comentario o adjunta un archivo.", variant:"destructive"});
      return;
    }
    if (!currentUser) return;

    let uploadedAttachments: {name: string, url: string}[] = [];

    if (commentFile) {
      setIsUploadingCommentAttachment(true);
      setCommentUploadProgress(0);
      const filePath = `ticket-comments/${ticket.id}/${currentUser.id}/${Date.now()}-${commentFile.name}`;
      const fileStorageRef = storageRef(storage, filePath);
      const uploadTask = uploadBytesResumable(fileStorageRef, commentFile);

      try {
        await new Promise<void>((resolve, reject) => {
          uploadTask.on(
            "state_changed",
            (snapshot) => {
              const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
              setCommentUploadProgress(progress);
            },
            (error) => {
              console.error("Error al subir adjunto de comentario:", error);
              toast({ title: "Error al Subir Adjunto de Comentario", description: error.message, variant : "destructive" });
              setIsUploadingCommentAttachment(false);
              reject(error);
            },
            async () => {
              const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
              uploadedAttachments.push({ name: commentFile.name, url: downloadURL });
              setIsUploadingCommentAttachment(false);
              setCommentFile(null);
              const fileInput = (e.target as HTMLFormElement).querySelector('input[type="file"]') as HTMLInputElement | null;
              if (fileInput) fileInput.value = "";
              resolve();
            }
          );
        });
      } catch (error) {
        return;
      }
    }

    await onAddComment(ticket.id, newCommentText, uploadedAttachments);
    setNewCommentText("");
  };

  const handleSolutionFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files && event.target.files[0]) {
      setSolutionFile(event.target.files[0]);
    } else {
      setSolutionFile(null);
    }
  };

  const handleSaveSolution = async (e: React.FormEvent) => {
    e.preventDefault();
    if (solutionStatus !== 'En Progreso' && !solutionDescription.trim() && !solutionFile && currentSolutionAttachments.length === 0) {
      toast({ title: "Solución Vacía", description: "Para los estados 'Resuelto' o 'Cerrado', proporciona una descripción o adjunta un archivo para la solución.", variant:"destructive"});
      return;
    }
    if (!currentUser || !isAssignee) {
      toast({title: "Acción no permitida", description: "Solo el asignado puede registrar la solución.", variant: "destructive"});
      return;
    }

    let newSolutionAttachments = [...currentSolutionAttachments];

    if (solutionFile) {
      setIsUploadingSolutionAttachment(true);
      setSolutionUploadProgress(0);
      const filePath = `ticket-solutions/${ticket.id}/${currentUser.id}/${Date.now()}-${solutionFile.name}`;
      const fileStorageRef = storageRef(storage, filePath); 
      const uploadTask = uploadBytesResumable(fileStorageRef, solutionFile); 

      try {
        await new Promise<void>((resolve, reject) => {
          uploadTask.on(
            "state_changed",
            (snapshot) => {
              const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
              setSolutionUploadProgress(progress);
            },
            (error) => {
              console.error("Error al subir adjunto de solución:", error);
              toast({ title: "Error al Subir Adjunto de Solución", description: error.message, variant : "destructive" });
              setIsUploadingSolutionAttachment(false);
              reject(error);
            },
            async () => {
              const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
              newSolutionAttachments.push({ name: solutionFile.name, url: downloadURL });
              setSolutionFile(null);
              setIsUploadingSolutionAttachment(false);
              const fileInput = (e.target as HTMLFormElement).querySelector('input[type="file"]') as HTMLInputElement | null;
              if (fileInput) fileInput.value = "";
              resolve();
            }
          );
        });
      } catch (error) {
        return;
      }
    }

    await onUpdateTicketSolution(ticket.id, solutionDescription, newSolutionAttachments, solutionStatus);
    setCurrentSolutionAttachments(newSolutionAttachments); // Update local state to reflect new attachments
  };

  const handleRemoveSolutionAttachment = async (attachmentUrlToRemove: string) => {
    if (!window.confirm("¿Estás seguro de que quieres eliminar este adjunto de la solución?")) return;
    try {
        const fileRef = storageRef(storage, attachmentUrlToRemove);
        await deleteObject(fileRef);
        const updatedAttachments = currentSolutionAttachments.filter(att => att.url !== attachmentUrlToRemove);
        setCurrentSolutionAttachments(updatedAttachments);
        // Optimistically update or call onUpdateTicketSolution if preferred to reflect change in DB immediately
        await onUpdateTicketSolution(ticket.id, solutionDescription, updatedAttachments, ticket.status);
        toast({ title: "Adjunto de solución eliminado" });
    } catch (error: any) {
        console.error("Error eliminando adjunto de solución:", error);
        toast({ title: "Error al eliminar adjunto de solución", description: error.message, variant : "destructive" });
    }
  };

  const handleSuggestArticle = (article: KnowledgeBaseArticle) => {
    const suggestionText = `Revisando tu consulta, creo que este artículo de nuestra Base de Conocimiento podría ayudarte:

**${article.title}**
Puedes encontrar más detalles aquí: [Enlace al Artículo ${article.id}](${article.slug ? `/knowledge-base/${article.slug}` : `/kb/${article.id}`})

Por favor, házmelo saber si esto resuelve tu problema o si necesitas más asistencia.`;
    setNewCommentText(prev => prev ? `${prev}\n\n${suggestionText}` : suggestionText);
    setIsSuggestKbDialogOpen(false);
  };


  return (
    <Card id={`ticket-item-${ticket.id}`} className={`transition-all duration-200 shadow-sm hover:shadow-md ${ticket.status === 'Cerrado' ? 'bg-muted/50 opacity-80' : 'bg-card'}`}>
      <Accordion type="single" collapsible className="w-full" defaultValue={defaultOpen ? `ticket-${ticket.id}-details` : undefined}>
        <AccordionItem value={`ticket-${ticket.id}-details`} className="border-b-0">
             <div className="flex items-start gap-4 p-4">
                
                <div className="flex-grow">
                  <AccordionTrigger className="p-0 hover:no-underline flex-grow text-left">
                    <CardTitle className={`text-lg ${ticket.status === 'Cerrado' ? 'line-through text-muted-foreground' : ''}`}>{ticket.title}</CardTitle>
                  </AccordionTrigger>
                
                {ticket.description && (
                    <p className={`text-sm mt-1 ${ticket.status === 'Cerrado' ? 'text-muted-foreground/70' : "text-muted-foreground"}`}>
                    {ticket.description.length > 150 ? `${ticket.description.substring(0, 147)}...` : ticket.description}
                    </p>
                )}
                <div className="mt-2 flex flex-wrap gap-2 items-center text-xs text-muted-foreground">
                    {getStatusBadge(ticket.status)}
                    {getPriorityBadge(ticket.priority)}
                    {ticket.createdAt && isValid(parseISO(ticket.createdAt)) && (
                        <span className="flex items-center gap-1">
                            <CalendarDays className="h-3 w-3" /> Creado: {format(parseISO(ticket.createdAt), "PPp", { locale: es })}
                        </span>
                    )}
                    {ticket.updatedAt && isValid(parseISO(ticket.updatedAt)) && (
                        <span className="flex items-center gap-1">
                            <CalendarDays className="h-3 w-3 text-blue-500" /> Actualizado: {format(parseISO(ticket.updatedAt), "PPp", { locale: es })}
                        </span>
                    )}
                    {reporter && <UserAvatarNameTooltip user={reporter} label="Reportado por" currentAuthUser={currentUser} />}
                    {assignee ? <UserAvatarNameTooltip user={assignee} label="Asignado a" currentAuthUser={currentUser} /> :
                        <span className="flex items-center gap-1 p-1 px-1.5 bg-muted rounded-md text-xs">
                            <UserIconLk className="h-3 w-3" /> Sin asignar
                        </span>
                    }
                    {relatedLead && (
                        <TooltipProvider delayDuration={100}>
                            <Tooltip>
                            <TooltipTrigger asChild>
                                <span className="flex items-center gap-1 p-1 px-1.5 bg-secondary rounded-md hover:bg-secondary/80 cursor-default">
                                <LinkIcon className="h-3 w-3 text-primary" /> {relatedLead.name}
                                </span>
                            </TooltipTrigger>
                            <TooltipContent><p>Enlazado a Lead: {relatedLead.name}</p></TooltipContent>
                            </Tooltip>
                        </TooltipProvider>
                    )}
                </div>
                </div>
                <div className="flex gap-1 shrink-0">
                {canEditTicket && (
                  <Button variant="ghost" size="icon" onClick={() => onEdit(ticket)} className="h-8 w-8" aria-label="Editar ticket">
                    <Edit3 className="h-4 w-4" />
                  </Button>
                )}
                {(isCreator || currentUser?.role === 'admin') && (
                  <Button variant="ghost" size="icon" onClick={() => onDelete(ticket.id)} className="h-8 w-8 text-destructive hover:text-destructive" aria-label="Eliminar ticket">
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
              </div>
            </div>
          <AccordionContent className="px-4 pb-4 space-y-4">
            {ticket.description && ticket.description.length > 150 && (
                <div className="pt-2 border-t">
                    <h4 className="text-sm font-semibold text-muted-foreground mb-1">Descripción Completa:</h4>
                    <p className="text-sm text-card-foreground whitespace-pre-wrap">{ticket.description}</p>
                </div>
            )}
            {(ticket.slaId || ticket.queueId) && (
                <div className="mt-2 pt-2 border-t grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1 text-xs text-muted-foreground">
                    {ticket.slaId && (
                         <div className="flex items-center gap-1.5" title="SLA Aplicado">
                            <ShieldCheck className="h-4 w-4 text-green-600" /> SLA: {ticket.slaId}
                        </div>
                    )}
                    {ticket.queueId && (
                         <div className="flex items-center gap-1.5" title="Cola de Soporte">
                            <LayersIcon className="h-4 w-4 text-indigo-600" /> Cola: {ticket.queueId}
                        </div>
                    )}
                </div>
            )}
            {ticket.attachments && ticket.attachments.length > 0 && (
              <div className="pt-3 border-t">
                <h4 className="text-sm font-semibold text-primary flex items-center gap-1 mb-2"><Paperclip className="h-4 w-4"/>Adjuntos del Ticket:</h4>
                <ul className="list-none space-y-1 text-sm">
                  {ticket.attachments.map((att, index) => (
                     <li key={index}>
                       <a
                         href={att.url}
                         target="_blank"
                         rel="noopener noreferrer"
                         className="text-primary hover:underline flex items-center gap-1 break-all"
                         title={`Descargar ${att.name}`}
                        >
                         <Paperclip className="h-3 w-3 shrink-0"/> {att.name}
                       </a>
                     </li>
                  ))}
                </ul>
              </div>
            )}

            {(ticket.solutionDescription || (ticket.solutionAttachments && ticket.solutionAttachments.length > 0) || canManageSolution) && (
              <div className="pt-3 border-t">
                <h4 className="text-sm font-semibold text-green-600 flex items-center gap-1 mb-2">
                  <Briefcase className="h-4 w-4"/>Solución del Ticket
                </h4>
                {canManageSolution ? (
                  <form onSubmit={handleSaveSolution} className="space-y-3">
                    <div>
                      <Label htmlFor={`solution-desc-${ticket.id}`} className="text-xs font-medium">Descripción de la Solución</Label>
                      <Textarea
                        id={`solution-desc-${ticket.id}`}
                        value={solutionDescription}
                        onChange={(e) => setSolutionDescription(e.target.value)}
                        placeholder="Detalla la solución aplicada..."
                        rows={3}
                        disabled={isUploadingSolutionAttachment}
                      />
                    </div>
                    <div>
                      <Label htmlFor={`solution-files-${ticket.id}`} className="text-xs font-medium">Adjuntos de la Solución</Label>
                      <Input
                        id={`solution-files-${ticket.id}`}
                        type="file"
                        onChange={handleSolutionFileChange}
                        className="text-xs mt-1"
                        disabled={isUploadingSolutionAttachment}
                        accept="image/*,application/pdf,.doc,.docx,.txt,.csv,.xls,.xlsx,.zip,.rar"
                      />
                      {isUploadingSolutionAttachment && (
                        <div className="space-y-1 mt-1">
                          <Progress value={solutionUploadProgress} className="w-full h-1.5" />
                          <p className="text-xs text-muted-foreground text-center">Subiendo adjunto de solución... {solutionUploadProgress.toFixed(0)}%</p>
                        </div>
                      )}
                      {solutionFile && !isUploadingSolutionAttachment && (
                        <p className="text-xs text-muted-foreground mt-1">Archivo para solución: {solutionFile.name}</p>
                      )}
                      {currentSolutionAttachments && currentSolutionAttachments.length > 0 && (
                        <div className="mt-2 space-y-1">
                          <p className="text-xs font-medium">Adjuntos actuales de la solución:</p>
                          <ul className="list-disc list-inside space-y-1">
                            {currentSolutionAttachments.map((att, index) => (
                                <li key={index} className="text-xs flex items-center justify-between">
                                  <a href={att.url} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline truncate max-w-[200px]" title={att.name}>
                                    <Paperclip className="h-3 w-3 inline mr-1" />{att.name}
                                  </a>
                                  <Button variant="ghost" size="icon" className="h-5 w-5" onClick={() => handleRemoveSolutionAttachment(att.url)} title="Eliminar adjunto de solución" disabled={isUploadingSolutionAttachment}>
                                    <X className="h-3 w-3 text-destructive"/>
                                  </Button>
                                </li>
                              ))}
                          </ul>
                        </div>
                      )}
                    </div>
                    <div>
                        <Label htmlFor={`solution-status-${ticket.id}`} className="text-xs font-medium">Actualizar Estado del Ticket</Label>
                        <Select
                            value={solutionStatus}
                            onValueChange={(value: TicketStatus) => setSolutionStatus(value)}
                            disabled={isUploadingSolutionAttachment}
                        >
                            <SelectTrigger className="mt-1">
                                <SelectValue placeholder="Seleccionar estado" />
                            </SelectTrigger>
                            <SelectContent>
                                {TICKET_STATUSES.filter(s => s === 'En Progreso' || s === 'Resuelto' || s === 'Cerrado').map(status => (
                                    <SelectItem key={status} value={status}>{status}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                    <Button type="submit" size="sm" disabled={isUploadingSolutionAttachment}>
                      {isUploadingSolutionAttachment ? <><UploadCloud className="mr-2 h-4 w-4 animate-pulse" /> Subiendo...</> : "Guardar Solución"}
                    </Button>
                  </form>
                ) : (
                  <>
                    {ticket.solutionDescription && <p className="text-sm whitespace-pre-wrap bg-green-50 p-2 rounded-md">{ticket.solutionDescription}</p>}
                    {ticket.solutionAttachments && ticket.solutionAttachments.length > 0 && (
                       <div className="mt-2">
                          <p className="text-xs font-medium text-muted-foreground">Adjuntos de la solución:</p>
                          <ul className="list-none space-y-0.5 text-xs">
                             {ticket.solutionAttachments.map((att, idx) => (
                                <li key={idx}>
                                  <a href={att.url} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline flex items-center gap-1 break-all" title={att.name}>
                                    <Paperclip className="h-3 w-3 shrink-0"/> {att.name}
                                  </a>
                                </li>
                             ))}
                          </ul>
                        </div>
                    )}
                    {!ticket.solutionDescription && (!ticket.solutionAttachments || ticket.solutionAttachments.length === 0) && (
                      <p className="text-sm text-muted-foreground">Aún no se ha proporcionado una solución.</p>
                    )}
                  </>
                )}
              </div>
            )}
            
            <div className="pt-3 border-t space-y-2">
                <Button variant="ghost" size="sm" className="text-xs" onClick={() => setIsSuggestKbDialogOpen(true)} disabled={ticket.status === 'Cerrado'}>
                    <Brain className="mr-1.5 h-3.5 w-3.5"/> Sugerir Artículo KB
                </Button>
                 {(ticket.status === 'Resuelto' || ticket.status === 'Cerrado') && (
                    <Button variant="ghost" size="sm" className="text-xs" disabled={!!ticket.satisfactionSurveySentAt || ticket.status === 'Cerrado'}>
                        <SmilePlus className="mr-1.5 h-3.5 w-3.5"/> 
                        {ticket.satisfactionSurveySentAt ? "Encuesta Enviada" : "Enviar Encuesta (Auto)"}
                    </Button>
                )}
                 {(ticket.status === 'Resuelto' || ticket.status === 'Cerrado') && ticket.satisfactionRating && (
                    <div className="text-xs text-muted-foreground p-2 bg-blue-50 rounded-md">
                        <p><strong>Satisfacción Cliente:</strong> {ticket.satisfactionRating}/5</p>
                        {ticket.satisfactionComment && <p>"{ticket.satisfactionComment}"</p>}
                    </div>
                 )}
            </div>

            <div className="pt-3 border-t">
              <h4 className="text-sm font-semibold text-primary flex items-center gap-1 mb-2"><MessageCircle className="h-4 w-4"/>Comentarios ({internalComments.length || 0})</h4>
              {internalComments && internalComments.length > 0 ? (
                <div className="space-y-3 max-h-60 overflow-y-auto pr-2">
                  {internalComments.map(comment => (
                    <div key={comment.id} className="p-3 rounded-md bg-muted/50">
                      <div className="flex items-center justify-between mb-1">
                        <div className="flex items-center gap-2">
                          <Avatar className="h-6 w-6">
                            <AvatarImage src={comment.userAvatarUrl || `https://avatar.vercel.sh/${comment.userName}.png`} alt={comment.userName} data-ai-hint="user avatar"/>
                            <AvatarFallback>{getUserInitials(comment.userName)}</AvatarFallback>
                          </Avatar>
                          <span className="text-xs font-medium">{comment.userName}</span>
                        </div>
                        <span className="text-xs text-muted-foreground">{format(parseISO(comment.createdAt), "PP p", { locale: es })}</span>
                      </div>
                      <p className="text-sm whitespace-pre-wrap">{comment.text}</p>
                      {comment.attachments && comment.attachments.length > 0 && (
                        <div className="mt-2">
                          <p className="text-xs font-medium text-muted-foreground">Adjuntos del comentario:</p>
                          <ul className="list-none space-y-0.5 text-xs">
                             {comment.attachments.map((att, idx) => (
                                <li key={idx}>
                                  <a href={att.url} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline flex items-center gap-1 break-all" title={att.name}>
                                    <Paperclip className="h-3 w-3 shrink-0"/> {att.name}
                                  </a>
                                </li>
                             ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-muted-foreground">No hay comentarios aún.</p>
              )}
              <form onSubmit={handleNewCommentSubmit} className="mt-4 space-y-2">
                <Textarea
                  value={newCommentText}
                  onChange={(e) => setNewCommentText(e.target.value)}
                  placeholder="Escribe un comentario..."
                  rows={2}
                  disabled={isUploadingCommentAttachment || ticket.status === 'Cerrado'}
                />
                <Input
                  type="file"
                  onChange={handleCommentFileChange}
                  className="text-xs"
                  disabled={isUploadingCommentAttachment || ticket.status === 'Cerrado'}
                  accept="image/*,application/pdf,.doc,.docx,.txt,.csv,.xls,.xlsx,.zip,.rar"
                />
                 {isUploadingCommentAttachment && (
                  <div className="space-y-1">
                    <Progress value={commentUploadProgress} className="w-full h-1.5" />
                    <p className="text-xs text-muted-foreground text-center">Subiendo adjunto... {commentUploadProgress.toFixed(0)}%</p>
                  </div>
                )}
                {commentFile && !isUploadingCommentAttachment && (
                  <p className="text-xs text-muted-foreground">Archivo para comentario: {commentFile.name}</p>
                )}
                <Button type="submit" size="sm" disabled={(!newCommentText.trim() && !commentFile) || isUploadingCommentAttachment || ticket.status === 'Cerrado'}>
                  {isUploadingCommentAttachment ? <><UploadCloud className="mr-2 h-4 w-4 animate-pulse" /> Subiendo...</> : <><Send className="mr-2 h-4 w-4" /> Enviar Comentario</>}
                </Button>
                 <p className="text-xs text-muted-foreground">Las notificaciones por correo para nuevos comentarios requieren configuración de backend (ej. Firebase Cloud Functions).</p>
              </form>
            </div>
          </AccordionContent>
        </AccordionItem>
      </Accordion>
      {isSuggestKbDialogOpen && (
        <SuggestKbArticleDialog
            isOpen={isSuggestKbDialogOpen}
            onOpenChange={setIsSuggestKbDialogOpen}
            ticket={ticket}
            kbArticles={INITIAL_KB_ARTICLES} // Replace with actual fetched articles when KB is ready
            onArticleSuggested={handleSuggestArticle}
        />
      )}
    </Card>
  );
}

    

