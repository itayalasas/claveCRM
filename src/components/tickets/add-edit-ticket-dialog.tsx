"use client";

import { useState, useEffect, useId } from "react";
import type { Ticket, Lead, User, TicketStatus, TicketPriority, SLA, SupportQueue } from "@/lib/types";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger, // Keep DialogTrigger for internal use if a trigger prop is provided
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Check, ChevronsUpDown, Paperclip, UploadCloud, X, ShieldCheck, ListChecks, LayersIcon } from "lucide-react";
import { TICKET_STATUSES, TICKET_PRIORITIES } from "@/lib/constants";
import { useAuth } from "@/contexts/auth-context";
import { cn } from "@/lib/utils";
import { storage, db } from "@/lib/firebase";
import { ref as storageRef, uploadBytesResumable, getDownloadURL, deleteObject } from "firebase/storage";
import { doc, collection } from "firebase/firestore";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardDescription as CardDescUi, CardHeader as CardHeaderUi, CardTitle as CardTitleUi } from "@/components/ui/card";


interface AddEditTicketDialogProps {
  trigger?: React.ReactNode; 
  ticketToEdit?: Ticket | Partial<Ticket> | null; 
  leads: Lead[];
  users: User[];
  slas: SLA[]; 
  supportQueues: SupportQueue[]; 
  onSave: (ticket: Ticket) => Promise<void>; 
  isOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
}

const defaultTicketBase: Omit<Ticket, 'id' | 'createdAt' | 'reporterUserId' | 'comments'> = {
  title: "",
  description: "",
  status: "Abierto",
  priority: "Media",
  assigneeUserId: undefined,
  relatedLeadId: undefined,
  updatedAt: undefined,
  attachments: [],
  solutionDescription: "",
  solutionAttachments: [],
  slaId: undefined,
  queueId: undefined,
};

const NO_LEAD_SELECTED_VALUE = "__no_lead_selected__";
const NO_USER_SELECTED_VALUE = "__no_user_selected__";
const NO_SLA_SELECTED_VALUE = "__no_sla_selected__";
const NO_QUEUE_SELECTED_VALUE = "__no_queue_selected__";


function generateTicketId(): string {
  const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  let randomLetters = '';
  for (let i = 0; i < 3; i++) {
    randomLetters += letters.charAt(Math.floor(Math.random() * letters.length));
  }
  const randomNumber = Math.floor(10000 + Math.random() * 90000); // 5-digit number
  return `${randomLetters}-${randomNumber}`;
}

