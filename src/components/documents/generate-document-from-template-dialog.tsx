
"use client";

import { useState, useEffect, type ChangeEvent } from "react";
import { useForm, type SubmitHandler, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import type { DocumentTemplate, User, Lead, Contact, DocumentFile } from "@/lib/types";
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
import { Loader2, Play, UploadCloud, Link as LinkIcon } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { db, storage } from "@/lib/firebase";
import { collection, addDoc, serverTimestamp } from "firebase/firestore";
import { ref as storageRef, uploadBytesResumable, getDownloadURL } from "firebase/storage";

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const ALLOWED_FILE_TYPES = [ // Broader for generated/uploaded files
  "image/jpeg", "image/png", "image/gif", "application/pdf",
  "application/msword", "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-powerpoint", "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "text/plain", "text/csv", "text/markdown", "text/html"
];
const NO_SELECTION_VALUE = "__NONE__";

interface GenerateDocumentFromTemplateDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  template: DocumentTemplate;
  currentUser: User;
  onGenerateSuccess: (newDocument: DocumentFile) => void;
  leads: Lead[];
  contacts: Contact[];
}

export function GenerateDocumentFromTemplateDialog({
  isOpen,
  onOpenChange,
  template,
  currentUser,
  onGenerateSuccess,
  leads,
  contacts,
}: GenerateDocumentFromTemplateDialogProps) {
  const [isProcessing, setIsProcessing] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const { toast } = useToast();

  // Dynamically create Zod schema based on template variables
  const createFormSchema = (variables: string[] = []) => {
    let schemaObject: any = {
      documentName: z.string().min(1, "El nombre del documento es obligatorio."),
      relatedLeadId: z.string().optional(),
      relatedContactId: z.string().optional(),
      description: z.string().optional(),
      tags: z.string().optional(),
    };

    variables.forEach(variable => {
      // Sanitize variable name for use as a Zod key (e.g., remove {{}} and spaces)
      const key = variable.replace(/[{}]/g, "").replace(/\s+/g, "_").trim();
      if (key) {
        schemaObject[key] = z.string().min(1, `El valor para "${variable}" es obligatorio.`);
      }
    });
    
    // Add file input only if template is file-based or has no content (implying user provides the file)
    if (template.fileURL || (!template.content && !template.fileURL)) {
        schemaObject.generatedFile = z.custom<File>((val) => val instanceof File, "Se requiere un archivo generado.")
            .refine((file) => file.size <= MAX_FILE_SIZE, `El tamaño máximo del archivo es ${MAX_FILE_SIZE / (1024*1024)}MB.`)
            .refine((file) => ALLOWED_FILE_TYPES.includes(file.type), "Tipo de archivo no permitido.");
    }


    return z.object(schemaObject).refine(data => {
        const leadSelected = data.relatedLeadId && data.relatedLeadId !== NO_SELECTION_VALUE;
        const contactSelected = data.relatedContactId && data.relatedContactId !== NO_SELECTION_VALUE;
        return !(leadSelected && contactSelected);
    }, {
        message: "Asocia el documento a un Lead o a un Contacto, no a ambos.",
        path: ["relatedLeadId"],
    });
  };
  
  const formSchema = createFormSchema(template.variables);
  type GenerateDocumentFormValues = z.infer<typeof formSchema>;

  const form = useForm<GenerateDocumentFormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      documentName: `Documento Basado en ${template.name}`,
      relatedLeadId: NO_SELECTION_VALUE,
      relatedContactId: NO_SELECTION_VALUE,
      description: template.description || "",
      tags: "",
      ...(template.variables?.reduce((acc, variable) => {
        const key = variable.replace(/[{}]/g, "").replace(/\s+/g, "_").trim();
        if (key) acc[key] = "";
        return acc;
      }, {} as Record<string, string>) || {}),
    },
  });

  useEffect(() => {
    if (isOpen) {
      form.reset({
        documentName: `Documento Basado en ${template.name}`,
        relatedLeadId: NO_SELECTION_VALUE,
        relatedContactId: NO_SELECTION_VALUE,
        description: template.description || "",
        tags: "",
        ...(template.variables?.reduce((acc, variable) => {
          const key = variable.replace(/[{}]/g, "").replace(/\s+/g, "_").trim();
          if (key) acc[key] = "";
          return acc;
        }, {} as Record<string, string>) || {}),
        generatedFile: undefined, // Explicitly reset file
      });
      setIsProcessing(false);
      setUploadProgress(0);
    }
  }, [template, isOpen, form]);

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      form.setValue("generatedFile", file);
      form.clearErrors("generatedFile");
    }
  };
  
  const onSubmitHandler: SubmitHandler<GenerateDocumentFormValues> = async (data) => {
    setIsProcessing(true);
    setUploadProgress(0);

    let fileToUpload: File;
    let generatedContent = "";

    if (template.content) { // Text-based template: generate content
      generatedContent = template.content;
      template.variables?.forEach(variable => {
        const key = variable.replace(/[{}]/g, "").replace(/\s+/g, "_").trim();
        const value = data[key as keyof GenerateDocumentFormValues] as string || "";
        generatedContent = generatedContent.replace(new RegExp(variable.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), value);
      });
      // Determine MIME type for text-based content, default to text/plain
      let mimeType = "text/plain";
      if (template.fileType && (template.fileType.startsWith("text/") || template.fileType === "application/json")) {
        mimeType = template.fileType;
      } else if (data.documentName.endsWith(".md")) {
        mimeType = "text/markdown";
      } else if (data.documentName.endsWith(".html")) {
        mimeType = "text/html";
      }
      fileToUpload = new File([generatedContent], data.documentName, { type: mimeType });
    } else if (data.generatedFile) { // File-based template: user uploads finalized document
      fileToUpload = data.generatedFile;
    } else {
      toast({ title: "Error", description: "No se pudo determinar el contenido del archivo a generar.", variant: "destructive" });
      setIsProcessing(false);
      return;
    }

    const fileNameInStorage = `${Date.now()}-${currentUser.id}-${fileToUpload.name}`;
    const filePath = `documents/${currentUser.id}/${fileNameInStorage}`;
    const fileStorageRef = storageRef(storage, filePath);
    const uploadTask = uploadBytesResumable(fileStorageRef, fileToUpload);

    try {
      const downloadURL = await new Promise<string>((resolve, reject) => {
        uploadTask.on(
          "state_changed",
          (snapshot) => setUploadProgress((snapshot.bytesTransferred / snapshot.totalBytes) * 100),
          (error) => { console.error("Error subiendo documento generado:", error); reject(error); },
          async () => {
            try { resolve(await getDownloadURL(uploadTask.snapshot.ref)); }
            catch (urlError) { reject(urlError); }
          }
        );
      });

      const templateVariablesFilled: Record<string, string> = {};
      template.variables?.forEach(variable => {
        const key = variable.replace(/[{}]/g, "").replace(/\s+/g, "_").trim();
        if (key) templateVariablesFilled[variable] = data[key as keyof GenerateDocumentFormValues] as string || "";
      });

      const newDocumentData: Omit<DocumentFile, 'id'> = {
        name: data.documentName,
        fileNameInStorage,
        fileURL: downloadURL,
        fileType: fileToUpload.type,
        fileSize: fileToUpload.size,
        description: data.description || "",
        tags: data.tags?.split(',').map(tag => tag.trim()).filter(Boolean) || [],
        uploadedAt: serverTimestamp() as unknown as string, // Firestore will convert this
        uploadedByUserId: currentUser.id,
        uploadedByUserName: currentUser.name || "Usuario Desconocido",
        currentVersion: 1,
        basedOnTemplateId: template.id,
        templateVariablesFilled,
        relatedLeadId: data.relatedLeadId === NO_SELECTION_VALUE ? null : data.relatedLeadId,
        relatedContactId: data.relatedContactId === NO_SELECTION_VALUE ? null : data.relatedContactId,
      };

      const docRef = await addDoc(collection(db, "documents"), newDocumentData);
      onGenerateSuccess({ ...newDocumentData, id: docRef.id, createdAt: new Date().toISOString() } as DocumentFile); // Pass full new document
      onOpenChange(false);
    } catch (error) {
      console.error("Error al generar documento:", error)
      toast({ title: "Error al Generar Documento", description: String(error), variant: "destructive" });
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Play className="h-6 w-6 text-primary" />
            Generar Documento desde &quot;{template.name}&quot;
          </DialogTitle>
          <DialogDescription>
            Completa los campos para generar un nuevo documento basado en esta plantilla.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmitHandler)} className="space-y-4 py-4 max-h-[70vh] overflow-y-auto pr-2">
            <FormField
              control={form.control}
              name="documentName"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Nombre del Nuevo Documento</FormLabel>
                  <FormControl><Input placeholder="Ej. Propuesta para Cliente X" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            {template.variables && template.variables.length > 0 && (
              <div className="space-y-3 p-3 border rounded-md">
                <h4 className="text-sm font-medium">Completa las Variables de la Plantilla:</h4>
                {template.variables.map(variable => {
                  const key = variable.replace(/[{}]/g, "").replace(/\s+/g, "_").trim();
                  if (!key) return null;
                  return (
                    <FormField
                      key={key}
                      control={form.control}
                      name={key as any} // Cast to any because key is dynamic
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>{variable}</FormLabel>
                          <FormControl><Input {...field} /></FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  );
                })}
              </div>
            )}

            {(template.fileURL || (!template.content && !template.fileURL)) && (
                 <FormField
                    control={form.control}
                    name="generatedFile"
                    render={({ fieldState }) => ( 
                        <FormItem>
                        <FormLabel>Archivo Finalizado</FormLabel>
                        <FormControl>
                            <Input 
                            type="file" 
                            onChange={handleFileChange} 
                            disabled={isProcessing}
                            accept={ALLOWED_FILE_TYPES.join(",")}
                            />
                        </FormControl>
                        <FormDescriptionUI>
                            {template.fileURL ? "Descarga la plantilla, complétala y sube aquí el archivo finalizado." : "Sube el archivo que has preparado para este documento."}
                        </FormDescriptionUI>
                        {fieldState.error && <FormMessage>{fieldState.error.message}</FormMessage>}
                        </FormItem>
                    )}
                />
            )}
            
            {isProcessing && uploadProgress > 0 && (
              <div className="space-y-1">
                <Progress value={uploadProgress} className="w-full h-2" />
                <p className="text-xs text-muted-foreground text-center">Procesando... {uploadProgress.toFixed(0)}%</p>
              </div>
            )}

            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Descripción del Documento (Opcional)</FormLabel>
                  <FormControl><Textarea placeholder="Breve descripción..." {...field} rows={2} /></FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="tags"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Etiquetas (Opcional, separadas por comas)</FormLabel>
                  <FormControl><Input placeholder="Ej. generado, contrato" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
             <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                control={form.control}
                name="relatedLeadId"
                render={({ field }) => (
                    <FormItem>
                    <FormLabel className="flex items-center gap-1">
                        <LinkIcon className="h-4 w-4 text-muted-foreground" /> Asociar a Lead (Opcional)
                    </FormLabel>
                    <Select 
                        onValueChange={field.onChange} 
                        value={field.value || NO_SELECTION_VALUE} 
                        disabled={isProcessing || (!!form.watch("relatedContactId") && form.watch("relatedContactId") !== NO_SELECTION_VALUE)}
                    >
                        <FormControl><SelectTrigger><SelectValue placeholder="Selecciona un Lead" /></SelectTrigger></FormControl>
                        <SelectContent>
                        <SelectItem value={NO_SELECTION_VALUE}>Ninguno</SelectItem>
                        {leads.map(lead => <SelectItem key={lead.id} value={lead.id}>{lead.name}</SelectItem>)}
                        </SelectContent>
                    </Select>
                    <FormMessage />
                    </FormItem>
                )}
                />
                <FormField
                control={form.control}
                name="relatedContactId"
                render={({ field }) => (
                    <FormItem>
                    <FormLabel className="flex items-center gap-1">
                        <LinkIcon className="h-4 w-4 text-muted-foreground" /> Asociar a Contacto (Opcional)
                    </FormLabel>
                    <Select 
                        onValueChange={field.onChange} 
                        value={field.value || NO_SELECTION_VALUE} 
                        disabled={isProcessing || (!!form.watch("relatedLeadId") && form.watch("relatedLeadId") !== NO_SELECTION_VALUE)}
                    >
                        <FormControl><SelectTrigger><SelectValue placeholder="Selecciona un Contacto" /></SelectTrigger></FormControl>
                        <SelectContent>
                        <SelectItem value={NO_SELECTION_VALUE}>Ninguno</SelectItem>
                        {contacts.map(contact => <SelectItem key={contact.id} value={contact.id}>{contact.firstName || ''} {contact.lastName || ''} ({contact.email})</SelectItem>)}
                        </SelectContent>
                    </Select>
                    <FormMessage />
                    </FormItem>
                )}
                />
            </div>
             {form.formState.errors.relatedLeadId?.type === 'custom' && form.formState.errors.relatedLeadId.message && <FormMessage>{form.formState.errors.relatedLeadId.message}</FormMessage>}


            <DialogFooter className="pt-4">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isProcessing}>
                Cancelar
              </Button>
              <Button type="submit" disabled={isProcessing}>
                {isProcessing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Play className="mr-2 h-4 w-4" />}
                {isProcessing ? "Generando..." : "Generar Documento"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

