
"use client";

import { useState, useEffect } from "react";
import { useForm, Controller, SubmitHandler } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import type { SupportQueue, User, SLA } from "@/lib/types";
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Check, ChevronsUpDown, Loader2 } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";

const NO_SELECTION_VALUE = "__NONE__";

const supportQueueFormSchema = z.object({
  name: z.string().min(1, "El nombre de la cola es obligatorio."),
  description: z.string().optional(),
  defaultAssigneeUserId: z.string().optional(),
  defaultSlaId: z.string().optional(),
  memberUserIds: z.array(z.string()).optional().default([]), // Ensure default is an empty array
});

type SupportQueueFormValues = z.infer<typeof supportQueueFormSchema>;

interface AddEditSupportQueueDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  queueToEdit?: SupportQueue | null;
  onSave: (data: Omit<SupportQueue, 'id' | 'createdAt' | 'updatedAt'>, id?: string) => Promise<boolean>;
  allUsers: User[];
  allSlas: SLA[];
}

export function AddEditSupportQueueDialog({
  isOpen,
  onOpenChange,
  queueToEdit,
  onSave,
  allUsers,
  allSlas,
}: AddEditSupportQueueDialogProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [memberUserPopoverOpen, setMemberUserPopoverOpen] = useState(false);


  const form = useForm<SupportQueueFormValues>({
    resolver: zodResolver(supportQueueFormSchema),
    defaultValues: {
      name: "",
      description: "",
      defaultAssigneeUserId: NO_SELECTION_VALUE,
      defaultSlaId: NO_SELECTION_VALUE,
      memberUserIds: [],
    },
  });

  useEffect(() => {
    if (isOpen) {
      if (queueToEdit) {
        form.reset({
          name: queueToEdit.name,
          description: queueToEdit.description || "",
          defaultAssigneeUserId: queueToEdit.defaultAssigneeUserId || NO_SELECTION_VALUE,
          defaultSlaId: queueToEdit.defaultSlaId || NO_SELECTION_VALUE,
          memberUserIds: queueToEdit.memberUserIds || [],
        });
      } else {
        form.reset({
          name: "", description: "", defaultAssigneeUserId: NO_SELECTION_VALUE,
          defaultSlaId: NO_SELECTION_VALUE, memberUserIds: [],
        });
      }
      setIsSubmitting(false);
    }
  }, [queueToEdit, isOpen, form]);

  const onSubmitHandler: SubmitHandler<SupportQueueFormValues> = async (data) => {
    setIsSubmitting(true);
    const payload = {
        ...data,
        defaultAssigneeUserId: data.defaultAssigneeUserId === NO_SELECTION_VALUE ? null : data.defaultAssigneeUserId,
        defaultSlaId: data.defaultSlaId === NO_SELECTION_VALUE ? null : data.defaultSlaId,
        memberUserIds: data.memberUserIds || [], // Ensure it's an array, even if empty
    };
    const success = await onSave(payload as Omit<SupportQueue, 'id' | 'createdAt' | 'updatedAt'>, queueToEdit?.id);
    if (success) {
      onOpenChange(false);
    }
    setIsSubmitting(false);
  };

  const sortedUsers = allUsers.slice().sort((a,b) => a.name.localeCompare(b.name));
  const defaultAssigneeNameDisplay = form.watch("defaultAssigneeUserId") ? sortedUsers.find(u => u.id === form.watch("defaultAssigneeUserId"))?.name : "Sin asignar por defecto";

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{queueToEdit ? "Editar Cola de Soporte" : "Nueva Cola de Soporte"}</DialogTitle>
          <DialogDescription>
            {queueToEdit ? "Actualiza los detalles de esta cola." : "Define una nueva cola para organizar los tickets."}
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmitHandler)} className="space-y-4">
            <ScrollArea className="max-h-[60vh] p-1 pr-3">
              <div className="space-y-4">
                <FormField control={form.control} name="name" render={({ field }) => (
                  <FormItem><FormLabel>Nombre de la Cola</FormLabel><FormControl><Input placeholder="Ej. Soporte Nivel 1" {...field} /></FormControl><FormMessage /></FormItem>
                )} />
                <FormField control={form.control} name="description" render={({ field }) => (
                  <FormItem><FormLabel>Descripción (Opcional)</FormLabel><FormControl><Textarea placeholder="Breve descripción de la cola" {...field} rows={2} /></FormControl><FormMessage /></FormItem>
                )} />
                
                <FormField control={form.control} name="defaultAssigneeUserId" render={({ field }) => (
                  <FormItem className="flex flex-col">
                    <FormLabel>Asignado por Defecto (Opcional)</FormLabel>
                    <Popover>
                        <PopoverTrigger asChild>
                            <FormControl>
                            <Button variant="outline" role="combobox" className={cn("w-full justify-between", (!field.value || field.value === NO_SELECTION_VALUE) && "text-muted-foreground")}>
                                {field.value && field.value !== NO_SELECTION_VALUE ? sortedUsers.find(user => user.id === field.value)?.name : "Sin asignar por defecto"}
                                <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                            </Button>
                            </FormControl>
                        </PopoverTrigger>
                        <PopoverContent className="w-[--radix-popover-trigger-width] p-0">
                            <Command>
                                <CommandInput placeholder="Buscar usuario..." />
                                <CommandList>
                                <CommandEmpty>Ningún usuario encontrado.</CommandEmpty>
                                <CommandGroup>
                                    <CommandItem value={NO_SELECTION_VALUE} key={NO_SELECTION_VALUE} onSelect={() => field.onChange(NO_SELECTION_VALUE)}>Sin asignar por defecto</CommandItem>
                                    {sortedUsers.map((user) => (
                                    <CommandItem value={user.name} key={user.id} onSelect={() => field.onChange(user.id)}>
                                        <Check className={cn("mr-2 h-4 w-4", user.id === field.value ? "opacity-100" : "opacity-0")}/>
                                        {user.name}
                                    </CommandItem>
                                    ))}
                                </CommandGroup>
                                </CommandList>
                            </Command>
                        </PopoverContent>
                    </Popover>
                    <FormMessage />
                  </FormItem>
                )} />

                <FormField control={form.control} name="defaultSlaId" render={({ field }) => (
                  <FormItem>
                    <FormLabel>SLA por Defecto (Opcional)</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value || NO_SELECTION_VALUE}>
                      <FormControl><SelectTrigger><SelectValue placeholder="Selecciona un SLA" /></SelectTrigger></FormControl>
                      <SelectContent>
                        <SelectItem value={NO_SELECTION_VALUE}>Ninguno</SelectItem>
                        {allSlas.map(sla => <SelectItem key={sla.id} value={sla.id}>{sla.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )} />

                <FormItem>
                    <FormLabel>Miembros de la Cola (Opcional)</FormLabel>
                    <Controller
                        control={form.control}
                        name="memberUserIds"
                        render={({ field }) => (
                            <Popover open={memberUserPopoverOpen} onOpenChange={setMemberUserPopoverOpen}>
                                <PopoverTrigger asChild>
                                    <Button variant="outline" role="combobox" aria-expanded={memberUserPopoverOpen} className="w-full justify-between">
                                        {field.value && field.value.length > 0 ? `${field.value.length} miembro(s) seleccionado(s)` : "Seleccionar miembros..."}
                                        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                    </Button>
                                </PopoverTrigger>
                                <PopoverContent className="w-[--radix-popover-trigger-width] p-0">
                                    <Command>
                                        <CommandInput placeholder="Buscar usuarios..." />
                                        <CommandList>
                                            <CommandEmpty>No se encontraron usuarios.</CommandEmpty>
                                            <CommandGroup>
                                                {sortedUsers.map((user) => (
                                                    <CommandItem
                                                        key={user.id}
                                                        value={user.name} // Use a unique value for CommandItem's value prop
                                                        onSelect={() => {
                                                            const currentMembers = field.value || [];
                                                            const newMembers = currentMembers.includes(user.id)
                                                                ? currentMembers.filter((id) => id !== user.id)
                                                                : [...currentMembers, user.id];
                                                            field.onChange(newMembers);
                                                            // Do not close popover: setMemberUserPopoverOpen(false);
                                                        }}
                                                    >
                                                        <Check className={cn("mr-2 h-4 w-4", field.value?.includes(user.id) ? "opacity-100" : "opacity-0")} />
                                                        {user.name}
                                                    </CommandItem>
                                                ))}
                                            </CommandGroup>
                                        </CommandList>
                                    </Command>
                                </PopoverContent>
                            </Popover>
                        )}
                    />
                    <FormDesc className="text-xs">Usuarios que pueden ver y tomar tickets de esta cola.</FormDesc>
                </FormItem>
              </div>
            </ScrollArea>
            <DialogFooter className="pt-4 border-t">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isSubmitting}>
                Cancelar
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                {queueToEdit ? "Guardar Cambios" : "Crear Cola"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

    