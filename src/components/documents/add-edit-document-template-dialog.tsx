
"use client";

import { useState, useEffect, type ChangeEvent } from "react";
import { useForm, type SubmitHandler } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import type { DocumentTemplate, User } from "@/lib/types";
import { DOCUMENT_TEMPLATE_CATEGORIES } from "@/lib/constants";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription as FormDescriptionUI } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { Loader2, FileSignature, UploadCloud } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { db, storage } from "@/lib/firebase";
import { collection, addDoc, updateDoc, doc, serverTimestamp } from "firebase/firestore";
import { ref as storageRef, uploadBytesResumable, getDownloadURL } from "firebase/storage";

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const ALLOWED_FILE_TYPES_FOR_TEMPLATE_UPLOAD = [
  "application/pdf",
  "application/msword", "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "text/plain", "text/markdown"
];

const formSchema = z.object({
  name: z.string().min(1, "El nombre de la plantilla es obligatorio."),
  description: z.string().optional(),
  category: z.string().optional(),
  content: z.string().optional(),
  variables: z.string().optional(), 
  file: z.custom<File>((val) => val instanceof File, "Se requiere un archivo si no se provee contenido de texto.").optional()
    .refine((file) => !file || file.size <= MAX_FILE_SIZE, `El tamaño máximo del archivo es ${MAX_FILE_SIZE / (1024*1024)}MB.`)
    .refine((file) => !file || ALLOWED_FILE_TYPES_FOR_TEMPLATE_UPLOAD.includes(file.type), "Tipo de archivo no permitido para plantilla."),
}).refine(data => data.content || data.file, {
  message: "Debes proporcionar contenido de texto o subir un archivo para la plantilla.",
  path: ["content"], 
});

type DocumentTemplateFormValues = z.infer<typeof formSchema>;

interface AddEditDocumentTemplateDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  templateToEdit?: DocumentTemplate | null;
  currentUser: User;
  onSaveSuccess: (templateName: string, isEditing: boolean) => void;
}

