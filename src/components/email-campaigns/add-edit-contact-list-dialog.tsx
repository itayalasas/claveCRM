
"use client";

import { useState, useEffect } from "react";
import { useForm, SubmitHandler } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import type { ContactList } from "@/lib/types";
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
import { Textarea } from "@/components/ui/textarea";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Loader2 } from "lucide-react";

const formSchema = z.object({
  name: z.string().min(1, "El nombre de la lista es obligatorio."),
  description: z.string().optional(),
});

type ContactListFormValues = z.infer<typeof formSchema>;

interface AddEditContactListDialogProps {
  trigger: React.ReactNode;
  listToEdit?: ContactList | null;
  onSave: (data: Omit<ContactList, 'id' | 'createdAt'>) => Promise<boolean>; // Returns true on success
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
}

export function AddEditContactListDialog({
  trigger,
  listToEdit,
  onSave,
  isOpen,
  onOpenChange,
}: AddEditContactListDialogProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useForm<ContactListFormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: "",
      description: "",
    },
  });

  useEffect(() => {
    if (isOpen) {
      if (listToEdit) {
        form.reset({
          name: listToEdit.name,
          description: listToEdit.description || "",
        });
      } else {
        form.reset({ name: "", description: "" });
      }
      setIsSubmitting(false);
    }
  }, [listToEdit, isOpen, form]);

  const onSubmitHandler: SubmitHandler<ContactListFormValues> = async (data) => {
    setIsSubmitting(true);
    const success = await onSave(data);
    if (success) {
      onOpenChange(false); // Close dialog on successful save
    }
    setIsSubmitting(false);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle>{listToEdit ? "Editar Lista de Contactos" : "Nueva Lista de Contactos"}</DialogTitle>
          <DialogDescription>
            {listToEdit ? "Actualiza los detalles de esta lista." : "Crea una nueva lista para organizar tus contactos."}
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmitHandler)} className="space-y-4 py-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Nombre de la Lista</FormLabel>
                  <FormControl>
                    <Input placeholder="Ej. Clientes VIP, Suscriptores Newsletter" {...field} disabled={isSubmitting} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Descripción (Opcional)</FormLabel>
                  <FormControl>
                    <Textarea placeholder="Breve descripción del propósito de esta lista." {...field} rows={3} disabled={isSubmitting} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isSubmitting}>
                Cancelar
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                {isSubmitting ? "Guardando..." : (listToEdit ? "Guardar Cambios" : "Crear Lista")}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}