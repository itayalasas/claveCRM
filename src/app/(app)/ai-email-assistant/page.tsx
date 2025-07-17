"use client";

import { useState } from "react";
import { EmailComposerForm } from "@/components/ai-email-assistant/email-composer-form";
import { generateEmailDraft, type EmailDraftInput, type EmailDraftOutput } from "@/ai/flows/email-generation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Copy } from "lucide-react";

export default function AiEmailAssistantPage() {
  const [generatedEmail, setGeneratedEmail] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  const handleSubmit = async (data: EmailDraftInput) => {
    setIsLoading(true);
    setGeneratedEmail(null);
    try {
      const result: EmailDraftOutput = await generateEmailDraft(data);
      setGeneratedEmail(result.emailDraft);
      toast({
        title: "¡Borrador de Correo Generado!",
        description: "Tu borrador de correo personalizado está listo abajo.",
        variant: "default",
      });
    } catch (error) {
      console.error("Error generating email draft:", error);
      toast({
        title: "Error al Generar Correo",
        description: "Ocurrió un error inesperado. Por favor, inténtalo de nuevo.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleCopyToClipboard = () => {
    if (generatedEmail) {
      navigator.clipboard.writeText(generatedEmail)
        .then(() => {
          toast({ title: "¡Copiado al Portapapeles!", description: "Borrador de correo copiado." });
        })
        .catch(err => {
          console.error('Failed to copy: ', err);
          toast({ title: "Error al Copiar", description: "No se pudo copiar al portapapeles.", variant: "destructive" });
        });
    }
  };

  return (
    // CAMBIO: Añadido w-full al contenedor principal. Eliminado p-0 de md para que use el padding del layout.
    <div className="flex flex-col items-center gap-8 p-4 md:p-0 w-full">
      {/* EmailComposerForm probablemente ya maneja su propio ancho/max-width, lo dejamos como está */}
      <EmailComposerForm onSubmit={handleSubmit} isLoading={isLoading} />

      {isLoading && (
        // CAMBIO: Asegurar que el Card de carga también use w-full para consistencia si el contenido es ancho.
        <Card className="w-full max-w-2xl animate-pulse">
          <CardHeader>
            <CardTitle>Generando Borrador de Correo...</CardTitle>
            <CardDescription>Por favor, espera mientras la IA elabora tu correo.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="h-4 bg-muted rounded w-3/4"></div>
            <div className="h-4 bg-muted rounded w-full"></div>
            <div className="h-4 bg-muted rounded w-full"></div>
            <div className="h-4 bg-muted rounded w-1/2"></div>
          </CardContent>
        </Card>
      )}

      {generatedEmail && !isLoading && (
        // CAMBIO: Asegurar que el Card del resultado también use w-full para consistencia.
        <Card className="w-full max-w-2xl shadow-lg">
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>Borrador de Correo Generado</CardTitle>
              <CardDescription>Revisa y copia el borrador a continuación.</CardDescription>
            </div>
            <Button variant="outline" size="icon" onClick={handleCopyToClipboard} aria-label="Copiar borrador de correo">
              <Copy className="h-5 w-5" />
            </Button>
          </CardHeader>
          <CardContent>
            <pre className="whitespace-pre-wrap text-sm font-sans bg-muted p-4 rounded-md overflow-x-auto">
              {generatedEmail}
            </pre>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