export function AddEditDocumentTemplateDialog({
  isOpen,
  onOpenChange,
  templateToEdit,
  currentUser,
  onSaveSuccess,
}: AddEditDocumentTemplateDialogProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isUploadingFile, setIsUploadingFile] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const { toast } = useToast();

  const form = useForm<DocumentTemplateFormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: "",
      description: "",
      category: DOCUMENT_TEMPLATE_CATEGORIES[0] || "",
      content: "",
      variables: "",
    },
  });

  useEffect(() => {
    if (isOpen) {
      if (templateToEdit) {
        form.reset({
          name: templateToEdit.name,
          description: templateToEdit.description || "",
          category: templateToEdit.category || DOCUMENT_TEMPLATE_CATEGORIES[0] || "",
          content: templateToEdit.content || "",
          variables: templateToEdit.variables?.join(", ") || "",
        });
      } else {
        form.reset({
          name: "", description: "", category: DOCUMENT_TEMPLATE_CATEGORIES[0] || "",
          content: "", variables: "", file: undefined,
        });
      }
      setIsSubmitting(false);
      setIsUploadingFile(false);
      setUploadProgress(0);
    }
  }, [templateToEdit, isOpen, form]);

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      form.setValue("file", file);
      form.clearErrors("file"); 
      form.clearErrors("content"); 
    }
  };

  const onSubmitHandler: SubmitHandler<DocumentTemplateFormValues> = async (data) => {
    setIsSubmitting(true);

    let fileURL: string | undefined | null = templateToEdit?.fileURL;
    let fileNameInStorage: string | undefined | null = templateToEdit?.fileNameInStorage;
    let fileType: string | undefined | null = templateToEdit?.fileType;

    if (data.file) {
      setIsUploadingFile(true);
      setUploadProgress(0);
      const fileToUpload = data.file;
      fileNameInStorage = `${Date.now()}-${currentUser.id}-${fileToUpload.name}`;
      const filePath = `documentTemplates/${currentUser.id}/${fileNameInStorage}`;
      const fileStorageRef = storageRef(storage, filePath);
      const uploadTask = uploadBytesResumable(fileStorageRef, fileToUpload);

      try {
        fileURL = await new Promise<string>((resolve, reject) => {
          uploadTask.on(
            "state_changed",
            (snapshot) => {
              const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
              setUploadProgress(progress);
            },
            (error) => {
              console.error("Error subiendo archivo de plantilla:", error);
              reject(error);
            },
            async () => {
              try {
                const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
                resolve(downloadURL);
              } catch (urlError) {
                reject(urlError);
              }
            }
          );
        });
        fileType = fileToUpload.type;
      } catch (error) {
        toast({ title: "Error al Subir Archivo de Plantilla", description: String(error), variant: "destructive" });
        setIsUploadingFile(false);
        setIsSubmitting(false);
        return;
      }
      setIsUploadingFile(false);
    }


    const templateData: Omit<DocumentTemplate, 'id' | 'createdAt' | 'updatedAt' | 'createdByUserId'> & { createdAt?: any, updatedAt?: any, createdByUserId?: string } = {
      name: data.name,
      description: data.description || "",
      category: data.category || "",
      content: data.file ? "" : data.content || "",
      variables: data.variables?.split(',').map(v => v.trim()).filter(Boolean) || [],
      fileURL: fileURL === undefined ? null : fileURL,
      fileNameInStorage: fileNameInStorage === undefined ? null : fileNameInStorage,
      fileType: fileType === undefined ? null : fileType,
    };

    try {
      if (templateToEdit) {
        templateData.updatedAt = serverTimestamp();
        await updateDoc(doc(db, "documentTemplates", templateToEdit.id), templateData);
        toast({ title: "Plantilla Actualizada", description: `La plantilla "${data.name}" ha sido actualizada.` });
        onSaveSuccess(data.name, true);
      } else {
        templateData.createdAt = serverTimestamp();
        templateData.createdByUserId = currentUser.id;
        await addDoc(collection(db, "documentTemplates"), templateData);
        toast({ title: "Plantilla Creada", description: `La plantilla "${data.name}" ha sido creada.` });
        onSaveSuccess(data.name, false);
      }
      onOpenChange(false);
    } catch (error) {
      console.error("Error guardando plantilla:", error);
      toast({ title: "Error al Guardar Plantilla", description: String(error), variant: "destructive" });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileSignature className="h-6 w-6 text-primary" />
            {templateToEdit ? "Editar Plantilla de Documento" : "Nueva Plantilla de Documento"}
          </DialogTitle>
          <DialogDescription>
            {templateToEdit ? "Actualiza los detalles de esta plantilla." : "Crea una nueva plantilla para reutilizar en tus documentos."}
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmitHandler)} className="space-y-4 py-4 max-h-[70vh] overflow-y-auto pr-2">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Nombre de la Plantilla</FormLabel>
                  <FormControl><Input placeholder="Ej. Propuesta Comercial Estándar" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Descripción (Opcional)</FormLabel>
                  <FormControl><Textarea placeholder="Breve descripción del propósito de esta plantilla." {...field} rows={2} /></FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="category"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Categoría (Opcional)</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl><SelectTrigger><SelectValue placeholder="Selecciona una categoría" /></SelectTrigger></FormControl>
                    <SelectContent>
                      {DOCUMENT_TEMPLATE_CATEGORIES.map(cat => <SelectItem key={cat} value={cat}>{cat}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="variables"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Variables (Opcional, separadas por comas)</FormLabel>
                  <FormControl><Input placeholder="Ej. {{nombre_cliente}}, {{fecha_propuesta}}" {...field} /></FormControl>
                  <FormDescriptionUI>Estas variables se podrán reemplazar al generar un documento desde esta plantilla.</FormDescriptionUI>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="file"
              render={({ fieldState }) => (
                <FormItem>
                  <FormLabel>Archivo de Plantilla (Opcional si se provee contenido)</FormLabel>
                   <FormControl>
                    <Input 
                      id="template-file-input"
                      type="file" 
                      onChange={handleFileChange} 
                      disabled={isSubmitting || isUploadingFile}
                      accept={ALLOWED_FILE_TYPES_FOR_TEMPLATE_UPLOAD.join(",")}
                    />
                  </FormControl>
                  <FormDescriptionUI>Sube un archivo (.pdf, .docx, .txt, .md) como base para la plantilla.</FormDescriptionUI>
                  {fieldState.error && <FormMessage>{fieldState.error.message}</FormMessage>}
                  {isUploadingFile && (
                    <div className="space-y-1 mt-1">
                        <Progress value={uploadProgress} className="w-full h-2" />
                        <p className="text-xs text-muted-foreground text-center">Subiendo... {uploadProgress.toFixed(0)}%</p>
                    </div>
                  )}
                  {templateToEdit?.fileURL && !form.getValues("file") && (
                    <p className="text-xs text-muted-foreground mt-1">Archivo actual: <a href={templateToEdit.fileURL} target="_blank" rel="noopener noreferrer" className="text-primary underline">{templateToEdit.fileNameInStorage || "Ver archivo"}</a>. Selecciona uno nuevo para reemplazarlo.</p>
                  )}
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="content"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Contenido de Texto (Opcional si se sube archivo)</FormLabel>
                  <FormControl><Textarea placeholder="Escribe o pega el contenido de la plantilla aquí (ej. Markdown, texto plano)." {...field} rows={5} disabled={!!form.watch("file")} /></FormControl>
                  <FormDescriptionUI>Si subes un archivo, este campo será ignorado.</FormDescriptionUI>
                  <FormMessage />
                </FormItem>
              )}
            />
            {form.formState.errors.content?.type === 'custom' && form.formState.errors.content.message && <FormMessage>{form.formState.errors.content.message}</FormMessage>}


            <DialogFooter className="pt-4">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isSubmitting}>
                Cancelar
              </Button>
              <Button type="submit" disabled={isSubmitting || isUploadingFile}>
                {(isSubmitting || isUploadingFile) ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                {(isSubmitting || isUploadingFile) ? "Guardando..." : (templateToEdit ? "Guardar Cambios" : "Crear Plantilla")}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
