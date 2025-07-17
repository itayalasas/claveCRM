
"use client";

import { useState, useEffect } from "react";
import { useForm, Controller, SubmitHandler } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import type { SurveyTemplate, SurveyType, SurveyQuestion, SurveyQuestionType } from "@/lib/types";
import { SURVEY_TYPES, SURVEY_QUESTION_TYPES } from "@/lib/constants";
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Loader2, FileText, PlusCircle, Trash2 } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";

const questionSchema = z.object({
  id: z.string().optional(), // Will be auto-generated if new
  text: z.string().min(1, "El texto de la pregunta es obligatorio."),
  type: z.enum(SURVEY_QUESTION_TYPES.map(q => q.value) as [SurveyQuestionType, ...SurveyQuestionType[]]),
  options: z.array(z.object({ label: z.string(), value: z.string() })).optional(), // For MultipleChoice, SingleChoice, RatingScale (numeric values as string)
  isRequired: z.boolean().default(false),
  order: z.number().int().min(0),
});

const surveyTemplateFormSchema = z.object({
  name: z.string().min(1, "El nombre de la plantilla es obligatorio."),
  description: z.string().optional(),
  type: z.enum(SURVEY_TYPES.map(t => t.value) as [SurveyType, ...SurveyType[]]),
  questions: z.array(questionSchema).min(1, "Debe haber al menos una pregunta."),
  thankYouMessage: z.string().optional(),
  isEnabled: z.boolean().default(true),
});

type SurveyTemplateFormValues = z.infer<typeof surveyTemplateFormSchema>;

interface AddEditSurveyTemplateDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  templateToEdit?: SurveyTemplate | null;
  onSave: (data: Omit<SurveyTemplate, 'id' | 'createdAt' | 'updatedAt' | 'createdByUserId'>, id?: string) => Promise<boolean>;
}

const getDefaultQuestion = (order: number): SurveyQuestion => ({
  id: `q-${Date.now()}-${order}`,
  text: "",
  type: 'RatingScale',
  options: SURVEY_QUESTION_TYPES.find(q => q.value === 'RatingScale')?.value === 'RatingScale'
           ? [{label: "1", value: "1"}, {label: "2", value: "2"}, {label: "3", value: "3"}, {label: "4", value: "4"}, {label: "5", value: "5"}]
           : [],
  isRequired: true,
  order: order,
});

