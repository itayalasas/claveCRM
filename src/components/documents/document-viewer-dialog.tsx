"use client";

import { useState, useEffect } from "react";
import type { DocumentFile } from "@/lib/types";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Loader2, AlertTriangle, FileText, Download } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface DocumentViewerDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  documentFile: DocumentFile | null;
}

export function DocumentViewerDialog({
  isOpen,
  onOpenChange,
  documentFile,
}: DocumentViewerDialogProps) {
  const [textContent, setTextContent] = useState<string | null>(null);
  const [isLoadingText, setIsLoadingText] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null); // New state for specific fetch error
  const { toast } = useToast();

  useEffect(() => {
    let mounted = true;
    setFetchError(null); // Reset error on open or document change

    const fetchTextContent = async () => {
      if (isOpen && documentFile && documentFile.fileType.startsWith("text/")) {
        if (mounted) {
          setIsLoadingText(true);
          setTextContent(null);
          setFetchError(null); // Reset fetch error before new attempt
        }
        try {
          const response = await fetch(documentFile.fileURL);
          if (!response.ok) {
            throw new Error(`Error al cargar el archivo (${response.status}): ${response.statusText}`);
          }
          const text = await response.text();
          if (mounted) {
            setTextContent(text);
          }
        } catch (error: any) {
          console.error(`Error fetching text content from URL: ${documentFile?.fileURL}`, error);
          let userFriendlyError = `No se pudo cargar el contenido de "${documentFile?.name}".`;
          
          if (error.message.includes("Failed to fetch") || error.message.includes("NetworkError") || error.message.toLowerCase().includes("cors")) {
            userFriendlyError += " Esto podría ser un problema de CORS o de red. Asegúrate de que la configuración CORS de tu Firebase Storage bucket permita solicitudes GET desde este dominio.";
            console.error(
                "POSIBLE PROBLEMA DE CORS: Asegúrate de que la configuración CORS de tu Firebase Storage bucket permite solicitudes GET desde este dominio. " +
                "Revisa la consola de red del navegador (pestaña Network) para más detalles sobre la solicitud fallida y verifica tu archivo cors.json en el bucket. " +
                "Ejemplo de cors.json para desarrollo: [{\"origin\": [\"*\"], \"method\": [\"GET\"], \"maxAgeSeconds\": 3600}]. " +
                "Para producción, especifica tus dominios en lugar de '*'."
            );
          } else {
            userFriendlyError += ` Detalles: ${error.message}`;
          }

          if (mounted) {
            setFetchError(userFriendlyError); // Set specific error message for UI
            toast({
              title: "Error al Cargar Contenido",
              description: "No se pudo cargar el contenido del archivo. Revisa la consola para más detalles y verifica la configuración CORS de Firebase Storage si el problema persiste.",
              variant: "destructive",
              duration: 10000, 
            });
          }
        } finally {
          if (mounted) {
            setIsLoadingText(false);
          }
        }
      }
    };

    if (isOpen && documentFile?.fileURL) {
        if (documentFile.fileType.startsWith("text/")) { // Only fetch if it's text-based
            fetchTextContent();
        } else {
            setIsLoadingText(false); // Not text, so no loading needed for text content
            setTextContent(null);
            setFetchError(null);
        }
    } else {
        // Clear content if dialog is closed or no document
        setTextContent(null);
        setFetchError(null);
        setIsLoadingText(false);
    }

    return () => {
      mounted = false; 
    };
  }, [isOpen, documentFile, toast]);

  if (!documentFile) {
    return null;
  }

  const isPdf = documentFile.fileType === "application/pdf";
  const isTextRenderable = documentFile.fileType.startsWith("text/");
  const isDocx = documentFile.fileType.includes("word") || documentFile.name.endsWith(".docx") || documentFile.name.endsWith(".doc");
  const isXlsx = documentFile.fileType.includes("sheet") || documentFile.fileType.includes("excel") || documentFile.name.endsWith(".xlsx") || documentFile.name.endsWith(".xls") || documentFile.fileType === "text/csv";

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl md:max-w-3xl lg:max-w-4xl xl:max-w-5xl h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="truncate" title={documentFile.name}>
            Visualizando: {documentFile.name}
          </DialogTitle>
          <DialogDescription>
            Tipo: {documentFile.fileType} | Versión: {documentFile.currentVersion}
          </DialogDescription>
        </DialogHeader>

        <div className="flex-grow overflow-hidden border rounded-md bg-muted flex items-center justify-center p-1">
          {isPdf ? (
            <iframe
              src={`${documentFile.fileURL}#toolbar=0&navpanes=0&scrollbar=0`}
              title={`Vista previa de ${documentFile.name}`}
              className="w-full h-full border-0"
              allowFullScreen
            />
          ) : isTextRenderable ? ( 
            isLoadingText ? (
              <div className="flex flex-col items-center justify-center h-full">
                <Loader2 className="h-12 w-12 animate-spin text-primary mb-4" />
                <p className="text-muted-foreground">Cargando contenido del texto...</p>
              </div>
            ) : fetchError ? (
              <div className="flex flex-col items-center justify-center h-full text-center p-6">
                <AlertTriangle className="h-16 w-16 text-destructive mb-4" />
                <h3 className="text-lg font-semibold mb-2 text-destructive">Error al Cargar Contenido</h3>
                <p className="text-sm text-muted-foreground mb-4 whitespace-pre-wrap">{fetchError}</p>
                <Button asChild>
                  <a href={documentFile.fileURL} download={documentFile.name} target="_blank" rel="noopener noreferrer">
                    <Download className="mr-2 h-4 w-4" /> Descargar Documento Directamente
                  </a>
                </Button>
              </div>
            ) : (
              <ScrollArea className="w-full h-full p-4 bg-background">
                <pre className="text-sm whitespace-pre-wrap break-all">{textContent || "No hay contenido para mostrar."}</pre>
              </ScrollArea>
            )
          ) : (isDocx || isXlsx) ? (
            <div className="flex flex-col items-center justify-center h-full text-center p-6">
              <FileText className="h-16 w-16 text-blue-500 mb-4" />
              <h3 className="text-lg font-semibold mb-2">Visualización Directa Limitada</h3>
              <p className="text-sm text-muted-foreground mb-1">
                La visualización directa en la aplicación para archivos <strong className="text-foreground">{isDocx ? "DOCX" : "XLSX/CSV"}</strong> no está disponible con todas las funcionalidades.
              </p>
              <p className="text-sm text-muted-foreground mb-4">
                Para una experiencia completa de visualización y edición, por favor descarga el archivo.
                Para editar, descárgalo, realiza los cambios y luego sube el archivo modificado como una <strong className="text-foreground">nueva versión</strong>.
              </p>
              <Button asChild>
                <a href={documentFile.fileURL} download={documentFile.name} target="_blank" rel="noopener noreferrer">
                  <Download className="mr-2 h-4 w-4" /> Descargar Documento
                </a>
              </Button>
            </div>
          )
           : (
            <div className="flex flex-col items-center justify-center h-full text-center p-6">
              <AlertTriangle className="h-16 w-16 text-amber-500 mb-4" />
              <h3 className="text-lg font-semibold mb-2">Visualización No Soportada</h3>
              <p className="text-sm text-muted-foreground mb-4">
                La visualización en la aplicación para archivos de tipo &quot;{documentFile.fileType}&quot; aún no está disponible.
              </p>
              <Button asChild>
                <a href={documentFile.fileURL} download={documentFile.name} target="_blank" rel="noopener noreferrer">
                   <Download className="mr-2 h-4 w-4" /> Descargar Documento para Ver
                </a>
              </Button>
            </div>
          )}
        </div>

        <DialogFooter className="pt-4 mt-auto border-t">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cerrar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}