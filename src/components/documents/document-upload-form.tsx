
"use client";

import { useState, type ChangeEvent } from "react";
import type { User, Lead, Contact } from "@/lib/types"; 
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription as FormDescriptionUI } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useForm, type SubmitHandler } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { UploadCloud, Loader2, Link as LinkIcon } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { db, storage } from "@/lib/firebase";
import { collection, addDoc, serverTimestamp } from "firebase/firestore";
import { ref as storageRef, uploadBytesResumable, getDownloadURL } from "firebase/storage";

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const ALLOWED_FILE_TYPES = [
  "image/jpeg", "image/png", "image/gif", "application/pdf",
  "application/msword", "application/vnd.openxmlformats-officedocument.wordprocessingml.document", // .doc, .docx
  "application/vnd.ms-excel", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", // .xls, .xlsx
  "application/vnd.ms-powerpoint", "application/vnd.openxmlformats-officedocument.presentationml.presentation", // .ppt, .pptx
  "text/plain", "text/csv"
];

const NO_SELECTION_VALUE = "__NONE__";

const formSchema = z.object({
  file: z.custom<File>((val) => val instanceof File, "Se requiere un archivo.")
    .refine((file) => file.size <= MAX_FILE_SIZE, `El tamaño máximo del archivo es ${MAX_FILE_SIZE / (1024*1024)}MB.`)
    .refine((file) => ALLOWED_FILE_TYPES.includes(file.type), "Tipo de archivo no permitido."),
  description: z.string().optional(),
  tags: z.string().optional(),
  relatedLeadId: z.string().optional(),
  relatedContactId: z.string().optional(),
}).refine(data => {
  const leadSelected = data.relatedLeadId && data.relatedLeadId !== NO_SELECTION_VALUE;
  const contactSelected = data.relatedContactId && data.relatedContactId !== NO_SELECTION_VALUE;
  return !(leadSelected && contactSelected);
}, {
  message: "Asocia el documento a un Lead o a un Contacto, no a ambos.",
  path: ["relatedLeadId"], 
});

type DocumentUploadFormValues = z.infer<typeof formSchema>;

interface DocumentUploadFormProps {
  currentUser: User | null;
  onUploadSuccess: (fileName: string) => void; 
  leads?: Lead[];
  contacts?: Contact[];
}