export function AddEditSurveyTemplateDialog({
  isOpen,
  onOpenChange,
  templateToEdit,
  onSave,
}: AddEditSurveyTemplateDialogProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useForm<SurveyTemplateFormValues>({
    resolver: zodResolver(surveyTemplateFormSchema),
    defaultValues: {
      name: "",
      description: "",
      type: 'CSAT',
      questions: [getDefaultQuestion(0)],
      thankYouMessage: "¡Gracias por tu respuesta!",
      isEnabled: true,
    },
  });

  useEffect(() => {
    if (isOpen) {
      if (templateToEdit) {
        form.reset({
          name: templateToEdit.name,
          description: templateToEdit.description || "",
          type: templateToEdit.type,
          questions: templateToEdit.questions.length > 0 ? templateToEdit.questions : [getDefaultQuestion(0)],
          thankYouMessage: templateToEdit.thankYouMessage || "¡Gracias por tu respuesta!",
          isEnabled: templateToEdit.isEnabled === undefined ? true : templateToEdit.isEnabled,
        });
      } else {
        form.reset({
          name: "", description: "", type: 'CSAT', questions: [getDefaultQuestion(0)],
          thankYouMessage: "¡Gracias por tu respuesta!", isEnabled: true,
        });
      }
      setIsSubmitting(false);
    }
  }, [templateToEdit, isOpen, form]);

  const onSubmitHandler: SubmitHandler<SurveyTemplateFormValues> = async (data) => {
    setIsSubmitting(true);
    // Ensure question IDs are set if not already
    const questionsWithIds = data.questions.map((q, index) => ({
        ...q,
        id: q.id || `q-${Date.now()}-${index}`,
        order: index // Re-assert order
    }));
    const payload = {...data, questions: questionsWithIds};

    const success = await onSave(payload, templateToEdit?.id);
    if (success) {
      onOpenChange(false);
    }
    setIsSubmitting(false);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-primary" />
            {templateToEdit ? "Editar Plantilla de Encuesta" : "Nueva Plantilla de Encuesta"}
          </DialogTitle>
          <DialogDescription>
            {templateToEdit ? "Actualiza los detalles de esta plantilla." : "Crea una nueva plantilla para tus encuestas de satisfacción."}
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmitHandler)} className="space-y-4">
            <ScrollArea className="max-h-[60vh] p-1 pr-3">
              <div className="space-y-4">
                <FormField control={form.control} name="name" render={({ field }) => (
                  <FormItem><FormLabel>Nombre de la Plantilla</FormLabel><FormControl><Input placeholder="Ej. Encuesta Post-Ticket" {...field} /></FormControl><FormMessage /></FormItem>
                )} />
                <FormField control={form.control} name="description" render={({ field }) => (
                  <FormItem><FormLabel>Descripción (Opcional)</FormLabel><FormControl><Textarea placeholder="Breve descripción del propósito" {...field} rows={2} /></FormControl><FormMessage /></FormItem>
                )} />
                <FormField control={form.control} name="type" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Tipo de Encuesta</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value} value={field.value}>
                      <FormControl><SelectTrigger><SelectValue placeholder="Selecciona un tipo" /></SelectTrigger></FormControl>
                      <SelectContent>
                        {SURVEY_TYPES.map(type => <SelectItem key={type.value} value={type.value} disabled={type.value !== 'CSAT'}>{type.label} {type.value !== 'CSAT' && '(Próx.)'}</SelectItem>)}
                      </SelectContent>
                    </Select>
                    <FormDescUi className="text-xs">Por ahora, solo CSAT está completamente soportado para la lógica de preguntas.</FormDescUi>
                    <FormMessage />
                  </FormItem>
                )} />

                {/* Questions Management (Simplified for CSAT) */}
                {form.watch("type") === 'CSAT' && (
                    <FormField
                        control={form.control}
                        name={`questions.0.text`} // Assuming only one question for CSAT for now
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel>Texto de la Pregunta CSAT Principal</FormLabel>
                                <FormControl><Input placeholder="Ej. ¿Qué tan satisfecho estás con la resolución de tu ticket?" {...field} /></FormControl>
                                <FormDescUi className="text-xs">Se usará una escala de 1 a 5 para esta pregunta.</FormDescUi>
                                <FormMessage />
                            </FormItem>
                        )}
                    />
                )}
                
                {/* Placeholder for more complex question builder */}
                {form.watch("type") !== 'CSAT' && (
                    <div className="p-3 border rounded-md bg-muted/30 text-sm text-muted-foreground">
                        El diseñador avanzado de preguntas para encuestas {form.watch("type")} y personalizadas está en desarrollo.
                    </div>
                )}


                <FormField control={form.control} name="thankYouMessage" render={({ field }) => (
                  <FormItem><FormLabel>Mensaje de Agradecimiento (Opcional)</FormLabel><FormControl><Input placeholder="¡Gracias por tu tiempo!" {...field} /></FormControl><FormMessage /></FormItem>
                )} />
                <FormField control={form.control} name="isEnabled" render={({ field }) => (
                  <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3 shadow-sm">
                    <div className="space-y-0.5"><FormLabel>Habilitada</FormLabel>
                    <FormDescUi className="text-xs">Permite usar esta plantilla para enviar encuestas.</FormDescUi></div>
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
                {templateToEdit ? "Guardar Cambios" : "Crear Plantilla"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
