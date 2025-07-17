
"use client";

import { useState, useEffect } from "react";
import { useForm, Controller, SubmitHandler } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import type { SLA, TicketPriority } from "@/lib/types";
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
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription as FormDescUi } from "@/components/ui/form";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { Loader2 } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";

const slaFormSchema = z.object({
  name: z.string().min(1, "El nombre del SLA es obligatorio."),
  description: z.string().optional(),
  responseTimeTargetMinutes: z.coerce.number().int().positive("El tiempo de respuesta debe ser positivo."),
  resolutionTimeTargetHours: z.coerce.number().int().positive("El tiempo de resolución debe ser positivo."),
  appliesToPriority: z.array(z.string()).optional(), // Store as array of priority strings
  businessHoursOnly: z.boolean().default(false),
  isEnabled: z.boolean().default(true),
  // appliesToQueues and escalationRuleIds will be handled separately or later
});

type SlaFormValues = z.infer<typeof slaFormSchema>;

interface AddEditSlaDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  slaToEdit?: SLA | null;
  onSave: (data: Omit<SLA, 'id' | 'createdAt' | 'updatedAt'>, id?:string) => Promise<boolean>;
  ticketPriorities: TicketPriority[];
}

export function AddEditSlaDialog({
  isOpen,
  onOpenChange,
  slaToEdit,
  onSave,
  ticketPriorities
}: AddEditSlaDialogProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useForm<SlaFormValues>({
    resolver: zodResolver(slaFormSchema),
    defaultValues: {
      name: "",
      description: "",
      responseTimeTargetMinutes: 60,
      resolutionTimeTargetHours: 8,
      appliesToPriority: [],
      businessHoursOnly: false,
      isEnabled: true,
    },
  });

  useEffect(() => {
    if (isOpen) {
      if (slaToEdit) {
        form.reset({
          name: slaToEdit.name,
          description: slaToEdit.description || "",
          responseTimeTargetMinutes: slaToEdit.responseTimeTargetMinutes,
          resolutionTimeTargetHours: slaToEdit.resolutionTimeTargetHours,
          appliesToPriority: slaToEdit.appliesToPriority || [],
          businessHoursOnly: slaToEdit.businessHoursOnly || false,
          isEnabled: slaToEdit.isEnabled === undefined ? true : slaToEdit.isEnabled,
        });
      } else {
        form.reset({
          name: "", description: "", responseTimeTargetMinutes: 60, resolutionTimeTargetHours: 8,
          appliesToPriority: [], businessHoursOnly: false, isEnabled: true,
        });
      }
      setIsSubmitting(false);
    }
  }, [slaToEdit, isOpen, form]);

  const onSubmitHandler: SubmitHandler<SlaFormValues> = async (data) => {
    setIsSubmitting(true);
    const payload = {
        ...data,
        appliesToPriority: data.appliesToPriority as TicketPriority[] // Ensure correct type
    }
    const success = await onSave(payload, slaToEdit?.id);
    if (success) {
      onOpenChange(false);
    }
    setIsSubmitting(false);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{slaToEdit ? "Editar SLA" : "Nuevo SLA"}</DialogTitle>
          <DialogDescription>
            {slaToEdit ? "Actualiza los detalles de este SLA." : "Define un nuevo Acuerdo de Nivel de Servicio."}
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmitHandler)} className="space-y-4">
            <ScrollArea className="max-h-[60vh] p-1 pr-3">
              <div className="space-y-4">
                <FormField control={form.control} name="name" render={({ field }) => (
                  <FormItem><FormLabel>Nombre del SLA</FormLabel><FormControl><Input placeholder="Ej. SLA Estándar" {...field} /></FormControl><FormMessage /></FormItem>
                )} />
                <FormField control={form.control} name="description" render={({ field }) => (
                  <FormItem><FormLabel>Descripción (Opcional)</FormLabel><FormControl><Textarea placeholder="Breve descripción del SLA" {...field} rows={2} /></FormControl><FormMessage /></FormItem>
                )} />
                <div className="grid grid-cols-2 gap-4">
                    <FormField control={form.control} name="responseTimeTargetMinutes" render={({ field }) => (
                    <FormItem><FormLabel>Objetivo Respuesta (min)</FormLabel><FormControl><Input type="number" {...field} /></FormControl><FormMessage /></FormItem>
                    )} />
                    <FormField control={form.control} name="resolutionTimeTargetHours" render={({ field }) => (
                    <FormItem><FormLabel>Objetivo Resolución (horas)</FormLabel><FormControl><Input type="number" {...field} /></FormControl><FormMessage /></FormItem>
                    )} />
                </div>
                <FormItem>
                    <FormLabel>Aplicar a Prioridades</FormLabel>
                    <div className="space-y-1">
                    {ticketPriorities.map((priority) => (
                        <FormField
                        key={priority}
                        control={form.control}
                        name="appliesToPriority"
                        render={({ field }) => {
                            return (
                            <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                                <FormControl>
                                <Checkbox
                                    checked={field.value?.includes(priority)}
                                    onCheckedChange={(checked) => {
                                    return checked
                                        ? field.onChange([...(field.value || []), priority])
                                        : field.onChange(
                                            (field.value || []).filter(
                                            (value) => value !== priority
                                            )
                                        )
                                    }}
                                />
                                </FormControl>
                                <FormLabel className="font-normal capitalize">
                                {priority}
                                </FormLabel>
                            </FormItem>
                            )
                        }}
                        />
                    ))}
                    </div>
                     <FormDescUi className="text-xs">Si no se selecciona ninguna, se aplicará a todas las prioridades por defecto.</FormDescUi>
                </FormItem>
                <FormField control={form.control} name="businessHoursOnly" render={({ field }) => (
                  <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3 shadow-sm">
                    <div className="space-y-0.5"><FormLabel>Solo Horario Laboral</FormLabel>
                    <FormDescUi className="text-xs">Si se activa, el SLA solo contará dentro del horario laboral configurado (funcionalidad futura).</FormDescUi></div>
                    <FormControl><Switch checked={field.value} onCheckedChange={field.onChange} /></FormControl>
                  </FormItem>
                )} />
                 <FormField control={form.control} name="isEnabled" render={({ field }) => (
                  <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3 shadow-sm">
                    <div className="space-y-0.5"><FormLabel>Habilitado</FormLabel>
                    <FormDescUi className="text-xs">Desactiva para archivar este SLA sin eliminarlo.</FormDescUi></div>
                    <FormControl><Switch checked={field.value} onCheckedChange={field.onChange} /></FormControl>
                  </FormItem>
                )} />
              </div>
            </ScrollArea>
            <DialogFooter className="pt-4 border-t">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isSubmitting}>
                Cancelar
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                {slaToEdit ? "Guardar Cambios" : "Crear SLA"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