export function AddEditTicketDialog({
  trigger,
  ticketToEdit,
  leads,
  users,
  slas = [], 
  supportQueues = [], 
  onSave,
  isOpen: controlledIsOpen,
  onOpenChange: controlledOnOpenChange,
}: AddEditTicketDialogProps) {
  const [internalIsOpen, setInternalIsOpen] = useState(false);
  const isOpen = controlledIsOpen !== undefined ? controlledIsOpen : internalIsOpen;
  
  const setIsOpen = (open: boolean) => {
    if (controlledOnOpenChange) {
      controlledOnOpenChange(open);
    } else {
      setInternalIsOpen(open);
    }
  };
  
  const { currentUser } = useAuth();
  const { toast } = useToast();
  const dialogId = useId();

  const [formData, setFormData] = useState<Partial<Omit<Ticket, 'id' | 'createdAt' | 'reporterUserId' | 'comments'>>>(defaultTicketBase);
  const [assigneePopoverOpen, setAssigneePopoverOpen] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [currentAttachments, setCurrentAttachments] = useState<{ name: string, url: string }[]>([]);

  const isCreatorEditing = ticketToEdit && 'reporterUserId' in ticketToEdit && currentUser?.id === ticketToEdit.reporterUserId;
  const isAdminOrSupervisorEditing = ticketToEdit && (currentUser?.role === 'admin' || currentUser?.role === 'supervisor');


  useEffect(() => {
    if (isOpen) {
      if (ticketToEdit && 'id' in ticketToEdit && ticketToEdit.id) { // Editing existing ticket
        setFormData({
          title: ticketToEdit.title || "",
          description: ticketToEdit.description || "",
          status: ticketToEdit.status || 'Abierto',
          priority: ticketToEdit.priority || 'Media',
          assigneeUserId: ticketToEdit.assigneeUserId || undefined,
          relatedLeadId: ticketToEdit.relatedLeadId || undefined,
          updatedAt: ticketToEdit.updatedAt,
          attachments: ticketToEdit.attachments || [],
          solutionDescription: ticketToEdit.solutionDescription || "",
          solutionAttachments: ticketToEdit.solutionAttachments || [],
          slaId: ticketToEdit.slaId || undefined,
          queueId: ticketToEdit.queueId || undefined,
        });
        setCurrentAttachments(ticketToEdit.attachments || []);
      } else if (ticketToEdit) { // Creating new ticket with initial data (e.g. from chat)
         setFormData({
            ...defaultTicketBase,
            ...ticketToEdit, // Spread initial data
            assigneeUserId: ticketToEdit.assigneeUserId || currentUser?.id || undefined,
            attachments: ticketToEdit.attachments || [],
            solutionDescription: ticketToEdit.solutionDescription || "",
            solutionAttachments: ticketToEdit.solutionAttachments || [],
            slaId: ticketToEdit.slaId || undefined,
            queueId: ticketToEdit.queueId || undefined,
        });
        setCurrentAttachments(ticketToEdit.attachments || []);
      }
      else { // Creating brand new ticket
        setFormData({
            ...defaultTicketBase,
            assigneeUserId: currentUser?.id || undefined, 
            attachments: [],
            solutionDescription: "",
            solutionAttachments: [],
            slaId: undefined,
            queueId: undefined,
        });
        setCurrentAttachments([]);
      }
      setSelectedFile(null);
      setIsUploading(false);
      setUploadProgress(0);
    }
  }, [ticketToEdit, isOpen, currentUser]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSelectChange = (name: 'status' | 'priority' | 'assigneeUserId' | 'relatedLeadId' | 'slaId' | 'queueId', value: string | undefined) => {
    if (name === 'assigneeUserId') {
        setFormData((prev) => ({ ...prev, assigneeUserId: value === NO_USER_SELECTED_VALUE ? undefined : value }));
    } else if (name === 'relatedLeadId') {
        setFormData((prev) => ({ ...prev, relatedLeadId: value === NO_LEAD_SELECTED_VALUE ? undefined : value }));
    } else if (name === 'slaId') {
        setFormData((prev) => ({...prev, slaId: value === NO_SLA_SELECTED_VALUE ? undefined : value }));
    } else if (name === 'queueId') {
        const selectedQueue = supportQueues.find(q => q.id === value);
        setFormData((prev) => ({
            ...prev, 
            queueId: value === NO_QUEUE_SELECTED_VALUE ? undefined : value,
            // Auto-populate assignee and SLA if queue has defaults and fields are not already set
            assigneeUserId: (prev.assigneeUserId === undefined || prev.assigneeUserId === NO_USER_SELECTED_VALUE) && selectedQueue?.defaultAssigneeUserId ? selectedQueue.defaultAssigneeUserId : prev.assigneeUserId,
            slaId: (prev.slaId === undefined || prev.slaId === NO_SLA_SELECTED_VALUE) && selectedQueue?.defaultSlaId ? selectedQueue.defaultSlaId : prev.slaId,
        }));
    }
    else {
        setFormData((prev) => ({ ...prev, [name]: value as TicketStatus | TicketPriority }));
    }
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files && event.target.files[0]) {
      setSelectedFile(event.target.files[0]);
    } else {
      setSelectedFile(null);
    }
  };

  const handleRemoveAttachment = async (attachmentUrlToRemove: string) => {
    if (!window.confirm("¿Estás seguro de que quieres eliminar este adjunto? Esta acción no se puede deshacer.")) return;
    
    try {
      const fileStorageRef = storageRef(storage, attachmentUrlToRemove); 
      await deleteObject(fileStorageRef);
      const updatedAttachments = currentAttachments.filter(att => att.url !== attachmentUrlToRemove);
      setCurrentAttachments(updatedAttachments);
      setFormData(prev => ({ ...prev, attachments: updatedAttachments }));
      toast({ title: "Adjunto eliminado", description: "El archivo adjunto ha sido eliminado del almacenamiento." });
    } catch (error: any) {
      console.error("Error eliminando adjunto:", error);
      if (error.code === 'storage/object-not-found') {
        const updatedAttachments = currentAttachments.filter(att => att.url !== attachmentUrlToRemove);
        setCurrentAttachments(updatedAttachments);
        setFormData(prev => ({ ...prev, attachments: updatedAttachments }));
        toast({ title: "Adjunto eliminado localmente", description: "El archivo no se encontró en el almacenamiento, pero se eliminó la referencia." });
      } else {
        toast({ title: "Error al eliminar adjunto", description: error.message, variant: "destructive" });
      }
    }
  };


  const handleSubmit = async () => {
    if (!formData.title || !formData.description) {
      toast({title: "Error de Validación", description: "El título y la descripción son obligatorios.", variant: "destructive"});
      return;
    }
    const reporterId = (ticketToEdit && 'reporterUserId' in ticketToEdit && ticketToEdit.reporterUserId) ? ticketToEdit.reporterUserId : currentUser?.id;
    if (!reporterId) {
        toast({title: "Error de Autenticación", description: "No se pudo identificar al usuario reportador. Intenta recargar la página.", variant: "destructive"});
        return;
    }

    setIsUploading(true); 

    let finalAttachments = [...currentAttachments];
    const isEditingExistingTicket = ticketToEdit && 'id' in ticketToEdit && ticketToEdit.id;
    const ticketIdToUse = isEditingExistingTicket ? ticketToEdit.id : generateTicketId();

    if (selectedFile) {
      setUploadProgress(0);
      const filePath = `ticket-attachments/${reporterId}/${ticketIdToUse}/${Date.now()}-${selectedFile.name}`;
      const fileStorageRef = storageRef(storage, filePath);
      const uploadTask = uploadBytesResumable(fileStorageRef, selectedFile);

      try {
        await new Promise<void>((resolve, reject) => {
          uploadTask.on(
            "state_changed",
            (snapshot) => {
              const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
              setUploadProgress(progress);
            },
            (error) => {
              console.error("Error al subir archivo:", error);
              toast({ title: "Error al Subir Archivo", description: error.message, variant: "destructive" });
              reject(error);
            },
            async () => {
              const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
              finalAttachments.push({ name: selectedFile.name, url: downloadURL });
              setSelectedFile(null);
              resolve();
            }
          );
        });
      } catch (error) {
        setIsUploading(false);
        return; 
      }
    }

    const now = new Date().toISOString();
    const ticketDataToSave: Ticket = {
      id: ticketIdToUse!,
      title: formData.title!,
      description: formData.description!,
      status: formData.status || 'Abierto',
      priority: formData.priority || 'Media',
      createdAt: (ticketToEdit && 'createdAt' in ticketToEdit && ticketToEdit.createdAt) ? ticketToEdit.createdAt : now,
      updatedAt: now,
      reporterUserId: reporterId!,
      assigneeUserId: formData.assigneeUserId === NO_USER_SELECTED_VALUE ? undefined : formData.assigneeUserId,
      relatedLeadId: formData.relatedLeadId === NO_LEAD_SELECTED_VALUE ? undefined : formData.relatedLeadId,
      attachments: finalAttachments,
      comments: (ticketToEdit && 'comments' in ticketToEdit && ticketToEdit.comments) ? ticketToEdit.comments : [], 
      solutionDescription: formData.solutionDescription || "",
      solutionAttachments: formData.solutionAttachments || [],
      slaId: formData.slaId === NO_SLA_SELECTED_VALUE ? undefined : formData.slaId,
      queueId: formData.queueId === NO_QUEUE_SELECTED_VALUE ? undefined : formData.queueId,
    };
    
    await onSave(ticketDataToSave);
    setIsUploading(false);
    setIsOpen(false); 
  };
  
  let assigneeNameDisplay = "Selecciona un usuario (opcional)";
  if (formData.assigneeUserId) {
    const user = users.find(u => u.id === formData.assigneeUserId);
    if (user) {
      assigneeNameDisplay = user.name;
      if (currentUser && user.id === currentUser.id) {
        assigneeNameDisplay += " (Yo)";
      }
    } else if (formData.assigneeUserId !== NO_USER_SELECTED_VALUE) {
        assigneeNameDisplay = "Usuario no encontrado";
    }
  }

  const sortedUsers = users.slice().sort((a, b) => a.name.localeCompare(b.name));
  const canEditCoreFields = !ticketToEdit || !('id' in ticketToEdit) || isCreatorEditing || isAdminOrSupervisorEditing;


  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      {trigger && <DialogTrigger asChild>{trigger}</DialogTrigger>}
      <DialogContent className="sm:max-w-[520px]">
        <DialogHeader>
          <DialogTitle>{ticketToEdit && 'id' in ticketToEdit ? "Editar Ticket" : "Abrir Nuevo Ticket"}</DialogTitle>
          <DialogDescription>
            {ticketToEdit && 'id' in ticketToEdit ? "Actualiza los detalles de este ticket." : "Completa la información para el nuevo ticket."}
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4 max-h-[70vh] overflow-y-auto pr-2">
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor={`${dialogId}-title`} className="text-right">Título</Label>
            <Input id={`${dialogId}-title`} name="title" value={formData.title || ""} onChange={handleChange} className="col-span-3" disabled={isUploading || !canEditCoreFields} />
          </div>
          <div className="grid grid-cols-4 items-start gap-4">
            <Label htmlFor={`${dialogId}-description`} className="text-right pt-2">Descripción</Label>
            <Textarea id={`${dialogId}-description`} name="description" value={formData.description || ""} onChange={handleChange} className="col-span-3" rows={4} disabled={isUploading || !canEditCoreFields} />
          </div>
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor={`${dialogId}-status`} className="text-right">Estado</Label>
            <Select name="status" value={formData.status || 'Abierto'} onValueChange={(value) => handleSelectChange('status', value as TicketStatus)} disabled={isUploading || (!canEditCoreFields && ticketToEdit && 'status' in ticketToEdit && ticketToEdit.status !== 'Abierto' && ticketToEdit.status !== 'En Progreso') }
            >
              <SelectTrigger className="col-span-3">
                <SelectValue placeholder="Selecciona un estado" />
              </SelectTrigger>
              <SelectContent>
                {TICKET_STATUSES.map(status => (
                  <SelectItem key={status} value={status}>{status}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor={`${dialogId}-priority`} className="text-right">Prioridad</Label>
            <Select name="priority" value={formData.priority || 'Media'} onValueChange={(value) => handleSelectChange('priority', value as TicketPriority)} disabled={isUploading || !canEditCoreFields}>
              <SelectTrigger className="col-span-3">
                <SelectValue placeholder="Selecciona una prioridad" />
              </SelectTrigger>
              <SelectContent>
                {TICKET_PRIORITIES.map(priority => (
                  <SelectItem key={priority} value={priority}>{priority}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor={`${dialogId}-assigneeUserId`} className="text-right">Asignar a</Label>
             <Popover open={assigneePopoverOpen} onOpenChange={setAssigneePopoverOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  role="combobox"
                  aria-expanded={assigneePopoverOpen}
                  className="col-span-3 justify-between font-normal"
                  disabled={isUploading || !canEditCoreFields}
                >
                  {assigneeNameDisplay}
                  <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="p-0 w-[var(--radix-popover-trigger-width)]">
                <Command>
                  <CommandInput placeholder="Buscar usuario por nombre..." />
                   <CommandList>
                    <CommandEmpty>No se encontró usuario.</CommandEmpty>
                    <CommandGroup>
                      <CommandItem
                        key={NO_USER_SELECTED_VALUE}
                        value={NO_USER_SELECTED_VALUE}
                        onSelect={() => {
                          handleSelectChange('assigneeUserId', NO_USER_SELECTED_VALUE);
                          setAssigneePopoverOpen(false);
                        }}
                      >
                        <Check
                          className={cn(
                            "mr-2 h-4 w-4",
                             (formData.assigneeUserId === NO_USER_SELECTED_VALUE || !formData.assigneeUserId) ? "opacity-100" : "opacity-0"
                          )}
                        />
                        Sin asignar
                      </CommandItem>
                      {sortedUsers.map((user) => (
                        <CommandItem
                          key={user.id}
                          value={user.name} 
                          onSelect={(currentValue) => {
                            const selectedUserObj = sortedUsers.find(u => u.name.toLowerCase() === currentValue.toLowerCase());
                             if (selectedUserObj) {
                              handleSelectChange('assigneeUserId', selectedUserObj.id);
                            } else if (currentValue === NO_USER_SELECTED_VALUE) { 
                               handleSelectChange('assigneeUserId', NO_USER_SELECTED_VALUE);
                            }
                            setAssigneePopoverOpen(false);
                          }}
                        >
                          <Check
                            className={cn(
                              "mr-2 h-4 w-4",
                              formData.assigneeUserId === user.id ? "opacity-100" : "opacity-0"
                            )}
                          />
                          {user.name} {currentUser && user.id === currentUser.id ? "(Yo)" : ""}
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
          </div>
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor={`${dialogId}-relatedLeadId`} className="text-right">Lead Relacionado</Label>
            <Select
              name="relatedLeadId"
              value={formData.relatedLeadId || NO_LEAD_SELECTED_VALUE}
              onValueChange={(value) => handleSelectChange('relatedLeadId', value)}
              disabled={isUploading || !canEditCoreFields}
            >
              <SelectTrigger className="col-span-3">
                <SelectValue placeholder="Selecciona un lead (opcional)" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NO_LEAD_SELECTED_VALUE}>Ninguno</SelectItem>
                {leads.map((lead) => (
                  <SelectItem key={lead.id} value={lead.id}>
                    {lead.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor={`${dialogId}-queueId`} className="text-right flex items-center gap-1">
                <LayersIcon className="h-4 w-4 text-muted-foreground"/> Cola
            </Label>
            <Select
              name="queueId"
              value={formData.queueId || NO_QUEUE_SELECTED_VALUE}
              onValueChange={(value) => handleSelectChange('queueId', value)}
              disabled={isUploading || !canEditCoreFields || supportQueues.length === 0}
            >
              <SelectTrigger className="col-span-3">
                <SelectValue placeholder={supportQueues.length === 0 ? "No hay colas definidas" : "Selecciona una cola (opcional)"} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NO_QUEUE_SELECTED_VALUE}>Ninguna</SelectItem>
                {supportQueues.map((queue) => (
                  <SelectItem key={queue.id} value={queue.id}>
                    {queue.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor={`${dialogId}-slaId`} className="text-right flex items-center gap-1">
                 <ShieldCheck className="h-4 w-4 text-muted-foreground"/>SLA
            </Label>
            <Select
              name="slaId"
              value={formData.slaId || NO_SLA_SELECTED_VALUE}
              onValueChange={(value) => handleSelectChange('slaId', value)}
              disabled={isUploading || !canEditCoreFields || slas.length === 0}
            >
              <SelectTrigger className="col-span-3">
                <SelectValue placeholder={slas.length === 0 ? "No hay SLAs definidos" : "Selecciona un SLA (opcional)"} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NO_SLA_SELECTED_VALUE}>Ninguno</SelectItem>
                {slas.map((sla) => (
                  <SelectItem key={sla.id} value={sla.id}>
                    {sla.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>


          <div className="grid grid-cols-4 items-start gap-4">
            <Label htmlFor={`${dialogId}-attachments`} className="text-right pt-2">Adjuntos</Label>
            <div className="col-span-3 space-y-2">
              <Input 
                id={`${dialogId}-attachments-input`} 
                name="attachments-input" 
                type="file" 
                onChange={handleFileChange}
                className="mb-2"
                disabled={isUploading && uploadProgress > 0 && uploadProgress < 100 || !canEditCoreFields}
                accept="image/*,application/pdf,.doc,.docx,.txt,.csv,.xls,.xlsx,.zip,.rar" 
              />
              {isUploading && uploadProgress > 0 && uploadProgress < 100 && (
                <div className="space-y-1">
                  <Progress value={uploadProgress} className="w-full h-2" />
                  <p className="text-xs text-muted-foreground text-center">Subiendo archivo... {uploadProgress.toFixed(0)}%</p>
                </div>
              )}
              {selectedFile && !(isUploading && uploadProgress > 0 && uploadProgress < 100) && (
                <p className="text-xs text-muted-foreground">Archivo seleccionado: {selectedFile.name}</p>
              )}
              {currentAttachments && currentAttachments.length > 0 && (
                <div className="space-y-1">
                  <p className="text-xs font-medium">Archivos actuales:</p>
                  <ul className="list-disc list-inside space-y-1">
                    {currentAttachments.map((att, index) => (
                        <li key={index} className="text-xs flex items-center justify-between">
                          <a href={att.url} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline truncate max-w-[200px]" title={att.name}>
                            <Paperclip className="h-3 w-3 inline mr-1" />{att.name}
                          </a>
                          {canEditCoreFields && (
                            <Button variant="ghost" size="icon" className="h-5 w-5" onClick={() => handleRemoveAttachment(att.url)} title="Eliminar adjunto" disabled={isUploading}>
                                <X className="h-3 w-3 text-destructive"/>
                            </Button>
                          )}
                        </li>
                      ))}
                  </ul>
                </div>
              )}
            </div>
          </div>

          {ticketToEdit && 'id' in ticketToEdit && (ticketToEdit.solutionDescription || (ticketToEdit.solutionAttachments && ticketToEdit.solutionAttachments.length > 0)) && (
             <Card className="col-span-full mt-4 bg-muted/30">
                <CardHeaderUi className="pb-2">
                    <CardTitleUi className="text-base text-green-700">Información de la Solución</CardTitleUi>
                    <CardDescUi className="text-xs">Esta sección es gestionada por el asignado.</CardDescUi>
                </CardHeaderUi>
                <CardContent>
                    {ticketToEdit.solutionDescription && (
                        <>
                            <Label className="text-xs font-semibold">Descripción de la Solución:</Label>
                            <p className="text-sm whitespace-pre-wrap p-2 bg-background rounded-md">{ticketToEdit.solutionDescription}</p>
                        </>
                    )}
                    {ticketToEdit.solutionAttachments && ticketToEdit.solutionAttachments.length > 0 && (
                         <div className="mt-2">
                          <Label className="text-xs font-semibold">Adjuntos de la Solución:</Label>
                          <ul className="list-none space-y-0.5 text-sm mt-1">
                             {ticketToEdit.solutionAttachments.map((att, idx) => (
                                <li key={idx}>
                                  <a href={att.url} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline flex items-center gap-1 break-all" title={att.name}>
                                    <Paperclip className="h-3 w-3 shrink-0"/> {att.name}
                                  </a>
                                </li>
                             ))}
                          </ul>
                        </div>
                    )}
                </CardContent>
             </Card>
          )}


        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => setIsOpen(false)} disabled={isUploading}>Cancelar</Button>
          <Button type="submit" onClick={handleSubmit} disabled={isUploading || (!canEditCoreFields && !!(ticketToEdit && 'id' in ticketToEdit)) }>
            {isUploading ? (
              <>
                <UploadCloud className="mr-2 h-4 w-4 animate-pulse" /> 
                {uploadProgress > 0 && uploadProgress < 100 ? 'Subiendo...' : 'Guardando...'}
              </>
            ) : (ticketToEdit && 'id' in ticketToEdit ? "Guardar Cambios" : "Crear Ticket")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}




