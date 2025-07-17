
"use client";

import { useState, useEffect, useId } from "react";
import { useForm, Controller, useFieldArray, SubmitHandler } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import type { Meeting, Lead, User, Contact, MeetingAttendee, MeetingStatus, Resource } from "@/lib/types";
import { MEETING_STATUSES, INITIAL_RESOURCES } from "@/lib/constants";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CalendarIcon, Loader2, PlusCircle, Trash2, Users as UsersIcon, UserPlus, Briefcase } from "lucide-react";
import { format, parseISO, isValid, setHours, setMinutes } from "date-fns";
import { es } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Card } from "@/components/ui/card";

const NO_SELECTION_VALUE = "__NONE__"; 

const attendeeSchema = z.object({
  id: z.string().min(1), 
  type: z.enum(["user", "contact", "external"]),
  name: z.string().min(1, "El nombre del asistente es requerido."),
  email: z.string().email("Email inválido."),
  status: z.enum(["Aceptada", "Rechazada", "Pendiente", "Tentativa"]).default("Pendiente"),
});

const meetingFormSchema = z.object({
  title: z.string().min(1, "El título de la reunión es obligatorio."),
  description: z.string().optional(),
  startDate: z.date({ required_error: "La fecha de inicio es obligatoria." }),
  startTime: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/, "Formato de hora HH:MM inválido."),
  endDate: z.date({ required_error: "La fecha de fin es obligatoria." }),
  endTime: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/, "Formato de hora HH:MM inválido."),
  attendees: z.array(attendeeSchema).min(0),
  location: z.string().optional(),
  conferenceLink: z.string().url("Enlace de conferencia inválido.").optional().or(z.literal('')),
  relatedLeadId: z.string().optional(), 
  status: z.enum(MEETING_STATUSES as [string, ...string[]], { errorMap: () => ({ message: "Estado inválido."}) }),
  resourceId: z.string().optional(),
}).refine(data => {
    const startDateTime = setMinutes(setHours(data.startDate, parseInt(data.startTime.split(':')[0])), parseInt(data.startTime.split(':')[1]));
    const endDateTime = setMinutes(setHours(data.endDate, parseInt(data.endTime.split(':')[0])), parseInt(data.endTime.split(':')[1]));
    return endDateTime > startDateTime;
}, {
    message: "La fecha/hora de fin debe ser posterior a la de inicio.",
    path: ["endDate"], 
});

type MeetingFormValues = z.infer<typeof meetingFormSchema>;

interface AddEditMeetingDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  meetingToEdit?: Meeting | null;
  onSave: (data: Omit<Meeting, 'id' | 'createdAt' | 'createdByUserId'>, id?: string) => Promise<boolean>;
  leads: Lead[];
  contacts: Contact[];
  users: User[];
  resources: Resource[];
  currentUser: User | null;
}

