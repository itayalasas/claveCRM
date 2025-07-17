
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
import { NAV_ITEMS } from "@/lib/constants";
import type { EmailSettings, SMTPSecurity, WhatsAppApiSettings } from "@/lib/types";
import { Settings, Mail, Share2Icon, AlertTriangle, Loader2, Eye, EyeOff, ShieldCheck, History, MessageCircle, Smartphone, UserCircle as UserCircleIcon, Frown } from "lucide-react";
import { db } from "@/lib/firebase";
import { doc, getDoc, setDoc, serverTimestamp, addDoc, collection, type Timestamp } from "firebase/firestore";
import { useToast } from "@/hooks/use-toast";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/contexts/auth-context";
import Link from "next/link";
import { useRouter } from "next/navigation";

const emailSettingsSchema = z.object({
  smtpHost: z.string().min(1, "El host SMTP es obligatorio."),
  smtpPort: z.coerce.number().int().positive("El puerto SMTP debe ser un número positivo."),
  smtpUser: z.string().min(1, "El usuario SMTP es obligatorio."),
  smtpPass: z.string().min(1, "La contraseña SMTP es obligatoria."),
  smtpSecurity: z.enum(["None", "SSL", "TLS"], { errorMap: () => ({ message: "Selecciona un tipo de seguridad."})}),
  defaultSenderEmail: z.string().email("El correo del remitente predeterminado es inválido."),
  defaultSenderName: z.string().min(1, "El nombre del remitente es obligatorio."),
  sendRateLimit: z.coerce.number().int().min(0, "El límite de envío no puede ser negativo.").optional(),
});

type EmailSettingsFormValues = z.infer<typeof emailSettingsSchema>;

const whatsAppApiSettingsSchema = z.object({
  phoneNumberId: z.string().optional(),
  wabaId: z.string().optional(),
  accessToken: z.string().optional(),
  webhookVerifyToken: z.string().optional(),
});
type WhatsAppApiSettingsFormValues = z.infer<typeof whatsAppApiSettingsSchema>;


