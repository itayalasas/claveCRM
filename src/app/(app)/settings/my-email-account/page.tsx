
"use client";

import { useState, useEffect } from "react";
import { useForm, type SubmitHandler } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription as FormDescriptionUI } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { UserEmailAccountSettings, SMTPSecurity, User } from "@/lib/types";
import { Mail, Loader2, Eye, EyeOff, AlertTriangle, UserCircle } from "lucide-react";
import { db } from "@/lib/firebase";
import { doc, getDoc, setDoc, serverTimestamp } from "firebase/firestore";
import { useToast } from "@/hooks/use-toast";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/contexts/auth-context";

const emailAccountSettingsSchema = z.object({
  imapHost: z.string().min(1, "Host IMAP es obligatorio."),
  imapPort: z.coerce.number().int().positive("Puerto IMAP debe ser positivo."),
  imapSecurity: z.enum(["None", "SSL", "TLS"]),
  smtpHost: z.string().min(1, "Host SMTP es obligatorio."),
  smtpPort: z.coerce.number().int().positive("Puerto SMTP debe ser positivo."),
  smtpSecurity: z.enum(["None", "SSL", "TLS"]),
  username: z.string().email("Nombre de usuario (email) inválido."),
  password: z.string().min(1, "La contraseña es obligatoria."),
});

type EmailAccountSettingsFormValues = z.infer<typeof emailAccountSettingsSchema>;

