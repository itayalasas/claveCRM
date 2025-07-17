
"use client";

import { useState, useEffect } from "react";
import { useForm, SubmitHandler, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import type { EmailCampaign, ContactList, EmailTemplate, ABTestConfig } from "@/lib/types";
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
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription as FormDescriptionUI } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardHeader, CardTitle as CardTitleShadcn } from "@/components/ui/card";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { CalendarIcon, Loader2, Send, Construction, BarChart2, TestTube2, Clock, Beaker } from "lucide-react";
import { format, parseISO, isValid, setHours, setMinutes, setSeconds, setMilliseconds, isBefore, isEqual, startOfMinute, startOfDay } from "date-fns";
import { es } from 'date-fns/locale';
import { cn } from "@/lib/utils";
import { Timestamp } from "firebase/firestore";

const abTestFormSchema = z.object({
  isEnabled: z.boolean().default(false),
  variantBSubject: z.string().optional(),
  variantBEmailTemplateId: z.string().optional(),
  // Placeholders for future, not validated strictly yet
  splitPercentage: z.number().min(0).max(100).optional(),
  winnerCriteria: z.string().optional(), // Should be enum like ABTestWinnerCriteria later
  testDurationHours: z.number().min(1).optional(),
}).optional();


const formSchema = z.object({
  name: z.string().min(1, "El nombre de la campaña es obligatorio."),
  subject: z.string().min(1, "El asunto es obligatorio."), // Subject for Variant A
  fromName: z.string().min(1, "El nombre del remitente es obligatorio."),
  fromEmail: z.string().email("El correo del remitente es inválido."),
  contactListId: z.string().min(1, "Debes seleccionar una lista de contactos."),
  emailTemplateId: z.string().min(1, "Debes seleccionar una plantilla de correo."), // Template for Variant A
  scheduledDate: z.date().optional(),
  scheduledHour: z.string().optional().refine(val => !val || (parseInt(val) >= 0 && parseInt(val) <= 23), { message: "Hora inválida (0-23)"}),
  scheduledMinute: z.string().optional().refine(val => !val || (parseInt(val) >= 0 && parseInt(val) <= 59), { message: "Minuto inválido (0-59)"}),
  abTest: abTestFormSchema,
}).refine(data => {
  if (data.abTest?.isEnabled) {
    return !!data.abTest.variantBSubject && !!data.abTest.variantBEmailTemplateId;
  }
  return true;
}, {
  message: "El asunto y la plantilla para la Variante B son obligatorios si la Prueba A/B está habilitada.",
  path: ["abTest.variantBSubject"], // Or another relevant path
});

type EmailCampaignFormValues = z.infer<typeof formSchema>;

interface AddEditEmailCampaignDialogProps {
  trigger: React.ReactNode;
  campaignToEdit?: EmailCampaign | null;
  onSave: (data: Omit<EmailCampaignFormValues, 'scheduledDate' | 'scheduledHour' | 'scheduledMinute'> & { scheduledAt?: string; abTest?: ABTestConfig | null; }, id?: string) => Promise<boolean>;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  contactLists: ContactList[];
  emailTemplates: EmailTemplate[];
}

