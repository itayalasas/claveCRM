
"use client";

import { useState, useEffect } from "react";
import { useForm, type SubmitHandler } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import type { LiveChatWidgetSettings } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { db } from "@/lib/firebase";
import { doc, setDoc } from "firebase/firestore";
import { useAuth } from "@/contexts/auth-context";
import { logSystemEvent } from "@/lib/auditLogger";

const formSchema = z.object({
  widgetEnabled: z.boolean().default(true),
  primaryColor: z.string()
    .regex(/^#([0-9A-Fa-f]{3}){1,2}$/, "Debe ser un código hexadecimal válido (ej. #FF0000).")
    .default("#29ABE2"),
  welcomeMessage: z.string().min(5, "El mensaje de bienvenida es muy corto.").max(200, "El mensaje de bienvenida es muy largo.").default("¡Hola! ¿En qué podemos ayudarte hoy?"),
  chatHeaderText: z.string().optional().default("Chatea con Nosotros"),
  widgetPosition: z.enum(["bottom-right", "bottom-left"]).default("bottom-right"),
});

type LiveChatWidgetFormValues = z.infer<typeof formSchema>;

interface LiveChatWidgetSettingsFormProps {
  currentSettings: LiveChatWidgetSettings;
  onSettingsSaved: (newSettings: LiveChatWidgetSettings) => void;
}

export function LiveChatWidgetSettingsForm({ currentSettings, onSettingsSaved }: LiveChatWidgetSettingsFormProps) {
  const [isSaving, setIsSaving] = useState(false);
  const { toast } = useToast();
  const { currentUser } = useAuth();

  const form = useForm<LiveChatWidgetFormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: currentSettings,
  });

  useEffect(() => {
    form.reset(currentSettings);
  }, [currentSettings, form]);

  const onSubmitHandler: SubmitHandler<LiveChatWidgetFormValues> = async (data) => {
    if (!currentUser) {
      toast({ title: "Error de autenticación", variant: "destructive" });
      return;
    }
    setIsSaving(true);
    try {
      const settingsDocRef = doc(db, "settings", "liveChatWidgetConfiguration");
      await setDoc(settingsDocRef, data, { merge: true });
      onSettingsSaved(data);
      toast({
        title: "Configuración Guardada",
        description: "La configuración del widget de chat ha sido actualizada.",
      });
      await logSystemEvent(currentUser, 'config_change', 'LiveChatWidgetSettings', 'liveChatWidgetConfiguration', 'Se actualizaron los ajustes del widget de chat en vivo.');
    } catch (error) {
      console.error("Error al guardar configuración del widget de chat:", error);
      toast({
        title: "Error al Guardar",
        description: "No se pudo guardar la configuración del widget de chat.",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmitHandler)} className="space-y-6">
        <FormField
          control={form.control}
          name="widgetEnabled"
          render={({ field }) => (
            <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3 shadow-sm">
              <div className="space-y-0.5">
                <FormLabel>Habilitar Widget de Chat</FormLabel>
                <FormDescription>
                  Activa o desactiva el widget de chat en tu sitio web.
                </FormDescription>
              </div>
              <FormControl>
                <Switch
                  checked={field.value}
                  onCheckedChange={field.onChange}
                  disabled={isSaving}
                />
              </FormControl>
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="primaryColor"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Color Principal del Widget</FormLabel>
              <div className="flex items-center gap-2">
                <FormControl>
                  <Input type="text" placeholder="#29ABE2" {...field} className="w-1/2" disabled={isSaving} />
                </FormControl>
                <Input 
                    type="color" 
                    value={field.value} 
                    onChange={(e) => field.onChange(e.target.value)} 
                    className="w-10 h-10 p-0 border-0 rounded-md"
                    disabled={isSaving}
                />
              </div>
              <FormDescription>El color principal para el botón y la cabecera del chat (formato HEX).</FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />
        
        <FormField
          control={form.control}
          name="chatHeaderText"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Texto de Cabecera del Chat</FormLabel>
              <FormControl>
                <Input placeholder="Ej. Chatea con Nosotros" {...field} disabled={isSaving} />
              </FormControl>
              <FormDescription>El título que aparecerá en la parte superior de la ventana de chat.</FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="welcomeMessage"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Mensaje de Bienvenida</FormLabel>
              <FormControl>
                <Textarea placeholder="Ej. ¡Hola! ¿Cómo podemos ayudarte hoy?" {...field} rows={3} disabled={isSaving} />
              </FormControl>
              <FormDescription>El primer mensaje que verá el visitante al abrir el chat.</FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />
        
        <FormField
          control={form.control}
          name="widgetPosition"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Posición del Widget</FormLabel>
              <Select onValueChange={field.onChange} value={field.value} disabled={isSaving}>
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecciona una posición" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  <SelectItem value="bottom-right">Abajo a la Derecha</SelectItem>
                  <SelectItem value="bottom-left">Abajo a la Izquierda</SelectItem>
                </SelectContent>
              </Select>
              <FormDescription>Dónde aparecerá el botón del widget en la pantalla.</FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        <Button type="submit" disabled={isSaving}>
          {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
          Guardar Configuración del Widget
        </Button>
      </form>
    </Form>
  );
}