export default function MyEmailAccountPage() {
  const { toast } = useToast();
  const { currentUser } = useAuth();
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const form = useForm<EmailAccountSettingsFormValues>({
    resolver: zodResolver(emailAccountSettingsSchema),
    defaultValues: {
      imapHost: "mail.clavecrm.com",
      imapPort: 993,
      imapSecurity: "SSL",
      smtpHost: "mail.clavecrm.com",
      smtpPort: 465,
      smtpSecurity: "SSL",
      username: "",
      password: "",
    },
  });

  useEffect(() => {
    const fetchSettings = async () => {
      if (!currentUser) {
        setIsLoading(false);
        return;
      }
      setIsLoading(true);
      try {
        const settingsDocRef = doc(db, "userSettings", currentUser.id, "emailAccountConfiguration", "config");
        const docSnap = await getDoc(settingsDocRef);
        if (docSnap.exists()) {
          form.reset(docSnap.data() as EmailAccountSettingsFormValues);
        } else if (currentUser.email) {
            form.setValue("username", currentUser.email);
        }
      } catch (error) {
        console.error("Error al cargar configuración de cuenta de correo:", error);
        toast({
          title: "Error al Cargar Configuración",
          variant: "destructive",
        });
      } finally {
        setIsLoading(false);
      }
    };
    if (currentUser) {
        fetchSettings();
    } else {
        setIsLoading(false);
    }
  }, [currentUser, form, toast]);

  const onSubmitHandler: SubmitHandler<EmailAccountSettingsFormValues> = async (data) => {
    if (!currentUser) {
      toast({ title: "Error de autenticación", variant: "destructive" });
      return;
    }
    setIsSaving(true);
    try {
      // Path to the specific config document within the subcollection
      const settingsDocRef = doc(db, "userSettings", currentUser.id, "emailAccountConfiguration", "config");
      await setDoc(settingsDocRef, data, { merge: true });

      // Ensure the parent userSettings/{userId} document exists with at least one field
      // This makes the document discoverable by collection queries on "userSettings"
      const parentUserSettingDocRef = doc(db, "userSettings", currentUser.id);
      await setDoc(parentUserSettingDocRef, { lastEmailConfiguredAt: serverTimestamp() }, { merge: true });

      toast({
        title: "Configuración Guardada",
        description: "Tu configuración de cuenta de correo personal ha sido guardada.",
      });
    } catch (error) {
      console.error("Error al guardar configuración de cuenta de correo:", error);
      toast({
        title: "Error al Guardar",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading && !currentUser) {
    return (
      <div className="flex justify-center items-center min-h-[300px]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }
  if (!currentUser) {
     return (
        <Card className="m-auto mt-10 max-w-md">
            <CardHeader>
                <CardTitle>Acceso Denegado</CardTitle>
                <CardDescription>Debes iniciar sesión para configurar tu cuenta de correo.</CardDescription>
            </CardHeader>
        </Card>
     )
  }


  return (
    <div className="flex flex-col gap-8">
      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-2xl font-semibold">
            <Mail className="h-7 w-7 text-primary" />
            Configuración de Mi Cuenta de Correo Personal
          </CardTitle>
          <CardDescription>
            Conecta tu propia cuenta de correo para enviar y recibir emails directamente desde el módulo "Correo Electrónico" del CRM.
            Esta configuración se usará para acceder a tu buzón IMAP (recibir) y enviar correos vía SMTP.
          </CardDescription>
        </CardHeader>
      </Card>

      <Card>
        <CardHeader>
            <CardTitle>Detalles de Conexión</CardTitle>
        </CardHeader>
        <CardContent>
        {isLoading ? (
          <div className="space-y-6">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-10 w-1/2" />
          </div>
        ) : (
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmitHandler)} className="space-y-6">
              <div>
                <h3 className="text-lg font-medium mb-2 text-primary">Configuración IMAP (Recepción)</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <FormField control={form.control} name="imapHost" render={({ field }) => (
                    <FormItem><FormLabel>Host IMAP</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                  )} />
                  <FormField control={form.control} name="imapPort" render={({ field }) => (
                    <FormItem><FormLabel>Puerto IMAP</FormLabel><FormControl><Input type="number" {...field} /></FormControl><FormMessage /></FormItem>
                  )} />
                  <FormField control={form.control} name="imapSecurity" render={({ field }) => (
                    <FormItem><FormLabel>Seguridad IMAP</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                        <SelectContent><SelectItem value="None">None</SelectItem><SelectItem value="SSL">SSL/TLS</SelectItem><SelectItem value="TLS">STARTTLS</SelectItem></SelectContent>
                      </Select><FormMessage /></FormItem>
                  )} />
                </div>
              </div>

              <div>
                <h3 className="text-lg font-medium mb-2 mt-4 text-primary">Configuración SMTP (Envío)</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <FormField control={form.control} name="smtpHost" render={({ field }) => (
                    <FormItem><FormLabel>Host SMTP</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                  )} />
                  <FormField control={form.control} name="smtpPort" render={({ field }) => (
                    <FormItem><FormLabel>Puerto SMTP</FormLabel><FormControl><Input type="number" {...field} /></FormControl><FormMessage /></FormItem>
                  )} />
                   <FormField control={form.control} name="smtpSecurity" render={({ field }) => (
                    <FormItem><FormLabel>Seguridad SMTP</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                        <SelectContent><SelectItem value="None">None</SelectItem><SelectItem value="SSL">SSL/TLS</SelectItem><SelectItem value="TLS">STARTTLS</SelectItem></SelectContent>
                      </Select><FormMessage /></FormItem>
                  )} />
                </div>
              </div>

              <div>
                <h3 className="text-lg font-medium mb-2 mt-4 text-primary">Credenciales de la Cuenta</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormField control={form.control} name="username" render={({ field }) => (
                        <FormItem><FormLabel>Nombre de Usuario (Email)</FormLabel><FormControl><Input type="email" placeholder="tu.email@ejemplo.com" {...field} /></FormControl><FormMessage /></FormItem>
                    )} />
                    <FormField control={form.control} name="password" render={({ field }) => (
                        <FormItem>
                        <FormLabel>Contraseña de Aplicación / Contraseña</FormLabel>
                        <div className="relative">
                            <FormControl><Input type={showPassword ? "text" : "password"} placeholder="••••••••" {...field} /></FormControl>
                            <Button type="button" variant="ghost" size="icon" className="absolute right-0 top-0 h-full px-3" onClick={() => setShowPassword(!showPassword)}>
                            {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                            </Button>
                        </div>
                        <FormDescriptionUI className="text-xs">Para Gmail/Outlook, generalmente necesitarás una "Contraseña de Aplicación".</FormDescriptionUI>
                        <FormMessage />
                        </FormItem>
                    )} />
                </div>
              </div>
              <div className="p-3 border border-amber-500 bg-amber-50 rounded-md text-amber-700 text-sm flex items-start gap-2">
                <AlertTriangle className="h-5 w-5 mt-0.5 shrink-0" />
                <div>
                  <span className="font-semibold">Importante:</span> La funcionalidad de conectar cuentas de correo personales es compleja. El almacenamiento y uso seguro de contraseñas de correo requiere una infraestructura de backend robusta y medidas de seguridad que van más allá de este prototipo de UI. En un entorno de producción, las contraseñas NUNCA deben guardarse en texto plano.
                </div>
              </div>
              <Button type="submit" disabled={isSaving || isLoading}>
                {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Guardar Configuración de Correo Personal
              </Button>
            </form>
          </Form>
        )}
        </CardContent>
      </Card>
    </div>
  );
}
