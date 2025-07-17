
"use client";

import { useState, type ChangeEvent, useEffect } from "react";
import type { User, DocumentFile, DocumentVersion } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription as FormDescriptionUI } from "@/components/ui/form";
import { useForm, type SubmitHandler } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { UploadCloud, Loader2, Sparkles } from "lucide-react"; 
import { useToast } from "@/hooks/use-toast";
import { db, storage } from "@/lib/firebase";
import { doc, updateDoc, serverTimestamp, arrayUnion, Timestamp } from "firebase/firestore";
import { ref as storageRef, uploadBytesResumable, getDownloadURL } from "firebase/storage";
import { Progress } from "@/components/ui/progress";
import { compareDocumentVersions, type DocumentComparisonOutput } from "@/ai/flows/document-comparison"; 
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"; 

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const ALLOWED_FILE_TYPES = [
  "image/jpeg", "image/png", "image/gif", "application/pdf",
  "application/msword", "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-powerpoint", "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "text/plain", "text/csv"
];

const formSchema = z.object({
  file: z.custom<File>((val) => val instanceof File, "Se requiere un archivo.")
    .refine((file) => file.size <= MAX_FILE_SIZE, `El tamaño máximo del archivo es ${MAX_FILE_SIZE / (1024*1024)}MB.`)
    .refine((file) => ALLOWED_FILE_TYPES.includes(file.type), "Tipo de archivo no permitido."),
  versionNotes: z.string().optional(),
});

type UploadNewVersionFormValues = z.infer<typeof formSchema>;

interface UploadNewVersionDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  documentToUpdate: DocumentFile;
  currentUser: User;
  onUploadSuccess: (documentName: string, newVersionNumber: number) => void;
}

