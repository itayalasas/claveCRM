
"use client";

import { useState, useEffect, useId } from "react";
import { useForm, Controller, SubmitHandler } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import type { ActivityLog, Lead, Contact, Ticket, User, ActivityType, Opportunity, ActivityLogUserActivityType } from "@/lib/types";
import { ACTIVITY_LOG_USER_ACTIVITY_TYPES } from "@/lib/constants";
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
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CalendarIcon, Loader2 } from "lucide-react";
import { format, parseISO } from "date-fns";
import { es } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { ScrollArea } from "@/components/ui/scroll-area";

const NO_SELECTION_VALUE = "__NONE__";

const activityLogFormSchema = z.object({
  type: z.enum(ACTIVITY_LOG_USER_ACTIVITY_TYPES, { required_error: "El tipo de actividad es obligatorio."}),
  subject: z.string().optional(),
  details: z.string().min(1, "Los detalles son obligatorios."),
  timestampDate: z.date({ required_error: "La fecha es obligatoria." }),
  timestampTime: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/, "Formato de hora HH:MM inválido."),
  relatedLeadId: z.string().optional(),
  relatedContactId: z.string().optional(),
  relatedTicketId: z.string().optional(),
  relatedOpportunityId: z.string().optional(),
  durationMinutes: z.coerce.number().int().min(0).optional(),
  outcome: z.string().optional(),
});

type ActivityLogFormValues = z.infer<typeof activityLogFormSchema>;

interface AddEditActivityLogDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  activityToEdit?: ActivityLog | null;
  onSave: (data: Omit<ActivityLog, 'id' | 'createdAt' | 'loggedByUserId'>) => Promise<boolean>;
  leads: Lead[];
  contacts: Contact[];
  tickets: Ticket[];
  opportunities: Opportunity[]; // Add opportunities
  currentUser: User;
}

