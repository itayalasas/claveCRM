
"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { LiveChatWidgetSettingsForm } from "@/components/settings/live-chat-widget-form";
import { ChatWidgetPreview } from "@/components/live-chat/chat-widget-preview";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import type { LiveChatWidgetSettings } from "@/lib/types";
import { db } from "@/lib/firebase";
import { doc, getDoc } from "firebase/firestore";
import { useToast } from "@/hooks/use-toast";
import { Skeleton } from "@/components/ui/skeleton";
import { MessageCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Copy } from "lucide-react";

const DEFAULT_WIDGET_SETTINGS: LiveChatWidgetSettings = {
  widgetEnabled: true,
  primaryColor: "#29ABE2",
  welcomeMessage: "¡Hola! ¿En qué podemos ayudarte hoy?",
  chatHeaderText: "Chatea con Nosotros",
  widgetPosition: "bottom-right",
};

export default function LiveChatWidgetSettingsPage() {
  const [settings, setSettings] = useState<LiveChatWidgetSettings>(DEFAULT_WIDGET_SETTINGS);
  const [isLoading, setIsLoading] = useState(true);
  const [embedScript, setEmbedScript] = useState("");
  const { toast } = useToast();

  useEffect(() => {
    const fetchSettings = async () => {
      setIsLoading(true);
      try {
        const settingsDocRef = doc(db, "settings", "liveChatWidgetConfiguration");
        const docSnap = await getDoc(settingsDocRef);
        if (docSnap.exists()) {
          setSettings(docSnap.data() as LiveChatWidgetSettings);
        } else {
          setSettings(DEFAULT_WIDGET_SETTINGS); // Set defaults if not found
        }
      } catch (error) {
        console.error("Error fetching live chat widget settings:", error);
        toast({
          title: "Error al Cargar Configuración",
          description: "No se pudo cargar la configuración del widget de chat.",
          variant: "destructive",
        });
      } finally {
        setIsLoading(false);
      }
    };
    fetchSettings();
  }, [toast]);

  useEffect(() => {
    // Dynamically determine the base URL for the script
    // In development, this will be localhost. In production, this will be your deployed domain.
    const scriptBaseUrl = typeof window !== 'undefined' ? window.location.origin : '';
    
    const generatedEmbedScript = `
<script>
  (function() {
    // Define settings for the widget
    window.CRMRapidoChatSettings = ${JSON.stringify(settings, null, 2)};

    // Create a script tag to load the main widget logic
    var script = document.createElement('script');
    script.src = "${scriptBaseUrl}/live-chat-widget.js"; // Loads from the public folder of your CRM app
    script.async = true;
    document.body.appendChild(script);

    console.log("CRM Rápido: Cargador del widget de chat inicializado. Cargando widget desde:", script.src);
  })();
</script>
  `.trim();
    setEmbedScript(generatedEmbedScript);
  }, [settings]);


  const handleSettingsSaved = (newSettings: LiveChatWidgetSettings) => {
    setSettings(newSettings);
  };
  
  const handleCopyToClipboard = () => {
    if (embedScript) {
      navigator.clipboard.writeText(embedScript)
        .then(() => {
          toast({ title: "¡Copiado al Portapapeles!", description: "Script de incrustación copiado." });
        })
        .catch(err => {
          console.error('Error al copiar: ', err);
          toast({ title: "Error al Copiar", description: "No se pudo copiar al portapapeles.", variant: "destructive" });
        });
    }
  };


  return (
    <div className="flex flex-col gap-8">
      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-2xl font-semibold">
            <MessageCircle className="h-7 w-7 text-primary" />
            Configuración del Widget de Chat en Vivo
          </CardTitle>
          <CardDescription>
            Personaliza cómo se ve y se comporta el widget de chat en tu sitio web.
          </CardDescription>
        </CardHeader>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle>Ajustes del Widget</CardTitle>
              <CardDescription>
                Modifica la apariencia y los mensajes predeterminados del widget.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="space-y-6">
                  <Skeleton className="h-10 w-full" />
                  <Skeleton className="h-20 w-full" />
                  <Skeleton className="h-10 w-1/2" />
                </div>
              ) : (
                <LiveChatWidgetSettingsForm
                  currentSettings={settings}
                  onSettingsSaved={handleSettingsSaved}
                />
              )}
            </CardContent>
          </Card>
        </div>

        <div className="lg:col-span-1 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Vista Previa del Widget</CardTitle>
              <CardDescription>Así se verá el widget con la configuración actual.</CardDescription>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <Skeleton className="h-80 w-full" /> 
              ) : (
                <ChatWidgetPreview settings={settings} />
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Script de Incrustación</CardTitle>
              <CardDescription>
                Copia y pega este código en las páginas de tu sitio web donde quieras mostrar el chat.
                Colócalo justo antes de la etiqueta de cierre `&lt;/body&gt;`.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Label htmlFor="embed-script" className="sr-only">Script de Incrustación</Label>
              <Textarea
                id="embed-script"
                readOnly
                value={embedScript}
                className="h-48 font-mono text-xs bg-muted"
                rows={10}
              />
               <Button onClick={handleCopyToClipboard} className="mt-2 w-full" variant="outline" size="sm" disabled={!embedScript}>
                <Copy className="mr-2 h-4 w-4" /> Copiar Script
              </Button>
              <p className="text-xs text-muted-foreground mt-2">
                Nota: La funcionalidad completa del chat en vivo (conexión a Firebase, mensajería en tiempo real)
                se implementará en `live-chat-widget.js`. Este script solo carga el widget.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