export function DocumentUploadForm({ currentUser, onUploadSuccess, leads = [], contacts = [] }: DocumentUploadFormProps) {
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const { toast } = useToast();

  const form = useForm<DocumentUploadFormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      relatedLeadId: NO_SELECTION_VALUE,
      relatedContactId: NO_SELECTION_VALUE,
      description: "",
      tags: "",
    }
  });

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      form.setValue("file", file);
      form.clearErrors("file"); 
    }
  };

  const onSubmit: SubmitHandler<DocumentUploadFormValues> = async (data) => {
    if (!currentUser) {
      toast({ title: "Error de autenticación", description: "Debes iniciar sesión para subir documentos.", variant: "destructive" });
      return;
    }
    if (!data.file) {
        toast({ title: "Archivo no seleccionado", description: "Por favor, selecciona un archivo para subir.", variant: "destructive" });
        return;
    }

    setIsUploading(true);
    setUploadProgress(0);
    
    const fileToUpload = data.file;
    const fileNameInStorage = `${Date.now()}-${currentUser.id}-${fileToUpload.name}`;
    const filePath = `documents/${currentUser.id}/${fileNameInStorage}`;
    const fileStorageRef = storageRef(storage, filePath);

    const uploadTask = uploadBytesResumable(fileStorageRef, fileToUpload);

    uploadTask.on(
      "state_changed",
      (snapshot) => {
        const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
        setUploadProgress(progress);
      },
      (error) => {
        console.error("Error subiendo archivo:", error);
        toast({ title: "Error al Subir Archivo", description: error.message, variant: "destructive" });
        setIsUploading(false);
        setUploadProgress(0);
      },
      async () => {
        try {
          const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
          const nowTimestamp = serverTimestamp();
          
          const docData: any = {
            name: fileToUpload.name,
            fileNameInStorage: fileNameInStorage, 
            fileURL: downloadURL,
            fileType: fileToUpload.type,
            fileSize: fileToUpload.size,
            description: data.description || "",
            tags: data.tags?.split(',').map(tag => tag.trim()).filter(tag => tag) || [],
            
            uploadedAt: nowTimestamp, 
            uploadedByUserId: currentUser.id, 
            uploadedByUserName: currentUser.name || "Usuario Desconocido", 

            lastVersionUploadedAt: nowTimestamp, 
            lastVersionUploadedByUserId: currentUser.id, 
            lastVersionUploadedByUserName: currentUser.name || "Usuario Desconocido", 

            currentVersion: 1, 
            versionHistory: [], 
            isPublic: false, 
          };

          if (data.relatedLeadId && data.relatedLeadId !== NO_SELECTION_VALUE) {
            docData.relatedLeadId = data.relatedLeadId;
          }
          if (data.relatedContactId && data.relatedContactId !== NO_SELECTION_VALUE) {
            docData.relatedContactId = data.relatedContactId;
          }


          await addDoc(collection(db, "documents"), docData);

          toast({
            title: "Documento Subido",
            description: `El archivo "${fileToUpload.name}" ha sido subido exitosamente.`,
          });
          onUploadSuccess(fileToUpload.name); // Pass file name on success
          form.reset({ 
            description: "", 
            tags: "",
            relatedLeadId: NO_SELECTION_VALUE,
            relatedContactId: NO_SELECTION_VALUE,
            file: undefined, 
          }); 
          const fileInput = document.getElementById('document-file-input') as HTMLInputElement | null;
          if (fileInput) {
            fileInput.value = ""; 
          }
          
        } catch (error) {
          console.error("Error guardando metadata del documento:", error);
          toast({ title: "Error al Guardar Documento", description: "Ocurrió un error al guardar la información del documento.", variant: "destructive" });
        } finally {
          setIsUploading(false);
          setUploadProgress(0);
        }
      }
    );
  };

  return (
    <Card className="w-full max-w-lg">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <UploadCloud className="h-6 w-6 text-primary" />
          Subir Nuevo Documento
        </CardTitle>
        <CardDescription>
          Carga archivos para almacenarlos y gestionarlos de forma segura en el CRM.
        </CardDescription>
      </CardHeader>
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)}>
          <CardContent className="space-y-4">
            <FormField
              control={form.control}
              name="file"
              render={({ fieldState }) => ( 
                <FormItem>
                  <FormLabel htmlFor="document-file-input">Archivo</FormLabel>
                  <FormControl>
                    <Input 
                      id="document-file-input"
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
            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Descripción (Opcional)</FormLabel>
                  <FormControl>
                    <Textarea placeholder="Breve descripción del documento..." {...field} disabled={isUploading} />
                  </FormControl>
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
                  <FormControl>
                    <Input placeholder="Ej. contrato, propuesta, importante" {...field} disabled={isUploading} />
                  </FormControl>
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
                        disabled={isUploading || (!!form.watch("relatedContactId") && form.watch("relatedContactId") !== NO_SELECTION_VALUE)}
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
                        disabled={isUploading || (!!form.watch("relatedLeadId") && form.watch("relatedLeadId") !== NO_SELECTION_VALUE)}
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


            {isUploading && (
              <div className="space-y-1">
                <Progress value={uploadProgress} className="w-full h-2" />
                <p className="text-xs text-muted-foreground text-center">Subiendo... {uploadProgress.toFixed(0)}%</p>
              </div>
            )}
          </CardContent>
          <CardFooter>
            <Button type="submit" disabled={isUploading || !currentUser}>
              {isUploading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <UploadCloud className="mr-2 h-4 w-4" />}
              {isUploading ? "Subiendo..." : "Subir Documento"}
            </Button>
          </CardFooter>
        </form>
      </Form>
    </Card>
  );
}
