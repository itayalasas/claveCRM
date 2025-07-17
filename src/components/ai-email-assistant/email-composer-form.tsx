"use client";

import { useForm, SubmitHandler } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import type { EmailDraftInput } from "@/ai/flows/email-generation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Sparkles } from "lucide-react";
import { NAV_ITEMS } from "@/lib/constants";


const formSchema = z.object({
  leadName: z.string().min(1, "El nombre del cliente potencial es obligatorio"),
  leadDetails: z.string().min(10, "Los detalles del cliente potencial deben tener al menos 10 caracteres"),
  salesAgentName: z.string().min(1, "El nombre del agente de ventas es obligatorio"),
  companyName: z.string().min(1, "El nombre de la empresa es obligatorio"),
  companyDescription: z.string().min(10, "La descripción de la empresa debe tener al menos 10 caracteres"),
  emailPurpose: z.string().min(5, "El propósito del correo debe tener al menos 5 caracteres"),
});

interface EmailComposerFormProps {
  onSubmit: (data: EmailDraftInput) => Promise<void>;
  isLoading: boolean;
}

export function EmailComposerForm({ onSubmit, isLoading }: EmailComposerFormProps) {
  const emailAssistantNavItem = NAV_ITEMS.find(item => item.href === '/ai-email-assistant');

  const form = useForm<EmailDraftInput>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      leadName: "",
      leadDetails: "",
      salesAgentName: "Tu Nombre",
      companyName: "Tu Compañía",
      companyDescription: "",
      emailPurpose: "Contacto inicial",
    },
  });

  const handleFormSubmit: SubmitHandler<EmailDraftInput> = async (data) => {
    await onSubmit(data);
  };

  return (
    <Card className="w-full max-w-2xl shadow-lg">
      <CardHeader>
        <CardTitle className="text-2xl flex items-center gap-2">
          <Sparkles className="h-6 w-6 text-primary" />
          {emailAssistantNavItem ? emailAssistantNavItem.label : "Asistente IA de Correo"}
        </CardTitle>
        <CardDescription>
          Proporciona los detalles a continuación y deja que la IA elabore un borrador de correo personalizado para tu cliente potencial.
        </CardDescription>
      </CardHeader>
      <Form {...form}>
        <form onSubmit={form.handleSubmit(handleFormSubmit)}>
          <CardContent className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <FormField
                control={form.control}
                name="leadName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nombre del Cliente Potencial</FormLabel>
                    <FormControl>
                      <Input placeholder="ej., Ana Pérez" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="salesAgentName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Tu Nombre (Agente de Ventas)</FormLabel>
                    <FormControl>
                      <Input placeholder="ej., Juan García" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            
            <FormField
              control={form.control}
              name="leadDetails"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Detalles del Cliente Potencial</FormLabel>
                  <FormControl>
                    <Textarea placeholder="ej., Interesado en el producto X, nos conocimos en la conferencia Y, trabaja en Z Corp..." {...field} rows={3} />
                  </FormControl>
                  <FormDescription>Proporciona contexto sobre el cliente potencial y su empresa.</FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
               <FormField
                control={form.control}
                name="companyName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nombre de Tu Compañía</FormLabel>
                    <FormControl>
                      <Input placeholder="ej., Innovaciones Acme" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="emailPurpose"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Propósito del Correo</FormLabel>
                    <FormControl>
                      <Input placeholder="ej., Seguimiento, Introducción, Solicitud de demo" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            
            <FormField
              control={form.control}
              name="companyDescription"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Descripción de Tu Compañía</FormLabel>
                  <FormControl>
                    <Textarea placeholder="ej., Ayudamos a las empresas a lograr X proporcionando soluciones Y..." {...field} rows={3} />
                  </FormControl>
                  <FormDescription>Una breve descripción de lo que hace tu empresa.</FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
          </CardContent>
          <CardFooter>
            <Button type="submit" disabled={isLoading} className="w-full md:w-auto">
              {isLoading ? (
                <div className="flex items-center">
                  <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Generando...
                </div>
              ) : (
                <div className="flex items-center">
                  <Sparkles className="mr-2 h-5 w-5" /> Generar Borrador de Correo
                </div>
              )}
            </Button>
          </CardFooter>
        </form>
      </Form>
    </Card>
  );
}
