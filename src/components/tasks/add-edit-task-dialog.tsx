"use client";

import { useState, useEffect, useId, useCallback } from "react";
import type { Task, Lead, User } from "@/lib/types";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Calendar } from "@/components/ui/calendar";
import { CalendarIcon, Check, ChevronsUpDown, Paperclip, UploadCloud, X, Repeat, Loader2 } from "lucide-react";
import { format, parseISO, isValid } from "date-fns";
import { es } from 'date-fns/locale'; 
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/auth-context";
import { storage, db } from "@/lib/firebase"; 
import { ref as storageRef, uploadBytesResumable, getDownloadURL, deleteObject } from "firebase/storage";
import { doc, collection } from "firebase/firestore";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";


interface AddEditTaskDialogProps {
  trigger: React.ReactNode;
  isOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  taskToEdit?: Task | null;
  leads: Lead[];
  users: User[]; 
  onSave: (task: Task) => Promise<void>; // Ensure onSave is Promise for async operations
  isSubmitting?: boolean; // To control loading state from parent
}

const defaultTaskBase: Omit<Task, 'id' | 'createdAt' | 'reporterUserId'> = {
  title: "",
  description: "",
  dueDate: undefined,
  completed: false,
  relatedLeadId: undefined,
  priority: 'medium',
  assigneeUserId: undefined,
  solutionDescription: "",
  attachments: [],
  isMonthlyRecurring: false,
};

const NO_LEAD_SELECTED_VALUE = "__no_lead_selected__";
const NO_USER_SELECTED_VALUE = "__no_user_selected__";