export function UploadNewVersionDialog({
  isOpen,
  onOpenChange,
  documentToUpdate,
  currentUser,
  onUploadSuccess,
}: UploadNewVersionDialogProps) {
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const { toast } = useToast();

  const [aiComparisonResult, setAiComparisonResult] = useState<DocumentComparisonOutput | null>(null);
  const [isComparingWithAI, setIsComparingWithAI] = useState(false);

  const form = useForm<UploadNewVersionFormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      versionNotes: "",
    }
  });

  useEffect(() => {
    if (isOpen) {
        form.reset({ versionNotes: "" }); 
        const fileInput = document.getElementById('new-version-file-input') as HTMLInputElement | null;
        if (fileInput) fileInput.value = ""; // Explicitly clear file input
        form.setValue('file', undefined as any); // Clear RHF state for file
        form.clearErrors('file'); // Clear any validation errors for file

        setAiComparisonResult(null);
        setIsComparingWithAI(false);
    }
  }, [isOpen, form]);


  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      form.setValue("file", file);
      form.clearErrors("file");
      setAiComparisonResult(null); 
    }
  };

  const handleAiCompare = async () => {
    const newFile = form.getValues("file");
    if (!newFile) {
      toast({ title: "Selecciona un archivo nuevo", description: "Debes seleccionar un archivo para la nueva versión antes de comparar.", variant: "destructive" });
      return;
    }

    let newFileText = "";
    let currentFileText = ""; 

    if (newFile.type.startsWith("text/")) {
      try {
        newFileText = await newFile.text();
      } catch (e) {
        toast({ title: "Error al leer archivo nuevo", description: "No se pudo leer el contenido del archivo nuevo como texto.", variant: "destructive" });
        setIsComparingWithAI(false);
        return;
      }
    } else {
      newFileText = `El archivo '${newFile.name}' (tipo: ${newFile.type}) no es de texto plano. La comparación IA se basará en metadatos y no en contenido profundo.`;
      toast({ title: "Comparación IA Limitada", description: "La comparación detallada funciona mejor con archivos de texto plano.", variant: "default", duration: 7000 });
    }

    if (documentToUpdate.fileType.startsWith("text/")) {
        currentFileText = `(Contenido de la versión actual '${documentToUpdate.name}' no extraído en el cliente para esta demo. Se usarán metadatos.)`;
         toast({ title: "Nota sobre Comparación", description: "La extracción del texto de la versión actual es compleja en el cliente. Se usarán metadatos.", variant: "default", duration: 7000});
    } else {
        currentFileText = `Metadatos de la versión actual: Nombre: ${documentToUpdate.name}, Tipo: ${documentToUpdate.fileType}, Tamaño: ${documentToUpdate.fileSize} bytes.`;
    }

    setIsComparingWithAI(true);
    setAiComparisonResult(null);
    try {
      const result = await compareDocumentVersions({
        currentDocumentText: currentFileText,
        newDocumentText: newFileText,
      });
      setAiComparisonResult(result);
      if (result.areDifferent) {
        toast({ title: "IA: Diferencias Encontradas", description: result.differenceSummary || "Se detectaron cambios significativos.", variant: "default", duration: 10000 });
      } else {
        toast({ title: "IA: Sin Diferencias Sustanciales", description: result.differenceSummary || "No se detectaron cambios importantes o los documentos son muy similares.", variant: "default", duration: 10000 });
      }
    } catch (error) {
      console.error("Error en comparación IA:", error);
      toast({ title: "Error en Comparación IA", description: "No se pudo completar la comparación.", variant: "destructive" });
    } finally {
      setIsComparingWithAI(false);
    }
  };


  const onSubmit: SubmitHandler<UploadNewVersionFormValues> = async (data) => {
    if (!data.file) {
      toast({ title: "Archivo no seleccionado", description: "Por favor, selecciona un archivo para subir.", variant: "destructive" });
      return;
    }

    setIsUploading(true);
    setUploadProgress(0);

    const fileToUpload = data.file;
    const newFileNameInStorage = `${Date.now()}-${currentUser.id}-${fileToUpload.name}`;
    const filePath = `documents/${currentUser.id}/${newFileNameInStorage}`; 
    const fileStorageRef = storageRef(storage, filePath);

    const uploadTask = uploadBytesResumable(fileStorageRef, fileToUpload);

    uploadTask.on(
      "state_changed",
      (snapshot) => {
        const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
        setUploadProgress(progress);
      },
      (error) => {
        console.error("Error subiendo nueva versión:", error);
        toast({ title: "Error al Subir Versión", description: error.message, variant: "destructive" });
        setIsUploading(false);
        setUploadProgress(0);
      },
      async () => {
        try {
          const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
          const nowServerTimestamp = serverTimestamp();
          const newVersionNumber = documentToUpdate.currentVersion + 1;
          
          const previousVersionEntry: DocumentVersion = {
            version: documentToUpdate.currentVersion,
            fileURL: documentToUpdate.fileURL,
            fileNameInStorage: documentToUpdate.fileNameInStorage,
            uploadedAt: documentToUpdate.lastVersionUploadedAt || documentToUpdate.uploadedAt, 
            uploadedByUserId: documentToUpdate.lastVersionUploadedByUserId || documentToUpdate.uploadedByUserId,
            uploadedByUserName: documentToUpdate.lastVersionUploadedByUserName || documentToUpdate.uploadedByUserName,
            fileSize: documentToUpdate.fileSize,
            fileType: documentToUpdate.fileType,
            notes: documentToUpdate.description, 
          };

          const docRef = doc(db, "documents", documentToUpdate.id);
          await updateDoc(docRef, {
            fileURL: downloadURL,
            fileNameInStorage: newFileNameInStorage,
            fileType: fileToUpload.type,
            fileSize: fileToUpload.size,
            description: data.versionNotes || documentToUpdate.description, 
            lastVersionUploadedAt: nowServerTimestamp,
            lastVersionUploadedByUserId: currentUser.id,
            lastVersionUploadedByUserName: currentUser.name || "Usuario Desconocido",
            currentVersion: newVersionNumber,
            versionHistory: arrayUnion(previousVersionEntry),
          });

          toast({
            title: "Nueva Versión Subida",
            description: `El archivo "${fileToUpload.name}" ha sido subido como versión ${newVersionNumber}.`,
          });
          onUploadSuccess(documentToUpdate.name, newVersionNumber); // Pass document name and new version number
          form.reset();
          const fileInput = document.getElementById('new-version-file-input') as HTMLInputElement | null;
          if (fileInput) fileInput.value = "";
          setAiComparisonResult(null);
          onOpenChange(false); 
        } catch (error) {
          console.error("Error actualizando metadata del documento:", error);
          toast({ title: "Error al Guardar Versión", description: "Ocurrió un error al guardar la información de la nueva versión.", variant: "destructive" });
        } finally {
          setIsUploading(false);
          setUploadProgress(0);
        }
      }
    );
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => { if (!isUploading) onOpenChange(open); }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UploadCloud className="h-6 w-6 text-primary" />
            Subir Nueva Versión para &quot;{documentToUpdate.name}&quot;
          </DialogTitle>
          <DialogDescription>
            Vas a subir la versión {documentToUpdate.currentVersion + 1}. La versión actual ({documentToUpdate.currentVersion}) se guardará en el historial.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 py-4">
            <FormField
              control={form.control}
              name="file"
              render={({ fieldState }) => (
                <FormItem>
                  <FormLabel htmlFor="new-version-file-input">Nuevo Archivo</FormLabel>
                  <FormControl>
                    <Input
                      id="new-version-file-input"
                      type="file"
                      onChange={handleFileChange}
                      disabled={isUploading}
                      accept={ALLOWED_FILE_TYPES.join(",")}
                    />
                  </FormControl>
                  {fieldState.error && <FormMessage>{fieldState.error.message}</FormMessage>}
                </FormItem>
              )}
            />
            <Button 
              type="button" 
              variant="outline" 
              onClick={handleAiCompare} 
              disabled={isUploading || isComparingWithAI || !form.getValues("file")} 
              className="w-full mt-2"
            >
              {isComparingWithAI ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}
              Comparar con Versión Actual (IA Beta)
            </Button>
            {aiComparisonResult && (
              <Alert className="mt-2">
                <Sparkles className="h-4 w-4" />
                <AlertTitle>Resultado de Comparación IA</AlertTitle>
                <AlertDescription className="text-xs max-h-20 overflow-y-auto">
                  {aiComparisonResult.areDifferent ? <span className="font-semibold">Se detectaron diferencias.</span> : <span className="font-semibold">No se detectaron diferencias sustanciales.</span>}
                  <br />
                  {aiComparisonResult.differenceSummary || "La IA no proporcionó un resumen detallado."}
                </AlertDescription>
              </Alert>
            )}
            <FormField
              control={form.control}
              name="versionNotes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Notas de esta Versión (Opcional)</FormLabel>
                  <FormControl>
                    <Textarea placeholder="Ej. Cambios realizados, correcciones..." {...field} disabled={isUploading} />
                  </FormControl>
                  <FormDescriptionUI>Estas notas se asociarán con la nueva versión y actualizarán la descripción principal del documento.</FormDescriptionUI>
                  <FormMessage />
                </FormItem>
              )}
            />
            {isUploading && (
              <div className="space-y-1">
                <Progress value={uploadProgress} className="w-full h-2" />
                <p className="text-xs text-muted-foreground text-center">Subiendo... {uploadProgress.toFixed(0)}%</p>
              </div>
            )}
            <DialogFooter className="pt-4">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isUploading}>
                Cancelar
              </Button>
              <Button type="submit" disabled={isUploading || !currentUser || !form.formState.isValid}>
                {isUploading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <UploadCloud className="mr-2 h-4 w-4" />}
                {isUploading ? "Subiendo..." : "Subir Nueva Versión"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