export default function SettingsPage() {
  const navItem = NAV_ITEMS.flatMap(item => item.subItems || item).find(item => item.label === 'General' && item.href === '/settings');
  const PageIcon = navItem?.icon || Settings;
  const { toast } = useToast();
  const { currentUser, loading: authLoading, hasPermission } = useAuth();
  const router = useRouter(); // Initialize useRouter here

  const [isLoadingSettings, setIsLoadingSettings] = useState(true);
  const [isSavingEmail, setIsSavingEmail] = useState(false);
  const [isSavingWhatsApp, setIsSavingWhatsApp] = useState(false);
  const [showSmtpPass, setShowSmtpPass] = useState(false);

  const emailForm = useForm<EmailSettingsFormValues>({
    resolver: zodResolver(emailSettingsSchema),
    defaultValues: {
      smtpHost: "",
      smtpPort: 587,
      smtpUser: "",
      smtpPass: "",
      smtpSecurity: "TLS",
      defaultSenderEmail: "",
      defaultSenderName: "",
      sendRateLimit: 100,
    },
  });

  const whatsAppForm = useForm<WhatsAppApiSettingsFormValues>({
    resolver: zodResolver(whatsAppApiSettingsSchema),
    defaultValues: {
      phoneNumberId: "",
      wabaId: "",
      accessToken: "",
      webhookVerifyToken: "",
    },
  });

  useEffect(() => {
    if (!authLoading && !hasPermission('acceder-configuracion-general')) {
      router.push('/access-denied');
    }
  }, [authLoading, hasPermission, router]);


  useEffect(() => {
    const fetchAllSettings = async () => {
      if (!currentUser || !hasPermission('acceder-configuracion-general')) {
        setIsLoadingSettings(false);
        return;
      }
      setIsLoadingSettings(true);
      try {
        const emailSettingsDocRef = doc(db, "settings", "emailConfiguration");
        const emailDocSnap = await getDoc(emailSettingsDocRef);
        if (emailDocSnap.exists()) {
          emailForm.reset(emailDocSnap.data() as EmailSettingsFormValues);
        }

        const whatsAppSettingsDocRef = doc(db, "settings", "whatsAppApiConfiguration");
        const whatsAppDocSnap = await getDoc(whatsAppSettingsDocRef);
        if (whatsAppDocSnap.exists()) {
          whatsAppForm.reset(whatsAppDocSnap.data() as WhatsAppApiSettingsFormValues);
        }

      } catch (error) {
        console.error("Error al cargar configuración:", error);
        toast({
          title: "Error al Cargar Configuración",
          description: "No se pudo cargar la configuración.",
          variant: "destructive",
        });
      } finally {
        setIsLoadingSettings(false);
      }
    };
    fetchAllSettings();
  }, [emailForm, whatsAppForm, toast, currentUser, hasPermission]);

  const logSystemEvent = async (action: string, entityType: string, entityId: string, details: string) => {
    if (!currentUser) return;
    try {
      await addDoc(collection(db, "activityLogs"), {
        category: 'system_audit' as const,
        type: 'config_change' as const,
        subject: action,
        details: `${details} por ${currentUser.name}.`,
        timestamp: serverTimestamp(),
        loggedByUserId: currentUser.id,
        loggedByUserName: currentUser.name,
        entityType: entityType,
        entityId: entityId,
        createdAt: serverTimestamp(),
      });
    } catch (error) {
      console.error("Error logging system event:", error);
    }
  };

  const onEmailSubmitHandler: SubmitHandler<EmailSettingsFormValues> = async (data) => {
    setIsSavingEmail(true);
    try {
      const settingsDocRef = doc(db, "settings", "emailConfiguration");
      await setDoc(settingsDocRef, data, { merge: true });
      toast({
        title: "Configuración de Correo Guardada",
        description: "La configuración de correo electrónico ha sido actualizada.",
      });
      await logSystemEvent("Actualización Config. Email Sistema", "EmailSettings", "emailConfiguration", "Se actualizaron los ajustes de correo del sistema.");
    } catch (error) {
      console.error("Error al guardar configuración de correo:", error);
      toast({
        title: "Error al Guardar Correo",
        description: "No se pudo guardar la configuración de correo electrónico.",
        variant: "destructive",
      });
    } finally {
      setIsSavingEmail(false);
    }
  };

  const onWhatsAppSubmitHandler: SubmitHandler<WhatsAppApiSettingsFormValues> = async (data) => {
    setIsSavingWhatsApp(true);
    try {
      const settingsDocRef = doc(db, "settings", "whatsAppApiConfiguration");
      const dataToSave = Object.fromEntries(
        Object.entries(data).map(([key, value]) => [key, value === "" ? null : value])
      );
      await setDoc(settingsDocRef, dataToSave, { merge: true });
      toast({
        title: "Configuración de WhatsApp Guardada",
        description: "La configuración de la API de WhatsApp ha sido actualizada.",
      });
      await logSystemEvent("Actualización Config. WhatsApp", "WhatsAppApiSettings", "whatsAppApiConfiguration", "Se actualizaron los ajustes de la API de WhatsApp.");
    } catch (error) {
      console.error("Error al guardar configuración de WhatsApp:", error);
      toast({
        title: "Error al Guardar WhatsApp",
        description: "No se pudo guardar la configuración de WhatsApp.",
        variant: "destructive",
      });
    } finally {
      setIsSavingWhatsApp(false);
    }
  };


  return (
    authLoading ? (
      <div className="flex flex-col items-center justify-center h-[calc(100vh-var(--header-height,4rem))]">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
        <p className="mt-4 text-lg text-muted-foreground">Cargando configuración...</p>
      </div>
    ) : (!hasPermission('acceder-configuracion-general') ? (
       <div className="flex flex-col items-center justify-center h-[calc(100vh-var(--header-height,4rem))]">
         <Frown className="h-12 w-12 text-amber-500" />
         <p className="mt-4 text-xl font-semibold text-amber-700">Acceso Denegado</p>
         <p className="mt-2 text-muted-foreground">No tienes permiso para ver esta página.</p>
       </div>
    ) : (
    <div className="flex flex-col gap-8">
      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-2xl font-semibold">
            <PageIcon className="h-7 w-7 text-primary" />
            {navItem?.label || "Configuración del Sistema"}
          </CardTitle>
          <CardDescription>
            Administra la configuración global de tu CRM, integraciones y personalizaciones.
          </CardDescription>
        </CardHeader>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-xl">
              <Mail className="h-5 w-5 text-primary" />
              Configuración de Correo Electrónico del Sistema
            </CardTitle>
            <CardDescription>
              Configura los ajustes de tu servidor SMTP principal para el envío de campañas de email masivas y notificaciones transaccionales del sistema.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoadingSettings ? (
              <div className="space-y-4">
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-1/2" />
              </div>
            ) : (
              <Form {...emailForm}>
                <form onSubmit={emailForm.handleSubmit(onEmailSubmitHandler)} className="space-y-6">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <FormField
                      control={emailForm.control}
                      name="smtpHost"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Host SMTP</FormLabel>
                          <FormControl><Input placeholder="smtp.example.com" {...field} /></FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={emailForm.control}
                      name="smtpPort"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Puerto SMTP</FormLabel>
                          <FormControl><Input type="number" placeholder="587" {...field} /></FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <FormField
                        control={emailForm.control}
                        name="smtpUser"
                        render={({ field }) => (
                            <FormItem>
                            <FormLabel>Usuario SMTP</FormLabel>
                            <FormControl><Input placeholder="usuario@example.com" {...field} /></FormControl>
                            <FormMessage />
                            </FormItem>
                        )}
                        />
                    <FormField
                        control={emailForm.control}
                        name="smtpPass"
                        render={({ field }) => (
                            <FormItem>
                            <FormLabel>Contraseña SMTP</FormLabel>
                            <div className="relative">
                                <FormControl><Input type={showSmtpPass ? "text" : "password"} placeholder="••••••••" {...field} /></FormControl>
                                <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className="absolute right-0 top-0 h-full px-3"
                                onClick={() => setShowSmtpPass(!showSmtpPass)}
                                >
                                {showSmtpPass ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                                </Button>
                            </div>
                            <FormMessage />
                            </FormItem>
                        )}
                        />
                  </div>
                  <FormField
                    control={emailForm.control}
                    name="smtpSecurity"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Seguridad SMTP</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value} value={field.value}>
                          <FormControl><SelectTrigger><SelectValue placeholder="Selecciona un tipo" /></SelectTrigger></FormControl>
                          <SelectContent>
                            <SelectItem value="None">None</SelectItem>
                            <SelectItem value="SSL">SSL</SelectItem>
                            <SelectItem value="TLS">TLS</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <FormField
                      control={emailForm.control}
                      name="defaultSenderEmail"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Email Remitente Predeterminado</FormLabel>
                          <FormControl><Input type="email" placeholder="noreply@example.com" {...field} /></FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                     <FormField
                      control={emailForm.control}
                      name="defaultSenderName"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Nombre Remitente Predeterminado</FormLabel>
                          <FormControl><Input placeholder="Tu Empresa" {...field} /></FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                   <FormField
                      control={emailForm.control}
                      name="sendRateLimit"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Límite de Envío (emails/hora)</FormLabel>
                          <FormControl><Input type="number" placeholder="100" {...field} /></FormControl>
                          <FormDescriptionUI>Opcional. Límite de correos que se pueden enviar por hora desde el sistema.</FormDescriptionUI>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  <div className="p-3 border border-amber-500 bg-amber-50 rounded-md text-amber-700 text-sm flex items-start gap-2">
                    <AlertTriangle className="h-5 w-5 mt-0.5 shrink-0" />
                    <div>
                      <span className="font-semibold">Nota de Seguridad Importante:</span> Las credenciales SMTP (usuario/contraseña) se almacenarán en Firestore. Asegúrate de que tus reglas de seguridad de Firestore protejan adecuadamente el documento `settings/emailConfiguration`.
                    </div>
                  </div>
                  <CardFooter className="p-0 pt-4">
                    <Button type="submit" disabled={isSavingEmail}>
                      {isSavingEmail && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                      Guardar Configuración de Correo del Sistema
                    </Button>
                  </CardFooter>
                </form>
              </Form>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-xl">
              <Smartphone className="h-5 w-5 text-primary" />
              Integración WhatsApp Business API
            </CardTitle>
            <CardDescription>
              Configura la conexión con la API de WhatsApp Business. (Funcionalidad avanzada, requiere aprobación de Meta).
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoadingSettings ? (
              <div className="space-y-4">
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
              </div>
            ) : (
            <Form {...whatsAppForm}>
                <form onSubmit={whatsAppForm.handleSubmit(onWhatsAppSubmitHandler)} className="space-y-6">
                    <FormField
                        control={whatsAppForm.control}
                        name="phoneNumberId"
                        render={({ field }) => (
                            <FormItem>
                            <FormLabel>ID del Número de Teléfono</FormLabel>
                            <FormControl><Input placeholder="Ej. 123456789012345" {...field} value={field.value ?? ""} /></FormControl>
                            <FormDescriptionUI>Obtenido desde tu panel de desarrollador de Meta.</FormDescriptionUI>
                            <FormMessage />
                            </FormItem>
                        )}
                    />
                    <FormField
                        control={whatsAppForm.control}
                        name="wabaId"
                        render={({ field }) => (
                            <FormItem>
                            <FormLabel>ID de Cuenta de WhatsApp Business (WABA ID)</FormLabel>
                            <FormControl><Input placeholder="Ej. 987654321098765" {...field} value={field.value ?? ""} /></FormControl>
                             <FormDescriptionUI>ID de tu cuenta empresarial en Meta.</FormDescriptionUI>
                            <FormMessage />
                            </FormItem>
                        )}
                    />
                    <FormField
                        control={whatsAppForm.control}
                        name="accessToken"
                        render={({ field }) => (
                            <FormItem>
                            <FormLabel>Token de Acceso Permanente</FormLabel>
                            <FormControl><Input type="password" placeholder="Pega tu token de acceso aquí" {...field} value={field.value ?? ""} /></FormControl>
                            <FormDescriptionUI>Token generado para tu aplicación en Meta. Mantén esto seguro.</FormDescriptionUI>
                            <FormMessage />
                            </FormItem>
                        )}
                    />
                     <FormField
                        control={whatsAppForm.control}
                        name="webhookVerifyToken"
                        render={({ field }) => (
                            <FormItem>
                            <FormLabel>Token de Verificación del Webhook</FormLabel>
                            <FormControl><Input placeholder="Crea un token seguro" {...field} value={field.value ?? ""} /></FormControl>
                            <FormDescriptionUI>Token que usarás para verificar las solicitudes a tu webhook desde Meta.</FormDescriptionUI>
                            <FormMessage />
                            </FormItem>
                        )}
                    />
                     <div className="p-3 border border-amber-500 bg-amber-50 rounded-md text-amber-700 text-sm flex items-start gap-2">
                        <AlertTriangle className="h-5 w-5 mt-0.5 shrink-0" />
                        <div>
                        <span className="font-semibold">Importante:</span> Esta configuración es solo para almacenar tus credenciales. La lógica para enviar/recibir mensajes de WhatsApp y configurar el webhook debe implementarse en tu backend (Firebase Cloud Functions). Los tokens deben manejarse con extrema seguridad.
                        </div>
                    </div>
                    <CardFooter className="p-0 pt-4">
                        <Button type="submit" disabled={isSavingWhatsApp}>
                        {isSavingWhatsApp && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        Guardar Configuración de WhatsApp
                        </Button>
                    </CardFooter>
                </form>
            </Form>
            )}
          </CardContent>
        </Card>
      </div>
      
      <Card className="mt-2">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-xl">
            <UserCircleIcon className="h-5 w-5 text-primary" />
            Mi Cuenta de Correo Personal (Para Envíos Individuales)
          </CardTitle>
          <CardDescription>
            Conecta tu propia cuenta de correo (ej. Gmail, Outlook) para enviar y recibir correos individuales directamente desde el módulo de "Correo Electrónico" del CRM.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground mb-3">
            Esta configuración te permitirá usar tu dirección de correo personal en lugar del correo del sistema para tus comunicaciones uno a uno.
          </p>
          <Button asChild>
            <Link href="/settings/my-email-account">
              Configurar Mi Cuenta de Correo
            </Link>
          </Button>
           <p className="text-xs text-amber-600 mt-2 flex items-center gap-1">
            <AlertTriangle className="h-3 w-3" />
            Importante: La gestión segura de credenciales para cuentas personales es compleja y debe implementarse con cuidado en el backend.
          </p>
        </CardContent>
      </Card>

      <Card className="mt-2">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-xl">
            <ShieldCheck className="h-5 w-5 text-primary" />
            Seguridad y Auditoría
          </CardTitle>
          <CardDescription>
            Configuraciones de seguridad y acceso al historial de auditoría del sistema.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
            <div>
              <h4 className="font-semibold">Autenticación Multifactor (MFA)</h4>
              <p className="text-sm text-muted-foreground">
                La MFA se gestiona directamente en la consola de Firebase para cada cuenta de usuario.
                <a href="https://console.firebase.google.com/" target="_blank" rel="noopener noreferrer" className="text-primary underline ml-1">
                  Ir a Firebase Console
                </a>
              </p>
               <p className="text-xs text-muted-foreground mt-1">
                Se recomienda habilitar MFA para todos los usuarios, especialmente administradores.
              </p>
            </div>
            <div>
              <h4 className="font-semibold">Roles y Permisos</h4>
              <p className="text-sm text-muted-foreground">
                La asignación de roles a los usuarios se realiza en la sección de <Link href="/user-management" className="text-primary underline">Gestión de Usuarios</Link>.
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                Permisos más granulares por módulo o acción podrían implementarse en futuras versiones.
              </p>
            </div>
             <div>
              <h4 className="font-semibold">Historial de Auditoría</h4>
              <p className="text-sm text-muted-foreground">
                Consulta el registro de acciones importantes realizadas en el sistema.
              </p>
              <Button variant="outline" size="sm" asChild className="mt-2">
                <Link href="/audit-log">
                  <History className="mr-2 h-4 w-4" /> Ver Historial de Auditoría
                </Link>
              </Button>
            </div>
        </CardContent>
      </Card>

      <Card className="mt-2">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-xl">
            <MessageCircle className="h-5 w-5 text-primary" />
            Configuración del Widget de Chat en Vivo
          </CardTitle>
          <CardDescription>
            Personaliza la apariencia y el comportamiento del widget de chat en vivo para tu sitio web.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground mb-3">
            Define cómo se verá y funcionará el chat en tu página.
          </p>
          <Button asChild>
            <Link href="/settings/live-chat-widget">
              Ir a Configuración del Chat en Vivo
            </Link>
          </Button>
        </CardContent>
      </Card>

       <Card className="mt-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-xl">
              <Share2Icon className="h-5 w-5 text-primary" />
              Otras Integraciones
            </CardTitle>
            <CardDescription>
              Conecta tu CRM con otras herramientas y plataformas (Facebook, Instagram, LinkedIn, etc.).
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
               <p className="text-sm text-muted-foreground">
                Aquí podrás autorizar el acceso a otras plataformas.
              </p>
              <p className="mt-4 text-sm font-semibold text-accent-foreground">
                Otras integraciones están en desarrollo.
              </p>
            </div>
          </CardContent>
        </Card>
    </div>
    ))
  );
}