export function AddEditTaskDialog({ 
  trigger, 
  isOpen: controlledIsOpen, 
  onOpenChange: controlledOnOpenChange, 
  taskToEdit, 
  leads, 
  users, 
  onSave,
  isSubmitting = false, // Default to false
}: AddEditTaskDialogProps) {
  const [internalIsOpen, setInternalIsOpen] = useState(false);
  const isDialogOpen = controlledIsOpen !== undefined ? controlledIsOpen : internalIsOpen;
  const setIsDialogOpen = controlledOnOpenChange !== undefined ? controlledOnOpenChange : setInternalIsOpen;
  
  const { currentUser } = useAuth();
  const { toast } = useToast();
  const dialogId = useId(); 

  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isUploadingInternal, setIsUploadingInternal] = useState(false); // Internal upload state
  const [uploadProgress, setUploadProgress] = useState(0);

  const getInitialFormData = useCallback(() => {
    if (taskToEdit) {
      return {
        id: taskToEdit.id,
        createdAt: taskToEdit.createdAt,
        title: taskToEdit.title,
        description: taskToEdit.description || "",
        dueDate: taskToEdit.dueDate, 
        completed: taskToEdit.completed,
        relatedLeadId: taskToEdit.relatedLeadId || undefined,
        priority: taskToEdit.priority || 'medium',
        assigneeUserId: taskToEdit.assigneeUserId || undefined,
        reporterUserId: taskToEdit.reporterUserId,
        solutionDescription: taskToEdit.solutionDescription || "",
        attachments: taskToEdit.attachments || [],
        isMonthlyRecurring: taskToEdit.isMonthlyRecurring || false,
      };
    }
    return {
      ...defaultTaskBase,
      reporterUserId: currentUser?.id || "", 
      assigneeUserId: currentUser?.id || undefined, 
    };
  }, [taskToEdit, currentUser]);
  
  const [formData, setFormData] = useState<Partial<Task>>(getInitialFormData());
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(
    taskToEdit && taskToEdit.dueDate && isValid(parseISO(taskToEdit.dueDate)) ? parseISO(taskToEdit.dueDate) : undefined
  );
  const [assigneePopoverOpen, setAssigneePopoverOpen] = useState(false);


  useEffect(() => {
    if (isDialogOpen) {
      const initialData = getInitialFormData();
      setFormData(initialData);
      setSelectedDate(initialData.dueDate && isValid(parseISO(initialData.dueDate)) ? parseISO(initialData.dueDate) : undefined);
      setSelectedFile(null);
      setIsUploadingInternal(false);
      setUploadProgress(0);
    }
  }, [isDialogOpen, getInitialFormData]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleCheckboxChange = (name: 'isMonthlyRecurring', checked: boolean) => {
    setFormData((prev) => ({ ...prev, [name]: checked }));
  };

  const handleSelectChange = (name: 'relatedLeadId' | 'priority' | 'assigneeUserId', value: string) => {
    if (name === 'relatedLeadId') {
      setFormData((prev) => ({ ...prev, relatedLeadId: value === NO_LEAD_SELECTED_VALUE ? undefined : value }));
    } else if (name === 'assigneeUserId') {
      setFormData((prev) => ({ ...prev, assigneeUserId: value === NO_USER_SELECTED_VALUE ? undefined : value }));
    } else {
      setFormData((prev) => ({ ...prev, [name]: value as Task['priority'] }));
    }
  };

  const handleDateChange = (date: Date | undefined) => {
    setSelectedDate(date);
    setFormData((prev) => ({ ...prev, dueDate: date ? date.toISOString() : undefined }));
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files && event.target.files[0]) {
      setSelectedFile(event.target.files[0]);
    } else {
      setSelectedFile(null);
    }
  };

  const handleRemoveAttachment = async (attachmentToRemove: { name: string, url: string }) => {
    if (!window.confirm(`¿Estás seguro de que quieres eliminar el adjunto "${attachmentToRemove.name}"?`)) return;
    
    try {
      const fileRef = storageRef(storage, attachmentToRemove.url); 
      await deleteObject(fileRef);
      setFormData(prev => ({
        ...prev,
        attachments: prev.attachments?.filter(att => att.url !== attachmentToRemove.url) || []
      }));
      toast({ title: "Adjunto eliminado", description: "El archivo adjunto ha sido eliminado." });
    } catch (error: any) {
      console.error("Error eliminando adjunto:", error);
      if (error.code === 'storage/object-not-found') {
         setFormData(prev => ({
            ...prev,
            attachments: prev.attachments?.filter(att => att.url !== attachmentToRemove.url) || []
          }));
        toast({ title: "Adjunto eliminado localmente", description: "El archivo no se encontró en el almacenamiento, pero se eliminó la referencia." });
      } else {
        toast({ title: "Error al eliminar adjunto", description: error.message, variant: "destructive" });
      }
    }
  };

  const handleSubmit = async () => {
    if (!formData.title) {
      toast({ title: "Error de validación", description: "El título es obligatorio.", variant: "destructive" });
      return;
    }
    if (!currentUser?.id && !taskToEdit) {
      toast({ title: "Error de autenticación", description: "No se pudo identificar al usuario. Intenta recargar la página.", variant: "destructive" });
      return;
    }

    let taskAttachments = formData.attachments || [];
    const taskId = taskToEdit ? taskToEdit.id : doc(collection(db, "tasks")).id;

    if (selectedFile) {
      setIsUploadingInternal(true);
      setUploadProgress(0);
      const filePath = `task-attachments/${currentUser!.id}/${taskId}/${Date.now()}-${selectedFile.name}`;
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
              setIsUploadingInternal(false);
              reject(error);
            },
            async () => {
              const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
              taskAttachments = [...taskAttachments, { name: selectedFile.name, url: downloadURL }]; 
              setIsUploadingInternal(false);
              setSelectedFile(null); 
              resolve();
            }
          );
        });
      } catch (error) {
        return; 
      }
    }

    const taskToSave: Task = {
      id: taskId,
      createdAt: taskToEdit ? taskToEdit.createdAt : new Date().toISOString(),
      title: formData.title!,
      description: formData.description || "",
      dueDate: formData.dueDate,
      completed: formData.completed || false,
      relatedLeadId: formData.relatedLeadId === NO_LEAD_SELECTED_VALUE ? undefined : formData.relatedLeadId,
      priority: formData.priority || 'medium',
      assigneeUserId: formData.assigneeUserId === NO_USER_SELECTED_VALUE ? undefined : formData.assigneeUserId,
      reporterUserId: taskToEdit ? formData.reporterUserId! : currentUser!.id,
      solutionDescription: formData.solutionDescription || "",
      attachments: taskAttachments,
      isMonthlyRecurring: formData.isMonthlyRecurring || false,
    };

    await onSave(taskToSave); // onSave is now async
    // Dialog closing should be handled by the parent component after onSave promise resolves
  };

  let assigneeNameDisplay = "Selecciona un usuario (opcional)";
  if (formData.assigneeUserId && formData.assigneeUserId !== NO_USER_SELECTED_VALUE) {
    const user = users.find(u => u.id === formData.assigneeUserId);
    if (user) {
      assigneeNameDisplay = user.name;
      if (currentUser && user.id === currentUser.id) {
        assigneeNameDisplay += " (Yo)";
      }
    } else {
        assigneeNameDisplay = "Usuario no encontrado";
    }
  }

  const sortedUsers = users.slice().sort((a, b) => a.name.localeCompare(b.name));
  const finalIsSubmitting = isSubmitting || isUploadingInternal;

  return (
    <Dialog open={isDialogOpen} onOpenChange={(open) => { if (!finalIsSubmitting) setIsDialogOpen(open);}}>
      <DialogTrigger asChild onClick={() => !isDialogOpen && setIsDialogOpen(true)}>{trigger}</DialogTrigger>
      <DialogContent className="sm:max-w-[520px]">
        <DialogHeader>
          <DialogTitle>{taskToEdit ? "Editar Tarea" : "Añadir Nueva Tarea"}</DialogTitle>
          <DialogDescription>
            {taskToEdit ? "Actualiza los detalles de esta tarea." : "Completa la información para la nueva tarea."}
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4 max-h-[70vh] overflow-y-auto pr-2">
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor={`${dialogId}-title`} className="text-right">Título</Label>
            <Input id={`${dialogId}-title`} name="title" value={formData.title || ""} onChange={handleChange} className="col-span-3" disabled={finalIsSubmitting} />
          </div>
          <div className="grid grid-cols-4 items-start gap-4">
            <Label htmlFor={`${dialogId}-description`} className="text-right pt-2">Descripción</Label>
            <Textarea id={`${dialogId}-description`} name="description" value={formData.description || ""} onChange={handleChange} className="col-span-3" rows={3} disabled={finalIsSubmitting} />
          </div>
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor={`${dialogId}-dueDate`} className="text-right">Fecha de Vencimiento</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant={"outline"}
                  className={cn(
                    "col-span-3 justify-start text-left font-normal",
                    !selectedDate && "text-muted-foreground"
                  )}
                  disabled={finalIsSubmitting}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {selectedDate ? format(selectedDate, "PPP", { locale: es }) : <span>Elige una fecha</span>}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  locale={es}
                  mode="single"
                  selected={selectedDate}
                  onSelect={handleDateChange}
                  initialFocus
                />
              </PopoverContent>
            </Popover>
          </div>
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor={`${dialogId}-priority`} className="text-right">Prioridad</Label>
            <Select name="priority" value={formData.priority || 'medium'} onValueChange={(value) => handleSelectChange('priority', value)} disabled={finalIsSubmitting}>
              <SelectTrigger className="col-span-3" id={`${dialogId}-priority`}>
                <SelectValue placeholder="Selecciona prioridad" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="low">Baja</SelectItem>
                <SelectItem value="medium">Media</SelectItem>
                <SelectItem value="high">Alta</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor={`${dialogId}-assigneeUserId-button`} className="text-right">Asignar a</Label>
            <Popover open={assigneePopoverOpen} onOpenChange={setAssigneePopoverOpen}>
              <PopoverTrigger asChild>
                <Button
                  id={`${dialogId}-assigneeUserId-button`}
                  variant="outline"
                  role="combobox"
                  aria-expanded={assigneePopoverOpen}
                  className="col-span-3 justify-between font-normal"
                  disabled={finalIsSubmitting}
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
              disabled={finalIsSubmitting}
            >
              <SelectTrigger className="col-span-3" id={`${dialogId}-relatedLeadId`}>
                <SelectValue placeholder="Selecciona un lead (opcional)" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NO_LEAD_SELECTED_VALUE}>Ninguno</SelectItem>
                {leads.map((lead) => (
                  <SelectItem key={lead.id} value={lead.id}>
                    {lead.name} ({lead.company || 'N/A'})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          
          <div className="grid grid-cols-4 items-start gap-4">
            <Label htmlFor={`${dialogId}-solutionDescription`} className="text-right pt-2">Descripción de la Solución</Label>
            <Textarea id={`${dialogId}-solutionDescription`} name="solutionDescription" value={formData.solutionDescription || ""} onChange={handleChange} className="col-span-3" rows={3} placeholder="Detalla la solución aplicada a esta tarea..." disabled={finalIsSubmitting} />
          </div>

          <div className="grid grid-cols-4 items-start gap-4">
            <Label htmlFor={`${dialogId}-attachments-input`} className="text-right pt-2">Adjuntos</Label>
            <div className="col-span-3 space-y-2">
              <Input 
                id={`${dialogId}-attachments-input`} 
                name="attachments-input" 
                type="file" 
                onChange={handleFileChange}
                className="mb-2"
                disabled={finalIsSubmitting}
                accept="image/*,application/pdf,.doc,.docx,.txt,.csv,.xls,.xlsx" 
              />
              {isUploadingInternal && (
                <div className="space-y-1">
                  <Progress value={uploadProgress} className="w-full h-2" />
                  <p className="text-xs text-muted-foreground text-center">Subiendo archivo... {uploadProgress.toFixed(0)}%</p>
                </div>
              )}
              {selectedFile && !isUploadingInternal && (
                <p className="text-xs text-muted-foreground">Archivo seleccionado: {selectedFile.name}</p>
              )}
              {formData.attachments && formData.attachments.length > 0 && (
                <div className="space-y-1">
                  <p className="text-xs font-medium">Archivos actuales:</p>
                  <ul className="list-disc list-inside space-y-1">
                    {formData.attachments.map((att, index) => (
                        <li key={index} className="text-xs flex items-center justify-between">
                          <a href={att.url} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline truncate max-w-[200px]" title={att.name}>
                            <Paperclip className="h-3 w-3 inline mr-1" />{att.name}
                          </a>
                          {!finalIsSubmitting && (
                             <Button variant="ghost" size="icon" className="h-5 w-5" onClick={() => handleRemoveAttachment(att)} title="Eliminar adjunto">
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
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor={`${dialogId}-isMonthlyRecurring`} className="text-right">Tarea Recurrente</Label>
            <div className="col-span-3 flex items-center space-x-2">
              <Checkbox
                id={`${dialogId}-isMonthlyRecurring`}
                checked={formData.isMonthlyRecurring || false}
                onCheckedChange={(checked) => handleCheckboxChange('isMonthlyRecurring', Boolean(checked))}
                disabled={finalIsSubmitting || (!!taskToEdit && taskToEdit.completed)} 
              />
              <label
                htmlFor={`${dialogId}-isMonthlyRecurring`}
                className="text-sm font-normal text-muted-foreground leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
              >
                Mensual (se recreará al completarse)
              </label>
            </div>
          </div>
           {taskToEdit && taskToEdit.completed && taskToEdit.isMonthlyRecurring && (
            <div className="col-start-2 col-span-3">
                <p className="text-xs text-muted-foreground">La recurrencia de tareas completadas se gestiona automáticamente.</p>
            </div>
           )}
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)} disabled={finalIsSubmitting}>Cancelar</Button>
          <Button type="submit" onClick={handleSubmit} disabled={finalIsSubmitting}>
            {finalIsSubmitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" /> 
                {isUploadingInternal ? 'Subiendo...' : 'Guardando...'}
              </>
            ) : (taskToEdit ? "Guardar Cambios" : "Crear Tarea")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