export function AddEditEmailCampaignDialog({
  trigger,
  campaignToEdit,
  onSave,
  isOpen,
  onOpenChange,
  contactLists,
  emailTemplates,
}: AddEditEmailCampaignDialogProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useForm<EmailCampaignFormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: "",
      subject: "",
      fromName: "",
      fromEmail: "",
      contactListId: "",
      emailTemplateId: "",
      scheduledDate: undefined,
      scheduledHour: "09",
      scheduledMinute: "00",
      abTest: {
        isEnabled: false,
        variantBSubject: "",
        variantBEmailTemplateId: "",
        splitPercentage: 50,
        winnerCriteria: "open_rate",
        testDurationHours: 24,
      }
    },
  });

  const { watch } = form;
  const abTestEnabled = watch("abTest.isEnabled");

  useEffect(() => {
    if (isOpen) {
      let defaultValues: Partial<EmailCampaignFormValues> = {
        name: "", subject: "", fromName: "", fromEmail: "",
        contactListId: "", emailTemplateId: "", scheduledDate: undefined,
        scheduledHour: "09", scheduledMinute: "00",
        abTest: {
            isEnabled: false, variantBSubject: "", variantBEmailTemplateId: "",
            splitPercentage: 50, winnerCriteria: "open_rate", testDurationHours: 24,
        }
      };

      if (campaignToEdit) {
        defaultValues.name = campaignToEdit.name;
        defaultValues.subject = campaignToEdit.subject;
        defaultValues.fromName = campaignToEdit.fromName;
        defaultValues.fromEmail = campaignToEdit.fromEmail;
        defaultValues.contactListId = campaignToEdit.contactListId;
        defaultValues.emailTemplateId = campaignToEdit.emailTemplateId;
        
        if (campaignToEdit.scheduledAt && isValid(parseISO(campaignToEdit.scheduledAt))) {
            const userTimeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
            const localScheduledDateTime = new Date(campaignToEdit.scheduledAt); // Assuming stored as UTC ISO string
            defaultValues.scheduledDate = localScheduledDateTime;
            defaultValues.scheduledHour = format(localScheduledDateTime, "HH");
            defaultValues.scheduledMinute = format(localScheduledDateTime, "mm");
        }
        
        if (campaignToEdit.abTest) {
            defaultValues.abTest = {
                isEnabled: campaignToEdit.abTest.isEnabled,
                variantBSubject: campaignToEdit.abTest.variantBSubject || "",
                variantBEmailTemplateId: campaignToEdit.abTest.variantBEmailTemplateId || "",
                splitPercentage: campaignToEdit.abTest.splitPercentage || 50,
                winnerCriteria: campaignToEdit.abTest.winnerCriteria || "open_rate",
                testDurationHours: campaignToEdit.abTest.testDurationHours || 24,
            };
        }
      }
      form.reset(defaultValues as EmailCampaignFormValues);
      setIsSubmitting(false);
    }
  }, [campaignToEdit, isOpen, form]);


  const onSubmitHandler: SubmitHandler<EmailCampaignFormValues> = async (data) => {
    setIsSubmitting(true);
    let scheduledAtISO: string | undefined = undefined;

    if (data.scheduledDate) {
        let localScheduledDateTime = data.scheduledDate;
        const hour = parseInt(data.scheduledHour || "0");
        const minute = parseInt(data.scheduledMinute || "0");
        
        localScheduledDateTime = setHours(localScheduledDateTime, hour);
        localScheduledDateTime = setMinutes(localScheduledDateTime, minute);
        localScheduledDateTime = setSeconds(localScheduledDateTime, 0);
        localScheduledDateTime = setMilliseconds(localScheduledDateTime, 0);
        
        // Convert local time to UTC ISO string for storage
        scheduledAtISO = localScheduledDateTime.toISOString();
    }
    
    const dataToSave = {
        name: data.name,
        subject: data.subject,
        fromName: data.fromName,
        fromEmail: data.fromEmail,
        contactListId: data.contactListId,
        emailTemplateId: data.emailTemplateId,
        scheduledAt: scheduledAtISO,
        abTest: data.abTest?.isEnabled ? {
            isEnabled: true,
            variantBSubject: data.abTest.variantBSubject,
            variantBEmailTemplateId: data.abTest.variantBEmailTemplateId,
            splitPercentage: data.abTest.splitPercentage || 50,
            winnerCriteria: data.abTest.winnerCriteria || 'open_rate',
            testDurationHours: data.abTest.testDurationHours || 24,
        } : null,
    };
    // Type assertion for onSave
    const success = await onSave(dataToSave as Omit<EmailCampaignFormValues, 'scheduledDate' | 'scheduledHour' | 'scheduledMinute'> & { scheduledAt?: string; abTest?: ABTestConfig | null; }, campaignToEdit?.id);
    if (success) {
      onOpenChange(false);
    }
    setIsSubmitting(false);
  };

  const selectedScheduledDate = form.watch("scheduledDate");

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      {trigger}
      <DialogContent className="sm:max-w-lg md:max-w-xl lg:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Send className="h-5 w-5 text-primary" />
            {campaignToEdit ? "Editar Campaña de Email" : "Nueva Campaña de Email"}
          </DialogTitle>
          <DialogDescription>
            {campaignToEdit ? "Actualiza los detalles de esta campaña." : "Configura una nueva campaña para enviar a tus contactos."}
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmitHandler)} className="space-y-4 py-4 max-h-[70vh] overflow-y-auto pr-2">
            <FormField control={form.control} name="name" render={({ field }) => (
              <FormItem><FormLabel>Nombre de la Campaña</FormLabel><FormControl><Input placeholder="Ej. Promoción Verano 2024" {...field} /></FormControl><FormMessage /></FormItem>
            )} />
            
            <Card className="border-dashed">
              <CardHeader className="p-3">
                <CardTitleShadcn className="text-base">Contenido Principal (Variante A)</CardTitleShadcn>
              </CardHeader>
              <CardContent className="p-3 space-y-4">
                <FormField control={form.control} name="subject" render={({ field }) => (
                  <FormItem><FormLabel>Asunto del Correo (Variante A)</FormLabel><FormControl><Input placeholder="Ej. ¡Descuentos Exclusivos de Verano!" {...field} /></FormControl><FormMessage /></FormItem>
                )} />
                <FormField control={form.control} name="emailTemplateId" render={({ field }) => (
                    <FormItem>
                        <FormLabel>Plantilla de Correo (Variante A)</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                            <FormControl><SelectTrigger><SelectValue placeholder="Selecciona una plantilla" /></SelectTrigger></FormControl>
                            <SelectContent>
                                {emailTemplates.map(template => <SelectItem key={template.id} value={template.id}>{template.name}</SelectItem>)}
                            </SelectContent>
                        </Select>
                        <FormMessage />
                    </FormItem>
                )} />
              </CardContent>
            </Card>

            <div className="grid grid-cols-2 gap-4">
                <FormField control={form.control} name="fromName" render={({ field }) => (
                    <FormItem><FormLabel>Nombre Remitente</FormLabel><FormControl><Input placeholder="Ej. Tu Empresa" {...field} /></FormControl><FormMessage /></FormItem>
                )} />
                <FormField control={form.control} name="fromEmail" render={({ field }) => (
                    <FormItem><FormLabel>Email Remitente</FormLabel><FormControl><Input type="email" placeholder="ej. marketing@tuempresa.com" {...field} /></FormControl><FormMessage /></FormItem>
                )} />
            </div>
             <FormField control={form.control} name="contactListId" render={({ field }) => (
                <FormItem>
                    <FormLabel>Lista de Contactos</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl><SelectTrigger><SelectValue placeholder="Selecciona una lista" /></SelectTrigger></FormControl>
                        <SelectContent>
                            {contactLists.map(list => <SelectItem key={list.id} value={list.id}>{list.name} ({list.contactCount || 0} contactos)</SelectItem>)}
                        </SelectContent>
                    </Select>
                    <FormMessage />
                </FormItem>
            )} />
             <FormField control={form.control} name="scheduledDate" render={({ field }) => (
                <FormItem className="flex flex-col">
                    <FormLabel>Fecha de Envío Programado (Opcional)</FormLabel>
                    <Popover>
                        <PopoverTrigger asChild>
                        <FormControl>
                            <Button
                                variant={"outline"}
                                className={cn("w-full pl-3 text-left font-normal", !field.value && "text-muted-foreground")}
                            >
                            {selectedScheduledDate ? format(selectedScheduledDate, "PPP", { locale: es }) : <span>Seleccionar fecha</span>}
                            <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                            </Button>
                        </FormControl>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                            locale={es}
                            mode="single"
                            selected={field.value}
                            onSelect={(date) => {
                                field.onChange(date);
                                if (!date) {
                                    form.setValue("scheduledHour", "09");
                                    form.setValue("scheduledMinute", "00");
                                }
                            }}
                            disabled={(date) => isBefore(date, startOfDay(new Date()))} 
                            initialFocus
                        />
                        </PopoverContent>
                    </Popover>
                    <FormDescriptionUI className="text-xs">La hora se interpreta en tu zona horaria local y se guarda en UTC. Si no se selecciona, la campaña quedará como borrador. Para envío inmediato, programa para la hora actual.</FormDescriptionUI>
                    <FormMessage />
                </FormItem>
            )} />
            {selectedScheduledDate && (
                <div className="grid grid-cols-2 gap-4">
                    <FormField control={form.control} name="scheduledHour" render={({ field }) => (
                        <FormItem>
                            <FormLabel>Hora (0-23)</FormLabel>
                            <Select onValueChange={field.onChange} value={field.value || "09"}>
                                <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                                <SelectContent>
                                    {Array.from({ length: 24 }, (_, i) => String(i).padStart(2, '0')).map(h => <SelectItem key={h} value={h}>{h}</SelectItem>)}
                                </SelectContent>
                            </Select>
                            <FormMessage />
                        </FormItem>
                    )} />
                    <FormField control={form.control} name="scheduledMinute" render={({ field }) => (
                         <FormItem>
                            <FormLabel>Minuto (0-59)</FormLabel>
                             <Select onValueChange={field.onChange} value={field.value || "00"}>
                                <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                                <SelectContent>
                                    {Array.from({ length: 60 }, (_, i) => String(i).padStart(2, '0')).map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}
                                </SelectContent>
                            </Select>
                            <FormMessage />
                        </FormItem>
                    )} />
                </div>
            )}

            <Accordion type="single" collapsible className="w-full">
              <AccordionItem value="ab-test-settings">
                <AccordionTrigger>
                  <div className="flex items-center gap-2">
                    <Beaker className="h-5 w-5 text-purple-500" />
                    Configuración de Prueba A/B (Opcional)
                  </div>
                </AccordionTrigger>
                <AccordionContent className="pt-2">
                  <Card className="border-purple-300">
                    <CardHeader className="p-3">
                       <FormField
                          control={form.control}
                          name="abTest.isEnabled"
                          render={({ field }) => (
                            <FormItem className="flex flex-row items-center justify-between rounded-lg p-0">
                              <div className="space-y-0.5">
                                <FormLabel>Habilitar Prueba A/B</FormLabel>
                                <FormDescriptionUI className="text-xs">Permite enviar dos versiones de tu correo a diferentes segmentos de tu lista.</FormDescriptionUI>
                              </div>
                              <FormControl><Switch checked={field.value} onCheckedChange={field.onChange} /></FormControl>
                            </FormItem>
                          )}
                        />
                    </CardHeader>
                    {abTestEnabled && (
                      <CardContent className="p-3 space-y-4">
                        <FormField control={form.control} name="abTest.variantBSubject" render={({ field }) => (
                          <FormItem><FormLabel>Asunto (Variante B)</FormLabel><FormControl><Input placeholder="Ej. ¡Mira nuestras Novedades de Verano!" {...field} /></FormControl><FormMessage /></FormItem>
                        )} />
                        <FormField control={form.control} name="abTest.variantBEmailTemplateId" render={({ field }) => (
                            <FormItem>
                                <FormLabel>Plantilla de Correo (Variante B)</FormLabel>
                                <Select onValueChange={field.onChange} value={field.value || ""}>
                                    <FormControl><SelectTrigger><SelectValue placeholder="Selecciona plantilla para Variante B" /></SelectTrigger></FormControl>
                                    <SelectContent>
                                        {emailTemplates.map(template => <SelectItem key={template.id} value={template.id}>{template.name}</SelectItem>)}
                                    </SelectContent>
                                </Select>
                                <FormMessage />
                            </FormItem>
                        )} />
                         <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
                            <FormField control={form.control} name="abTest.splitPercentage" render={({ field }) => (
                              <FormItem><FormLabel>División (%)</FormLabel><FormControl><Input type="number" placeholder="50" {...field} value={field.value ?? 50} onChange={e => field.onChange(parseInt(e.target.value))} /></FormControl>
                              <FormDescriptionUI className="text-xs">Ej: 50 para 50/50.</FormDescriptionUI><FormMessage /></FormItem>
                            )} />
                             <FormField control={form.control} name="abTest.winnerCriteria" render={({ field }) => (
                                <FormItem><FormLabel>Criterio Ganador</FormLabel>
                                <Select onValueChange={field.onChange} value={field.value || "open_rate"} disabled>
                                    <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                                    <SelectContent>
                                        <SelectItem value="open_rate">Tasa de Apertura</SelectItem>
                                        <SelectItem value="click_rate">Tasa de Clics</SelectItem>
                                    </SelectContent>
                                </Select>
                                <FormDescriptionUI className="text-xs">Lógica de selección auto (Próx.).</FormDescriptionUI><FormMessage /></FormItem>
                            )} />
                            <FormField control={form.control} name="abTest.testDurationHours" render={({ field }) => (
                              <FormItem><FormLabel>Duración (horas)</FormLabel><FormControl><Input type="number" placeholder="24" {...field} value={field.value ?? 24} onChange={e => field.onChange(parseInt(e.target.value))} /></FormControl>
                              <FormDescriptionUI className="text-xs">Tiempo de prueba (Próx.).</FormDescriptionUI><FormMessage /></FormItem>
                            )} />
                        </div>
                        <p className="text-xs text-muted-foreground pt-2">La lógica completa para dividir la lista, enviar variantes y determinar el ganador se implementará en el backend (Cloud Functions).</p>
                      </CardContent>
                    )}
                  </Card>
                </AccordionContent>
              </AccordionItem>
            </Accordion>


            <div className="p-4 border rounded-md bg-muted/50 text-sm text-muted-foreground">
              <Clock className="inline h-4 w-4 mr-2 text-blue-500" />
              <strong>Programación y Envío:</strong>
              <ul className="list-disc list-inside ml-4 mt-1 text-xs space-y-1">
                <li>Las campañas programadas son procesadas por una Cloud Function.</li>
                <li>El estado cambiará a &quot;Enviando&quot; cuando la Cloud Function comience el proceso.</li>
                <li>Las analíticas básicas (enviados/destinatarios) se actualizan tras el envío por la Cloud Function.</li>
                 <li><BarChart2 className="inline h-3 w-3 mr-1 text-purple-500" />Analíticas Detalladas (aperturas, clics): <span className="font-semibold text-green-600">Implementado (vía Webhook)</span>.</li>
                <li><TestTube2 className="inline h-3 w-3 mr-1 text-teal-500" />Pruebas A/B: <span className="font-semibold text-amber-600">UI Config. en Desarrollo</span>.</li>
              </ul>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isSubmitting}>
                Cancelar
              </Button>
              <Button type="submit" disabled={isSubmitting || !contactLists.length || !emailTemplates.length}>
                {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                {isSubmitting ? "Guardando..." : (campaignToEdit ? "Guardar Cambios" : "Crear Campaña")}
              </Button>
            </DialogFooter>
             {(!contactLists.length || !emailTemplates.length) && (
                <p className="text-xs text-destructive text-center mt-2">
                    Necesitas crear al menos una lista de contactos y una plantilla para poder crear una campaña.
                </p>
            )}
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