export function AddEditMeetingDialog({
  isOpen,
  onOpenChange,
  meetingToEdit,
  onSave,
  leads,
  contacts,
  users,
  resources,
  currentUser,
}: AddEditMeetingDialogProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();
  const dialogId = useId();

  const form = useForm<MeetingFormValues>({
    resolver: zodResolver(meetingFormSchema),
    defaultValues: {
      title: "",
      description: "",
      startDate: new Date(),
      startTime: format(new Date(), "HH:mm"),
      endDate: new Date(),
      endTime: format(new Date(new Date().getTime() + 60 * 60 * 1000), "HH:mm"), 
      attendees: [],
      location: "",
      conferenceLink: "",
      relatedLeadId: NO_SELECTION_VALUE,
      status: "Programada",
      resourceId: NO_SELECTION_VALUE,
    },
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "attendees",
  });

  useEffect(() => {
    if (isOpen) {
      if (meetingToEdit) {
        const startDate = parseISO(meetingToEdit.startTime);
        const endDate = parseISO(meetingToEdit.endTime);
        form.reset({
          title: meetingToEdit.title,
          description: meetingToEdit.description || "",
          startDate: startDate,
          startTime: format(startDate, "HH:mm"),
          endDate: endDate,
          endTime: format(endDate, "HH:mm"),
          attendees: meetingToEdit.attendees.map(att => ({...att, id: att.id || `ext-${Math.random()}`})),
          location: meetingToEdit.location || "",
          conferenceLink: meetingToEdit.conferenceLink || "",
          relatedLeadId: meetingToEdit.relatedLeadId || NO_SELECTION_VALUE,
          status: meetingToEdit.status,
          resourceId: meetingToEdit.resourceId || NO_SELECTION_VALUE,
        });
      } else {
        const now = new Date();
        const oneHourLater = new Date(now.getTime() + 60 * 60 * 1000);
        form.reset({
          title: "", description: "",
          startDate: now, startTime: format(now, "HH:mm"),
          endDate: oneHourLater, endTime: format(oneHourLater, "HH:mm"),
          attendees: currentUser ? [{ id: currentUser.id, type: 'user', name: currentUser.name, email: currentUser.email, status: 'Aceptada' }] : [],
          location: "", conferenceLink: "", 
          relatedLeadId: NO_SELECTION_VALUE, 
          status: "Programada",
          resourceId: NO_SELECTION_VALUE,
        });
      }
      setIsSubmitting(false);
    }
  }, [meetingToEdit, isOpen, form, currentUser]);

  const onSubmitHandler: SubmitHandler<MeetingFormValues> = async (data) => {
    setIsSubmitting(true);
    const startDateTime = setMinutes(setHours(data.startDate, parseInt(data.startTime.split(':')[0])), parseInt(data.startTime.split(':')[1]));
    const endDateTime = setMinutes(setHours(data.endDate, parseInt(data.endTime.split(':')[0])), parseInt(data.endTime.split(':')[1]));

    const meetingPayload = {
      title: data.title,
      description: data.description,
      startTime: startDateTime.toISOString(),
      endTime: endDateTime.toISOString(),
      attendees: data.attendees,
      location: data.location,
      conferenceLink: data.conferenceLink,
      relatedLeadId: data.relatedLeadId === NO_SELECTION_VALUE ? undefined : data.relatedLeadId,
      status: data.status,
      resourceId: data.resourceId === NO_SELECTION_VALUE ? undefined : data.resourceId,
    };

    const success = await onSave(meetingPayload, meetingToEdit?.id);
    if (success) {
      onOpenChange(false);
    }
    setIsSubmitting(false);
  };

  const addExternalAttendee = () => {
    append({ id: `external-${Date.now()}`, type: 'external', name: "", email: "", status: "Pendiente" });
  };
  
  const addInternalAttendee = (type: 'user' | 'contact', selectedId: string) => {
    const existing = form.getValues("attendees").find(att => att.id === selectedId && att.type === type);
    if (existing) {
      toast({ title: "Asistente ya añadido", variant: "default" });
      return;
    }

    if (type === 'user') {
      const user = users.find(u => u.id === selectedId);
      if (user) append({ id: user.id, type: 'user', name: user.name, email: user.email, status: "Pendiente" });
    } else if (type === 'contact') {
      const contact = contacts.find(c => c.id === selectedId);
      if (contact) append({ id: contact.id, type: 'contact', name: `${contact.firstName || ''} ${contact.lastName || ''}`.trim() || contact.email, email: contact.email, status: "Pendiente" });
    }
  };


  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{meetingToEdit ? "Editar Reunión" : "Nueva Reunión"}</DialogTitle>
          <DialogDescription>
            {meetingToEdit ? "Actualiza los detalles de esta reunión." : "Programa una nueva reunión y gestiona los asistentes."}
             Las invitaciones (.ics) y recordatorios se enviarán automáticamente (procesado por backend).
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmitHandler)} className="space-y-4">
            <ScrollArea className="max-h-[60vh] p-1 pr-3">
              <div className="space-y-4">
                <FormField control={form.control} name="title" render={({ field }) => (
                  <FormItem><FormLabel>Título</FormLabel><FormControl><Input placeholder="Ej. Reunión de seguimiento con Cliente X" {...field} /></FormControl><FormMessage /></FormItem>
                )} />
                <FormField control={form.control} name="description" render={({ field }) => (
                  <FormItem><FormLabel>Descripción (Opcional)</FormLabel><FormControl><Textarea placeholder="Temas a tratar, objetivos..." {...field} rows={3} /></FormControl><FormMessage /></FormItem>
                )} />
                
                <div className="grid grid-cols-2 gap-4">
                  <FormField control={form.control} name="startDate" render={({ field }) => (
                    <FormItem className="flex flex-col"><FormLabel>Fecha de Inicio</FormLabel>
                      <Popover><PopoverTrigger asChild>
                          <FormControl><Button variant={"outline"} className={cn(!field.value && "text-muted-foreground")}>
                              {field.value ? format(field.value, "PPP", { locale: es }) : <span>Elige una fecha</span>} <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                          </Button></FormControl>
                      </PopoverTrigger><PopoverContent className="w-auto p-0" align="start">
                          <Calendar mode="single" selected={field.value} onSelect={field.onChange} initialFocus />
                      </PopoverContent></Popover><FormMessage />
                    </FormItem>
                  )} />
                   <FormField control={form.control} name="startTime" render={({ field }) => (
                    <FormItem><FormLabel>Hora de Inicio</FormLabel><FormControl><Input type="time" {...field} /></FormControl><FormMessage /></FormItem>
                  )} />
                </div>
                <div className="grid grid-cols-2 gap-4">
                   <FormField control={form.control} name="endDate" render={({ field }) => (
                    <FormItem className="flex flex-col"><FormLabel>Fecha de Fin</FormLabel>
                      <Popover><PopoverTrigger asChild>
                          <FormControl><Button variant={"outline"} className={cn(!field.value && "text-muted-foreground")}>
                              {field.value ? format(field.value, "PPP", { locale: es }) : <span>Elige una fecha</span>} <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                          </Button></FormControl>
                      </PopoverTrigger><PopoverContent className="w-auto p-0" align="start">
                          <Calendar mode="single" selected={field.value} onSelect={field.onChange} initialFocus />
                      </PopoverContent></Popover><FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="endTime" render={({ field }) => (
                    <FormItem><FormLabel>Hora de Fin</FormLabel><FormControl><Input type="time" {...field} /></FormControl><FormMessage /></FormItem>
                  )} />
                </div>

                <FormField control={form.control} name="location" render={({ field }) => (
                  <FormItem><FormLabel>Ubicación (Opcional)</FormLabel><FormControl><Input placeholder="Ej. Oficina central, Sala de Juntas A" {...field} /></FormControl><FormMessage /></FormItem>
                )} />
                <FormField control={form.control} name="conferenceLink" render={({ field }) => (
                  <FormItem><FormLabel>Enlace de Videoconferencia (Opcional)</FormLabel><FormControl><Input type="url" placeholder="Ej. https://meet.google.com/..." {...field} /></FormControl><FormMessage /></FormItem>
                )} />
                
                <FormField control={form.control} name="resourceId" render={({ field }) => (
                  <FormItem>
                    <FormLabel className="flex items-center gap-1">
                      <Briefcase className="h-4 w-4 text-muted-foreground" />
                      Recurso/Sala (Opcional)
                    </FormLabel>
                    <Select 
                      onValueChange={(value) => field.onChange(value === NO_SELECTION_VALUE ? undefined : value)} 
                      value={field.value || NO_SELECTION_VALUE}
                    >
                      <FormControl><SelectTrigger><SelectValue placeholder="Selecciona un recurso" /></SelectTrigger></FormControl>
                      <SelectContent>
                        <SelectItem value={NO_SELECTION_VALUE}>Ninguno</SelectItem>
                        {resources.map(resource => (
                          <SelectItem key={resource.id} value={resource.id}>
                            {resource.name} ({resource.type})
                            {resource.location && ` - ${resource.location}`}
                            {typeof resource.capacity === 'number' && ` (Cap: ${resource.capacity})`}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormDescription className="text-xs">La gestión de disponibilidad de recursos está en desarrollo.</FormDescription>
                    <FormMessage />
                  </FormItem>
                )} />

                <FormField control={form.control} name="relatedLeadId" render={({ field }) => (
                  <FormItem><FormLabel>Lead Relacionado (Opcional)</FormLabel>
                    <Select 
                      onValueChange={(value) => field.onChange(value === NO_SELECTION_VALUE ? undefined : value)} 
                      value={field.value || NO_SELECTION_VALUE}
                    >
                      <FormControl><SelectTrigger><SelectValue placeholder="Selecciona un lead" /></SelectTrigger></FormControl>
                      <SelectContent>
                        <SelectItem value={NO_SELECTION_VALUE}>Ninguno</SelectItem>
                        {leads.map(lead => <SelectItem key={lead.id} value={lead.id}>{lead.name}</SelectItem>)}
                      </SelectContent>
                    </Select><FormMessage />
                  </FormItem>
                )} />
                 <FormField control={form.control} name="status" render={({ field }) => (
                  <FormItem><FormLabel>Estado de la Reunión</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl><SelectTrigger><SelectValue placeholder="Selecciona un estado" /></SelectTrigger></FormControl>
                      <SelectContent>{MEETING_STATUSES.map(status => <SelectItem key={status} value={status}>{status}</SelectItem>)}</SelectContent>
                    </Select><FormMessage />
                  </FormItem>
                )} />

                {/* Attendee Management UI */}
                <div className="space-y-3 pt-3 border-t">
                  <FormLabel className="text-md">Asistentes</FormLabel>
                  {fields.map((item, index) => (
                    <Card key={item.id} className="p-3 space-y-2 bg-muted/50">
                      <div className="flex justify-between items-center mb-2">
                        <span className="text-sm font-medium">Asistente {index + 1} ({item.type === 'user' ? 'Usuario CRM' : item.type === 'contact' ? 'Contacto CRM' : 'Externo'})</span>
                        <Button type="button" variant="ghost" size="icon" onClick={() => remove(index)} className="text-destructive h-7 w-7">
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                       <FormField control={form.control} name={`attendees.${index}.name`} render={({ field }) => (
                        <FormItem><FormLabel className="text-xs">Nombre</FormLabel><FormControl><Input {...field} disabled={item.type !== 'external'} /></FormControl><FormMessage /></FormItem>
                      )} />
                      <FormField control={form.control} name={`attendees.${index}.email`} render={({ field }) => (
                        <FormItem><FormLabel className="text-xs">Email</FormLabel><FormControl><Input type="email" {...field} disabled={item.type !== 'external'} /></FormControl><FormMessage /></FormItem>
                      )} />
                      <FormField control={form.control} name={`attendees.${index}.status`} render={({ field }) => (
                          <FormItem><FormLabel className="text-xs">Estado Asistencia</FormLabel>
                            <Select onValueChange={field.onChange} defaultValue={field.value}>
                              <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                              <SelectContent>
                                <SelectItem value="Pendiente">Pendiente</SelectItem>
                                <SelectItem value="Aceptada">Aceptada</SelectItem>
                                <SelectItem value="Rechazada">Rechazada</SelectItem>
                                <SelectItem value="Tentativa">Tentativa</SelectItem>
                              </SelectContent>
                            </Select><FormMessage />
                          </FormItem>
                        )} />
                    </Card>
                  ))}
                  <div className="flex flex-col sm:flex-row gap-2 mt-2">
                    <Select onValueChange={(value) => addInternalAttendee('user', value)}>
                        <SelectTrigger className="flex-1"><SelectValue placeholder="Añadir Usuario CRM..." /></SelectTrigger>
                        <SelectContent>
                            {users.filter(u => !fields.some(f => f.id === u.id && f.type === 'user')).map(user => <SelectItem key={user.id} value={user.id}>{user.name} ({user.email})</SelectItem>)}
                            {users.filter(u => !fields.some(f => f.id === u.id && f.type === 'user')).length === 0 && <div className="px-2 py-1.5 text-xs text-muted-foreground">Todos los usuarios añadidos.</div>}
                        </SelectContent>
                    </Select>
                     <Select onValueChange={(value) => addInternalAttendee('contact', value)}>
                        <SelectTrigger className="flex-1"><SelectValue placeholder="Añadir Contacto CRM..." /></SelectTrigger>
                        <SelectContent>
                            {contacts.filter(c => !fields.some(f => f.id === c.id && f.type === 'contact')).map(contact => <SelectItem key={contact.id} value={contact.id}>{`${contact.firstName || ''} ${contact.lastName || ''} (${contact.email})`.trim()}</SelectItem>)}
                            {contacts.filter(c => !fields.some(f => f.id === c.id && f.type === 'contact')).length === 0 && <div className="px-2 py-1.5 text-xs text-muted-foreground">Todos los contactos añadidos.</div>}
                        </SelectContent>
                    </Select>
                  </div>
                  <Button type="button" variant="outline" size="sm" onClick={addExternalAttendee} className="mt-2 w-full sm:w-auto">
                    <UserPlus className="mr-2 h-4 w-4" /> Añadir Asistente Externo Manualmente
                  </Button>
                </div>
              </div>
            </ScrollArea>
            <DialogFooter className="pt-4 border-t">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isSubmitting}>
                Cancelar
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                {isSubmitting ? "Guardando..." : (meetingToEdit ? "Guardar Cambios" : "Crear Reunión")}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}


    