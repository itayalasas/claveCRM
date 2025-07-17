
"use client";

import { useState, useEffect } from "react";
import { useForm, SubmitHandler } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import type { EmailTemplate } from "@/lib/types";
import { PREDEFINED_EMAIL_TEMPLATES, COMMON_EMAIL_VARIABLES } from "@/lib/constants";
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
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, Construction, Palette, Code, ListChecks } from "lucide-react";

const formSchema = z.object({
  name: z.string().min(1, "El nombre de la plantilla es obligatorio."),
  subject: z.string().min(1, "El asunto es obligatorio."),
  contentHtml: z.string().min(1, "El contenido HTML es obligatorio."),
});

type EmailTemplateFormValues = z.infer<typeof formSchema>;

interface AddEditEmailTemplateDialogProps {
  trigger: React.ReactNode;
  templateToEdit?: EmailTemplate | null;
  onSave: (data: EmailTemplateFormValues, id?: string) => Promise<boolean>;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
}

export function AddEditEmailTemplateDialog({
  trigger,
  templateToEdit,
  onSave,
  isOpen,
  onOpenChange,
}: AddEditEmailTemplateDialogProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useForm<EmailTemplateFormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: "",
      subject: "",
      contentHtml: "<h1>Título de ejemplo</h1><p>Contenido del correo...</p>",
    },
  });

  useEffect(() => {
    if (isOpen) {
      if (templateToEdit) {
        form.reset({
          name: templateToEdit.name,
          subject: templateToEdit.subject,
          contentHtml: templateToEdit.contentHtml || "",
        });
      } else {
        form.reset({
          name: "",
          subject: "",
          contentHtml: "<h1>Título de ejemplo</h1><p>Contenido del correo...</p>",
        });
      }
      setIsSubmitting(false);
    }
  }, [templateToEdit, isOpen, form]);

  const handlePredefinedTemplateChange = (templateId: string) => {
    const selectedTemplate = PREDEFINED_EMAIL_TEMPLATES.find(t => t.id === templateId);
    if (selectedTemplate) {
      form.setValue("contentHtml", selectedTemplate.contentHtml);
      if (!form.getValues("subject")) {
         form.setValue("subject", `Asunto para: ${selectedTemplate.name}`);
      }
    }
  };

  const onSubmitHandler: SubmitHandler<EmailTemplateFormValues> = async (data) => {
    setIsSubmitting(true);
    const success = await onSave(data, templateToEdit?.id);
    if (success) {
      onOpenChange(false);
    }
    setIsSubmitting(false);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      {trigger}
      <DialogContent className="sm:max-w-3xl md:max-w-4xl lg:max-w-5xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>{templateToEdit ? "Editar Plantilla de Correo" : "Nueva Plantilla de Correo"}</DialogTitle>
          <DialogDescription>
            {templateToEdit ? "Actualiza los detalles de esta plantilla." : "Crea una nueva plantilla para tus campañas."}
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmitHandler)} className="flex-grow overflow-hidden flex flex-col">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4 px-1">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nombre de la Plantilla</FormLabel>
                    <FormControl>
                      <Input placeholder="Ej. Bienvenida Nuevos Usuarios" {...field} disabled={isSubmitting} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="subject"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Asunto del Correo</FormLabel>
                    <FormControl>
                      <Input placeholder="Ej. ¡Bienvenido a Nuestra Comunidad!" {...field} disabled={isSubmitting} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <Tabs defaultValue="html-editor" className="flex-grow flex flex-col overflow-hidden">
              <TabsList className="grid w-full grid-cols-2 md:grid-cols-3 mb-2 shrink-0">
                <TabsTrigger value="html-editor"><Code className="mr-2 h-4 w-4"/>Editor HTML</TabsTrigger>
                <TabsTrigger value="visual-editor" disabled><Palette className="mr-2 h-4 w-4"/>Editor Visual (Próx.)</TabsTrigger>
                <TabsTrigger value="variables"><ListChecks className="mr-2 h-4 w-4"/>Variables</TabsTrigger>
              </TabsList>
              
              <TabsContent value="html-editor" className="flex-grow overflow-y-auto space-y-4 p-1">
                <div>
                  <FormLabel>Cargar desde Plantilla Pre-diseñada (Opcional)</FormLabel>
                  <Select onValueChange={handlePredefinedTemplateChange} disabled={isSubmitting}>
                    <SelectTrigger className="mt-1">
                      <SelectValue placeholder="Selecciona una plantilla pre-diseñada..." />
                    </SelectTrigger>
                    <SelectContent>
                      {PREDEFINED_EMAIL_TEMPLATES.map(pt => (
                        <SelectItem key={pt.id} value={pt.id}>{pt.name} - {pt.description}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <FormField
                  control={form.control}
                  name="contentHtml"
                  render={({ field }) => (
                    <FormItem className="flex flex-col h-[calc(100%-4rem)]"> {/* Adjust height as needed */}
                      <FormLabel>Contenido HTML</FormLabel>
                      <FormControl className="flex-grow">
                        <Textarea 
                          placeholder="Escribe o pega tu código HTML aquí..." 
                          {...field} 
                          className="h-full min-h-[200px] resize-y" 
                          disabled={isSubmitting} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </TabsContent>

              <TabsContent value="visual-editor" className="flex-grow overflow-y-auto p-1">
                <Card className="h-full">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-lg"><Construction className="h-5 w-5 text-amber-500" />Editor Visual (Próximamente)</CardTitle>
                  </CardHeader>
                  <CardContent className="text-center text-muted-foreground py-10">
                    <Palette size={48} className="mx-auto mb-4 text-gray-400" />
                    <p>Un editor visual de arrastrar y soltar estará disponible aquí para facilitar la creación de correos.</p>
                    <p className="text-xs mt-2">Por ahora, utiliza el Editor HTML.</p>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="variables" className="flex-grow overflow-y-auto p-1">
                 <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Variables Disponibles para Personalización</CardTitle>
                     <FormDescription>
                      Usa estas variables en tu asunto o contenido HTML para personalizar tus correos. Se reemplazarán con los datos del contacto al enviar la campaña.
                    </FormDescription>
                  </CardHeader>
                  <CardContent>
                    <ScrollArea className="h-[300px]">
                      <ul className="space-y-2">
                        {COMMON_EMAIL_VARIABLES.map(v => (
                          <li key={v.variable} className="p-2 border rounded-md bg-muted/50">
                            <code className="font-mono text-primary bg-primary/10 px-1 py-0.5 rounded-sm">{v.variable}</code>
                            <p className="text-xs text-muted-foreground mt-1">{v.description}</p>
                          </li>
                        ))}
                      </ul>
                    </ScrollArea>
                  </CardContent>
                 </Card>
              </TabsContent>
            </Tabs>
            
            <DialogFooter className="mt-auto pt-4 border-t shrink-0">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isSubmitting}>
                Cancelar
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                {isSubmitting ? "Guardando..." : (templateToEdit ? "Guardar Cambios" : "Crear Plantilla")}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
