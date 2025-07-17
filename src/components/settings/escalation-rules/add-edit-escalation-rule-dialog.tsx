
"use client";

import { useState, useEffect } from "react";
import { useForm, Controller, SubmitHandler } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import type { EscalationRule, EscalationConditionType, EscalationActionType, User, SLA, SupportQueue, TicketPriority } from "@/lib/types";
import { ESCALATION_CONDITION_TYPES, ESCALATION_ACTION_TYPES } from "@/lib/constants";
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
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription as FormDesc } from "@/components/ui/form";
import { Checkbox } from "@/components/ui/checkbox"; // Not used currently, but might be useful later
import { Switch } from "@/components/ui/switch";
import { Loader2 } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const NO_SELECTION_VALUE = "__NONE__";

const escalationRuleFormSchema = z.object({
  name: z.string().min(1, "El nombre de la regla es obligatorio."),
  description: z.string().optional(),
  conditionType: z.custom<EscalationConditionType>(val => ESCALATION_CONDITION_TYPES.some(ct => ct.value === val), {message: "Tipo de condición inválido."}),
  conditionValue: z.string().optional(), // String to handle various input types, validation done dynamically
  actionType: z.custom<EscalationActionType>(val => ESCALATION_ACTION_TYPES.some(at => at.value === val), {message: "Tipo de acción inválido."}),
  actionTargetUserId: z.string().optional(),
  actionTargetGroupId: z.string().optional(), // Placeholder for future group selection
  actionTargetQueueId: z.string().optional(),
  actionTargetPriority: z.custom<TicketPriority>().optional(),
  actionValue: z.string().optional(), // For actions like trigger_webhook that require a value (e.g. URL)
  order: z.coerce.number().int().min(0, "El orden debe ser un número positivo o cero."),
  isEnabled: z.boolean().default(true),
});

type EscalationRuleFormValues = z.infer<typeof escalationRuleFormSchema>;

interface AddEditEscalationRuleDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  ruleToEdit?: EscalationRule | null;
  onSave: (data: Omit<EscalationRule, 'id' | 'createdAt' | 'updatedAt'>, id?: string) => Promise<boolean>;
  allUsers: User[];
  allSlas: SLA[]; // For potential future condition/action targets
  allQueues: SupportQueue[];
  allPriorities: TicketPriority[];
}