export function AddEditActivityLogDialog({
  isOpen,
  onOpenChange,
  activityToEdit,
  onSave,
  leads,
  contacts,
  tickets,
  opportunities,
  currentUser,
}: AddEditActivityLogDialogProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const dialogId = useId();

  const form = useForm<ActivityLogFormValues>({
    resolver: zodResolver(activityLogFormSchema),
    defaultValues: {
      type: "Nota",
      subject: "",
      details: "",
      timestampDate: new Date(),
      timestampTime: format(new Date(), "HH:mm"),
      relatedLeadId: NO_SELECTION_VALUE,
      relatedContactId: NO_SELECTION_VALUE,
      relatedTicketId: NO_SELECTION_VALUE,
      relatedOpportunityId: NO_SELECTION_VALUE,
      durationMinutes: 0,
      outcome: "",
    },
  });

  useEffect(() => {
    if (isOpen) {
      if (activityToEdit) {
        const activityDate = parseISO(activityToEdit.timestamp);
        form.reset({
          type: activityToEdit.type as ActivityLogUserActivityType,
          subject: activityToEdit.subject || "",
          details: activityToEdit.details,
          timestampDate: activityDate,
          timestampTime: format(activityDate, "HH:mm"),
          relatedLeadId: activityToEdit.relatedLeadId || NO_SELECTION_VALUE,
          relatedContactId: activityToEdit.relatedContactId || NO_SELECTION_VALUE,
          relatedTicketId: activityToEdit.relatedTicketId || NO_SELECTION_VALUE,
          relatedOpportunityId: activityToEdit.relatedOpportunityId || NO_SELECTION_VALUE,
          durationMinutes: activityToEdit.durationMinutes || 0,
          outcome: activityToEdit.outcome || "",
        });
      } else {
        form.reset({
          type: "Nota", subject: "", details: "",
          timestampDate: new Date(), timestampTime: format(new Date(), "HH:mm"),
          relatedLeadId: NO_SELECTION_VALUE, relatedContactId: NO_SELECTION_VALUE,
          relatedTicketId: NO_SELECTION_VALUE, relatedOpportunityId: NO_SELECTION_VALUE,
          durationMinutes: 0, outcome: "",
        });
      }
      setIsSubmitting(false);
    }
  }, [activityToEdit, isOpen, form]);

  const onSubmitHandler: SubmitHandler<ActivityLogFormValues> = async (data) => {
    setIsSubmitting(true);
    const [hours, minutes] = data.timestampTime.split(':').map(Number);
    const combinedTimestamp = new Date(data.timestampDate);
    combinedTimestamp.setHours(hours, minutes);

    const activityPayload = {
      type: data.type,
      subject: data.subject || null, // Ensure optional subject is null if empty
      details: data.details,
      timestamp: combinedTimestamp.toISOString(),
      relatedLeadId: data.relatedLeadId === NO_SELECTION_VALUE ? null : data.relatedLeadId,
      relatedContactId: data.relatedContactId === NO_SELECTION_VALUE ? null : data.relatedContactId,
      relatedTicketId: data.relatedTicketId === NO_SELECTION_VALUE ? null : data.relatedTicketId,
      relatedOpportunityId: data.relatedOpportunityId === NO_SELECTION_VALUE ? null : data.relatedOpportunityId,
      durationMinutes: data.durationMinutes || null, // Ensure optional number is null if 0 or undefined
      outcome: data.outcome || null, // Ensure optional outcome is null if empty
      category: 'user_activity' as const,
    };

    const success = await onSave(activityPayload as Omit<ActivityLog, 'id' | 'createdAt' | 'loggedByUserId'>);
    if (success) {
      onOpenChange(false);
    }
    setIsSubmitting(false);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{activityToEdit ? "Editar Actividad" : "Registrar Nueva Actividad"}</DialogTitle>
          <DialogDescription>
            {activityToEdit ? "Actualiza los detalles de esta actividad." : "Completa la información para registrar la actividad."}
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmitHandler)} className="space-y-4">
            <ScrollArea className="max-h-[60vh] p-1 pr-3">
              <div className="space-y-4">
                <FormField control={form.control} name="type" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Tipo de Actividad</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl><SelectTrigger><SelectValue placeholder="Selecciona un tipo" /></SelectTrigger></FormControl>
                      <SelectContent>{ACTIVITY_LOG_USER_ACTIVITY_TYPES.map(type => <SelectItem key={type} value={type}>{type}</SelectItem>)}</SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="subject" render={({ field }) => (
                  <FormItem><FormLabel>Asunto (Opcional)</FormLabel><FormControl><Input placeholder="Ej. Llamada de seguimiento" {...field} /></FormControl><FormMessage /></FormItem>
                )} />
                <FormField control={form.control} name="details" render={({ field }) => (
                  <FormItem><FormLabel>Detalles</FormLabel><FormControl><Textarea placeholder="Describe la actividad..." {...field} rows={4} /></FormControl><FormMessage /></FormItem>
                )} />
                <div className="grid grid-cols-2 gap-4">
                  <FormField control={form.control} name="timestampDate" render={({ field }) => (
                    <FormItem className="flex flex-col"><FormLabel>Fecha</FormLabel>
                      <Popover><PopoverTrigger asChild>
                          <FormControl><Button variant={"outline"} className={cn(!field.value && "text-muted-foreground")}>
                              {field.value ? format(field.value, "PPP", { locale: es }) : <span>Elige fecha</span>} <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                          </Button></FormControl>
                      </PopoverTrigger><PopoverContent className="w-auto p-0" align="start">
                          <Calendar mode="single" selected={field.value} onSelect={field.onChange} initialFocus />
                      </PopoverContent></Popover><FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="timestampTime" render={({ field }) => (
                    <FormItem><FormLabel>Hora</FormLabel><FormControl><Input type="time" {...field} /></FormControl><FormMessage /></FormItem>
                  )} />
                </div>
                
                <FormField control={form.control} name="relatedLeadId" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Lead Relacionado (Opcional)</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value || NO_SELECTION_VALUE}>
                      <FormControl><SelectTrigger><SelectValue placeholder="Selecciona un Lead" /></SelectTrigger></FormControl>
                      <SelectContent>
                        <SelectItem value={NO_SELECTION_VALUE}>Ninguno</SelectItem>
                        {leads.map(lead => <SelectItem key={lead.id} value={lead.id}>{lead.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="relatedContactId" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Contacto Relacionado (Opcional)</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value || NO_SELECTION_VALUE}>
                      <FormControl><SelectTrigger><SelectValue placeholder="Selecciona un Contacto" /></SelectTrigger></FormControl>
                      <SelectContent>
                        <SelectItem value={NO_SELECTION_VALUE}>Ninguno</SelectItem>
                        {contacts.map(contact => <SelectItem key={contact.id} value={contact.id}>{contact.firstName} {contact.lastName} ({contact.email})</SelectItem>)}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )} />
                 <FormField control={form.control} name="relatedTicketId" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Ticket Relacionado (Opcional)</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value || NO_SELECTION_VALUE}>
                      <FormControl><SelectTrigger><SelectValue placeholder="Selecciona un Ticket" /></SelectTrigger></FormControl>
                      <SelectContent>
                        <SelectItem value={NO_SELECTION_VALUE}>Ninguno</SelectItem>
                        {tickets.map(ticket => <SelectItem key={ticket.id} value={ticket.id}>{ticket.title} (ID: {ticket.id.substring(0,6)}...)</SelectItem>)}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="relatedOpportunityId" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Oportunidad Relacionada (Opcional)</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value || NO_SELECTION_VALUE} disabled={opportunities.length === 0}>
                      <FormControl><SelectTrigger><SelectValue placeholder={opportunities.length === 0 ? "No hay oportunidades" : "Selecciona una Oportunidad"} /></SelectTrigger></FormControl>
                      <SelectContent>
                        <SelectItem value={NO_SELECTION_VALUE}>Ninguna</SelectItem>
                        {opportunities.map(op => <SelectItem key={op.id} value={op.id}>{op.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                    {opportunities.length === 0 && <p className="text-xs text-muted-foreground">Aún no hay oportunidades creadas.</p>}
                    <FormMessage />
                  </FormItem>
                )} />
                
                <FormField control={form.control} name="durationMinutes" render={({ field }) => (
                  <FormItem><FormLabel>Duración (minutos, opcional)</FormLabel><FormControl><Input type="number" placeholder="Ej. 30" {...field} /></FormControl><FormMessage /></FormItem>
                )} />
                <FormField control={form.control} name="outcome" render={({ field }) => (
                  <FormItem><FormLabel>Resultado (Opcional)</FormLabel><FormControl><Input placeholder="Ej. Interesado, Necesita seguimiento" {...field} /></FormControl><FormMessage /></FormItem>
                )} />

              </div>
            </ScrollArea>
            <DialogFooter className="pt-4 border-t">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isSubmitting}>
                Cancelar
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                {activityToEdit ? "Guardar Cambios" : "Registrar Actividad"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