export function AddEditEscalationRuleDialog({
  isOpen,
  onOpenChange,
  ruleToEdit,
  onSave,
  allUsers,
  allSlas,
  allQueues,
  allPriorities,
}: AddEditEscalationRuleDialogProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useForm<EscalationRuleFormValues>({
    resolver: zodResolver(escalationRuleFormSchema),
    defaultValues: {
      name: "",
      description: "",
      conditionType: ESCALATION_CONDITION_TYPES[0].value,
      conditionValue: "",
      actionType: ESCALATION_ACTION_TYPES[0].value,
      actionTargetUserId: NO_SELECTION_VALUE,
      actionTargetGroupId: NO_SELECTION_VALUE,
      actionTargetQueueId: NO_SELECTION_VALUE,
      actionTargetPriority: undefined,
      actionValue: "",
      order: 0,
      isEnabled: true,
    },
  });

  const selectedConditionType = form.watch("conditionType");
  const selectedActionType = form.watch("actionType");

  useEffect(() => {
    if (isOpen) {
      if (ruleToEdit) {
        form.reset({
          name: ruleToEdit.name,
          description: ruleToEdit.description || "",
          conditionType: ruleToEdit.conditionType,
          conditionValue: String(ruleToEdit.conditionValue || ""), // Convert to string for input
          actionType: ruleToEdit.actionType,
          actionTargetUserId: ruleToEdit.actionTargetUserId || NO_SELECTION_VALUE,
          actionTargetGroupId: ruleToEdit.actionTargetGroupId || NO_SELECTION_VALUE,
          actionTargetQueueId: ruleToEdit.actionTargetQueueId || NO_SELECTION_VALUE,
          actionTargetPriority: ruleToEdit.actionTargetPriority || undefined,
          actionValue: ruleToEdit.actionValue || "",
          order: ruleToEdit.order,
          isEnabled: ruleToEdit.isEnabled,
        });
      } else {
        form.reset({ // Reset to defaults for new rule
          name: "", description: "",
          conditionType: ESCALATION_CONDITION_TYPES[0].value, conditionValue: "",
          actionType: ESCALATION_ACTION_TYPES[0].value,
          actionTargetUserId: NO_SELECTION_VALUE,
          actionTargetGroupId: NO_SELECTION_VALUE,
          actionTargetQueueId: NO_SELECTION_VALUE,
          actionTargetPriority: undefined,
          actionValue: "",
          order: 0, isEnabled: true,
        });
      }
      setIsSubmitting(false);
    }
  }, [ruleToEdit, isOpen, form]);

  const onSubmitHandler: SubmitHandler<EscalationRuleFormValues> = async (data) => {
    setIsSubmitting(true);
    const conditionConfig = ESCALATION_CONDITION_TYPES.find(c => c.value === data.conditionType);
    let parsedConditionValue: string | number | undefined = data.conditionValue;

    if (conditionConfig?.requiresValue === 'number' && data.conditionValue) {
        parsedConditionValue = parseInt(data.conditionValue, 10);
        if (isNaN(parsedConditionValue)) {
            form.setError("conditionValue", { type: "manual", message: "Debe ser un número." });
            setIsSubmitting(false);
            return;
        }
    }

    const payload = {
        ...data,
        conditionValue: (parsedConditionValue === "" || parsedConditionValue === undefined) ? null : parsedConditionValue,
        actionTargetUserId: (data.actionTargetUserId === NO_SELECTION_VALUE || !data.actionTargetUserId) ? null : data.actionTargetUserId,
        actionTargetGroupId: (data.actionTargetGroupId === NO_SELECTION_VALUE || !data.actionTargetGroupId) ? null : data.actionTargetGroupId,
        actionTargetQueueId: (data.actionTargetQueueId === NO_SELECTION_VALUE || !data.actionTargetQueueId) ? null : data.actionTargetQueueId,
        actionTargetPriority: data.actionTargetPriority || null,
        actionValue: data.actionValue || null,
    };

    // Explicitly remove undefined properties from payload before saving to Firestore
    Object.keys(payload).forEach(key => {
        if (payload[key as keyof typeof payload] === undefined) {
            delete payload[key as keyof typeof payload];
        }
    });
    
    const success = await onSave(payload as Omit<EscalationRule, 'id' | 'createdAt' | 'updatedAt'>, ruleToEdit?.id);
    if (success) {
      onOpenChange(false);
    }
    setIsSubmitting(false);
  };

  const currentConditionConfig = ESCALATION_CONDITION_TYPES.find(c => c.value === selectedConditionType);
  const currentActionConfig = ESCALATION_ACTION_TYPES.find(a => a.value === selectedActionType);

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{ruleToEdit ? "Editar Regla de Escalado" : "Nueva Regla de Escalado"}</DialogTitle>
          <DialogDescription>
            {ruleToEdit ? "Actualiza los detalles de esta regla." : "Define una nueva regla para la escalada automática de tickets."}
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmitHandler)} className="space-y-4">
            <ScrollArea className="max-h-[60vh] p-1 pr-3">
              <div className="space-y-4">
                <FormField control={form.control} name="name" render={({ field }) => (
                  <FormItem><FormLabel>Nombre de la Regla</FormLabel><FormControl><Input placeholder="Ej. Escalar Tickets VIP sin respuesta" {...field} /></FormControl><FormMessage /></FormItem>
                )} />
                <FormField control={form.control} name="description" render={({ field }) => (
                  <FormItem><FormLabel>Descripción (Opcional)</FormLabel><FormControl><Textarea placeholder="Breve descripción de la regla" {...field} rows={2} /></FormControl><FormMessage /></FormItem>
                )} />

                <FormField control={form.control} name="conditionType" render={({ field }) => (
                  <FormItem><FormLabel>Condición (Si...)</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl><SelectTrigger><SelectValue placeholder="Selecciona un tipo de condición" /></SelectTrigger></FormControl>
                      <SelectContent>
                        {ESCALATION_CONDITION_TYPES.map(type => <SelectItem key={type.value} value={type.value}>{type.label}</SelectItem>)}
                      </SelectContent>
                    </Select><FormMessage />
                  </FormItem>
                )} />

                {currentConditionConfig?.requiresValue && (
                  <FormField control={form.control} name="conditionValue" render={({ field }) => (
                    <FormItem>
                      <FormLabel>
                        {currentConditionConfig.requiresValue === 'number' && "Valor (ej. horas)"}
                        {currentConditionConfig.requiresValue === 'priority' && "Prioridad Específica"}
                        {currentConditionConfig.requiresValue === 'queue' && "Cola Específica"}
                        {currentConditionConfig.requiresValue === 'string' && "Valor (texto)"}
                      </FormLabel>
                      {currentConditionConfig.requiresValue === 'number' && <FormControl><Input type="number" placeholder="Ej. 2 (para horas)" {...field} /></FormControl>}
                      {currentConditionConfig.requiresValue === 'string' && <FormControl><Input type="text" placeholder="Valor de la condición" {...field} /></FormControl>}
                      {currentConditionConfig.requiresValue === 'priority' && (
                        <Select onValueChange={field.onChange} value={field.value || NO_SELECTION_VALUE}>
                          <FormControl><SelectTrigger><SelectValue placeholder="Selecciona una prioridad" /></SelectTrigger></FormControl>
                          <SelectContent>
                            {allPriorities.map(p => <SelectItem key={p} value={p} className="capitalize">{p}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      )}
                      {currentConditionConfig.requiresValue === 'queue' && (
                        <Select onValueChange={field.onChange} value={field.value || NO_SELECTION_VALUE}>
                          <FormControl><SelectTrigger><SelectValue placeholder="Selecciona una cola" /></SelectTrigger></FormControl>
                          <SelectContent>
                            {allQueues.map(q => <SelectItem key={q.id} value={q.id}>{q.name}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      )}
                      <FormMessage />
                    </FormItem>
                  )} />
                )}

                <FormField control={form.control} name="actionType" render={({ field }) => (
                  <FormItem><FormLabel>Acción (Entonces...)</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl><SelectTrigger><SelectValue placeholder="Selecciona un tipo de acción" /></SelectTrigger></FormControl>
                      <SelectContent>
                        {ESCALATION_ACTION_TYPES.map(type => <SelectItem key={type.value} value={type.value} disabled={type.targetType === 'group' && type.label.includes('(Futuro)')}>{type.label}</SelectItem>)}
                      </SelectContent>
                    </Select><FormMessage />
                  </FormItem>
                )} />

                {currentActionConfig?.targetType === 'user' && (
                    <FormField control={form.control} name="actionTargetUserId" render={({ field }) => (
                        <FormItem><FormLabel>Usuario Objetivo</FormLabel>
                            <Select onValueChange={field.onChange} value={field.value || NO_SELECTION_VALUE}>
                            <FormControl><SelectTrigger><SelectValue placeholder="Selecciona un usuario" /></SelectTrigger></FormControl>
                            <SelectContent>
                                <SelectItem value={NO_SELECTION_VALUE}>Ninguno</SelectItem>
                                {allUsers.map(user => <SelectItem key={user.id} value={user.id}>{user.name}</SelectItem>)}
                            </SelectContent>
                            </Select><FormMessage />
                        </FormItem>
                    )} />
                )}
                {currentActionConfig?.targetType === 'queue' && (
                    <FormField control={form.control} name="actionTargetQueueId" render={({ field }) => (
                        <FormItem><FormLabel>Cola Objetivo</FormLabel>
                            <Select onValueChange={field.onChange} value={field.value || NO_SELECTION_VALUE}>
                            <FormControl><SelectTrigger><SelectValue placeholder="Selecciona una cola" /></SelectTrigger></FormControl>
                            <SelectContent>
                                <SelectItem value={NO_SELECTION_VALUE}>Ninguna</SelectItem>
                                {allQueues.map(queue => <SelectItem key={queue.id} value={queue.id}>{queue.name}</SelectItem>)}
                            </SelectContent>
                            </Select><FormMessage />
                        </FormItem>
                    )} />
                )}
                 {currentActionConfig?.targetType === 'priority' && (
                    <FormField control={form.control} name="actionTargetPriority" render={({ field }) => (
                        <FormItem><FormLabel>Nueva Prioridad</FormLabel>
                            <Select onValueChange={field.onChange} value={field.value || undefined}>
                            <FormControl><SelectTrigger><SelectValue placeholder="Selecciona una prioridad" /></SelectTrigger></FormControl>
                            <SelectContent>
                                {allPriorities.map(p => <SelectItem key={p} value={p} className="capitalize">{p}</SelectItem>)}
                            </SelectContent>
                            </Select><FormMessage />
                        </FormItem>
                    )} />
                )}
                {currentActionConfig?.requiresValue === 'string' && (
                    <FormField control={form.control} name="actionValue" render={({ field }) => (
                        <FormItem><FormLabel>Valor de Acción (ej. URL para Webhook)</FormLabel>
                        <FormControl><Input type="text" placeholder="Ej. https://mi.webhook.com/..." {...field} /></FormControl>
                        <FormMessage />
                        </FormItem>
                    )} />
                )}


                <FormField control={form.control} name="order" render={({ field }) => (
                  <FormItem><FormLabel>Orden de Ejecución</FormLabel><FormControl><Input type="number" placeholder="0" {...field} /></FormControl>
                  <FormDesc className="text-xs">Menor número se ejecuta primero.</FormDesc><FormMessage />
                  </FormItem>
                )} />

                 <FormField control={form.control} name="isEnabled" render={({ field }) => (
                  <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3 shadow-sm">
                    <div className="space-y-0.5"><FormLabel>Habilitada</FormLabel>
                    <FormDesc className="text-xs">Desactiva para que la regla no se ejecute.</FormDesc></div>
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
                {ruleToEdit ? "Guardar Cambios" : "Crear Regla"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
