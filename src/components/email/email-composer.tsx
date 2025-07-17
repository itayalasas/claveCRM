
"use client";

import * as React from "react";
import { useState, useEffect, type ChangeEvent } from "react";
import { useForm, type SubmitHandler } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Send, Paperclip, Archive as ArchiveIcon, Loader2, Trash2, MoreVertical, XCircle, UserPlus, X as XIcon, Edit2, Maximize, Minimize } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { db } from "@/lib/firebase"; // Import firebase db
import type { Lead, Contact } from "@/lib/types";
import { ScrollArea } from "../ui/scroll-area";
import { Separator } from "../ui/separator";
import { useAuth } from "@/contexts/auth-context"; // Import useAuth hook


const emailComposerSchema = z.object({
  to: z.string().email("Dirección de correo 'Para' inválida."),
  cc: z.string().optional().refine(val => !val || val.split(',').every(email => z.string().email().safeParse(email.trim()).success), {
    message: "Una o más direcciones en CC son inválidas."
  }),
  bcc: z.string().optional().refine(val => !val || val.split(',').every(email => z.string().email().safeParse(email.trim()).success), {
    message: "Una o más direcciones en CCO son inválidas."
  }),
  subject: z.string().min(1, "El asunto es obligatorio."),
  body: z.string().min(1, "El cuerpo del correo es obligatorio."),
});
import { collection, addDoc, serverTimestamp } from "firebase/firestore"; // Import firestore functions

type EmailComposerFormValues = z.infer<typeof emailComposerSchema>;

interface EmailComposerProps {
  initialTo?: string;
  initialSubject?: string;
  initialBody?: string;
  initialAttachments?: { name: string; url: string; size?: number; type?: string }[];
  onQueueEmail: (data: { to: string; cc?: string; bcc?: string; subject: string; body: string; }, attachments: File[]) => Promise<boolean>;
  onSaveDraft: (data: { to: string; cc?: string; bcc?: string; subject: string; body: string; }, attachments: File[]) => Promise<boolean>;
  isSending?: boolean;
  isSavingDraft?: boolean;
  onClose?: () => void;
  leads?: Lead[];
  contacts?: Contact[];
}

export function EmailComposer({
  initialTo = "",
  initialSubject = "",
  initialBody = "",
  initialAttachments = [],
  onQueueEmail,
  onSaveDraft,
  isSending = false,
  isSavingDraft = false,
  onClose,
  leads = [],
  contacts = [],
}: EmailComposerProps) {
  const { currentUser } = useAuth(); // Get the authenticated user
  const { toast } = useToast();
  const [showCc, setShowCc] = useState(false);
  const [showBcc, setShowBcc] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [recipientSearchTerm, setRecipientSearchTerm] = useState("");
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const form = useForm<EmailComposerFormValues>({
    resolver: zodResolver(emailComposerSchema),
    defaultValues: { to: initialTo, cc: "", bcc: "", subject: initialSubject, body: initialBody, },
  });

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    if (event.target.files) setSelectedFiles(prevFiles => [...prevFiles, ...Array.from(event.target.files as FileList)]);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const removeSelectedFile = (fileName: string) => setSelectedFiles(prevFiles => prevFiles.filter(file => file.name !== fileName));

  // Modify onSubmit to save email to Firebase
  const onSubmit: SubmitHandler<EmailComposerFormValues> = async (data) => {
    if (!currentUser) {
      toast({ title: "Error", description: "Usuario no autenticado.", variant: "destructive" });
      return;
    }

    try {
      // Prepare email data for Firestore
     const emailData = {
        to: data.to,
        cc: data.cc || null,
        bcc: data.bcc || null,
        subject: data.subject,
        bodyHtml: data.body,
        from: currentUser.email, // Use authenticated user's email
        fromName: currentUser.name || currentUser.email, // Use authenticated user's name or email
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(), // Keep updatedAt for potential future edits (draft to sent)
        status: "pending", // Initial status
        userId: currentUser.id, // Use authenticated user's ID from currentUser.id
        attachments: selectedFiles.map(file => ({ // Basic attachment info
          name: file.name,
          type: file.type,
          size: file.size,
        })),
      };
      await addDoc(collection(db, "outgoingEmails"), emailData);
      if (onClose) onClose();
    } catch (error) { toast({ title: "Error al enviar correo.", description: "No se pudo guardar el correo en la base de datos.", variant: "destructive" }); }
  };

  const handleDraftSave: SubmitHandler<EmailComposerFormValues> = async (data) => {
    const success = await onSaveDraft(data, selectedFiles);
    if (success && onClose) onClose();
  };
  
  const addRecipient = (email: string, field: "to" | "cc" | "bcc") => {
    const currentVal = form.getValues(field) || "";
    form.setValue(field, currentVal ? `${currentVal.trim()}, ${email}` : email, { shouldValidate: true });
    setRecipientSearchTerm("");
  };

  const filteredRecipients = React.useMemo(() => {
    if (!recipientSearchTerm.trim()) return [];
    const lowerSearch = recipientSearchTerm.toLowerCase();
    const foundLeads = leads
        .filter(l => l.email && (l.name.toLowerCase().includes(lowerSearch) || l.email.toLowerCase().includes(lowerSearch)))
        .map(l => ({ id: l.id, name: l.name, email: l.email!, type: 'Lead' }));
    const foundContacts = contacts
        .filter(c => c.email && ( ((c.firstName || "") + " " + (c.lastName || "")).toLowerCase().includes(lowerSearch) || c.email.toLowerCase().includes(lowerSearch) ))
        .map(c => ({ id: c.id, name: `${c.firstName || ""} ${c.lastName || ""}`.trim(), email: c.email!, type: 'Contacto' }));
    return [...foundLeads, ...foundContacts].slice(0, 5);
  }, [recipientSearchTerm, leads, contacts]);

  const renderRecipientInput = (fieldName: "to" | "cc" | "bcc", label: string) => (
    <FormField
      control={form.control}
      name={fieldName}
      render={({ field }) => (
        <FormItem className="flex-grow">
          <div className="flex items-center">
            <FormLabel className="w-12 pr-2 text-right text-xs text-muted-foreground shrink-0">{label}</FormLabel>
            <FormControl>
              <Input placeholder={`${label.toLowerCase()}@ejemplo.com`} {...field} className="text-sm h-8 border-0 border-b rounded-none px-1 focus-visible:ring-0" />
            </FormControl>
          </div>
          <FormMessage className="pl-12 text-xs" />
        </FormItem>
      )}
    />
  );

  return (
    <div className="flex flex-col h-full bg-card text-card-foreground border rounded-lg shadow-md">
      {/* Header */}
      <div className="p-2 border-b flex items-center justify-between bg-muted/40">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" className="h-7 w-7" title="Cerrar Compositor" onClick={onClose} disabled={isSending || isSavingDraft}>
            <XCircle className="h-5 w-5" />
          </Button>
          <h3 className="text-sm font-semibold">Correo Nuevo</h3>
        </div>
        <div className="flex items-center gap-1">
            {/* Future actions like templates, pop-out, etc. */}
            {/* <Button variant="ghost" size="icon" className="h-7 w-7" title="Maximizar" disabled><Maximize className="h-4 w-4"/></Button> */}
        </div>
      </div>
      
      <Form {...form}>
        <form className="flex flex-col flex-grow overflow-hidden">
          {/* Recipients Area */}
          <div className="p-2 space-y-1 border-b shrink-0">
            {renderRecipientInput("to", "Para")}
            {showCc && renderRecipientInput("cc", "CC")}
            {showBcc && renderRecipientInput("bcc", "CCO")}
            
            <div className="flex items-center pl-12">
                <Button type="button" variant="link" onClick={() => setShowCc(!showCc)} className="p-0 h-auto text-xs text-muted-foreground hover:text-primary">{showCc ? "Ocultar CC" : "Mostrar CC"}</Button>
                <Separator orientation="vertical" className="h-3 mx-1.5" />
                <Button type="button" variant="link" onClick={() => setShowBcc(!showBcc)} className="p-0 h-auto text-xs text-muted-foreground hover:text-primary">{showBcc ? "Ocultar CCO" : "Mostrar CCO"}</Button>
            </div>

            <div className="pl-12 relative">
              <Input 
                type="search"
                placeholder="Buscar Contacto/Lead para añadir..."
                value={recipientSearchTerm}
                onChange={(e) => setRecipientSearchTerm(e.target.value)}
                className="text-xs h-7 mt-1"
              />
              {recipientSearchTerm && filteredRecipients.length > 0 && (
                <div className="absolute z-10 w-full mt-1 bg-background border rounded-md shadow-lg max-h-32 overflow-y-auto">
                  {filteredRecipients.map(r => (
                      <Button 
                        key={`${r.type}-${r.id}`} 
                        variant="ghost" 
                        size="sm" 
                        className="w-full justify-start text-xs h-auto py-1 px-2"
                        onClick={() => addRecipient(r.email, "to")} // Default to 'to' field for now
                      >
                        <UserPlus className="mr-1.5 h-3 w-3" /> {r.name} ({r.email}) - <span className="ml-1 text-muted-foreground text-[10px]">{r.type}</span>
                      </Button>
                    ))}
                </div>
              )}
            </div>

            <FormField
              control={form.control}
              name="subject"
              render={({ field }) => (
                <FormItem className="mt-1">
                  <FormControl>
                    <Input placeholder="Asunto" {...field} className="border-0 rounded-none shadow-none px-1 focus-visible:ring-0 text-sm h-9" />
                  </FormControl>
                  <FormMessage className="pl-12 text-xs" />
                </FormItem>
              )}
            />
          </div>

          {/* Body Area */}
          <ScrollArea className="flex-grow">
            <FormField
              control={form.control}
              name="body"
              render={({ field }) => (
                <FormItem className="h-full flex flex-col">
                  <FormControl className="flex-grow">
                    <Textarea
                      placeholder="Escribe tu mensaje aquí..."
                      {...field}
                      className="flex-grow resize-none border-0 shadow-none p-2 focus-visible:ring-0 text-sm min-h-[150px] h-full"
                    />
                  </FormControl>
                  <FormMessage className="p-2"/>
                </FormItem>
              )}
            />
          </ScrollArea>
          
          {/* Attachments List */}
          {selectedFiles.length > 0 && (
            <div className="p-2 border-t shrink-0">
              <Label className="text-xs font-medium">Adjuntos ({selectedFiles.length}):</Label>
              <ScrollArea className="h-auto max-h-20 mt-1">
                <ul className="space-y-1">
                  {selectedFiles.map(file => (
                    <li key={file.name} className="flex justify-between items-center text-xs bg-muted/50 p-1 rounded-sm">
                      <span className="truncate" title={file.name}>{file.name} ({(file.size / 1024).toFixed(1)} KB)</span>
                      <Button type="button" variant="ghost" size="icon" className="h-5 w-5" onClick={() => removeSelectedFile(file.name)}>
                        <XIcon className="h-3 w-3 text-destructive" />
                      </Button>
                    </li>
                  ))}
                </ul>
              </ScrollArea>
            </div>
          )}

          {/* Footer Actions */}
          <div className="p-2 border-t flex justify-between items-center shrink-0 bg-muted/40">
            <div className="flex gap-1">
              <Button type="button" onClick={form.handleSubmit(onSubmit)} disabled={isSending || isSavingDraft} size="sm">
                {isSending ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Send className="mr-1.5 h-4 w-4" />}
                Enviar
              </Button>
              <Button type="button" variant="outline" onClick={form.handleSubmit(handleDraftSave)} disabled={isSending || isSavingDraft} size="sm">
                {isSavingDraft ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <ArchiveIcon className="mr-1.5 h-4 w-4" />}
                Guardar Borrador
              </Button>
            </div>
            <div className="flex gap-1">
             <Button type="button" variant="ghost" size="icon" className="h-7 w-7" title="Adjuntar archivo" onClick={() => fileInputRef.current?.click()} disabled={isSending || isSavingDraft}>
                <Paperclip className="h-4 w-4" />
              </Button>
              <input type="file" multiple ref={fileInputRef} onChange={handleFileChange} className="hidden" accept="image/*,application/pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv"/>
              {/* <Button type="button" variant="ghost" size="icon" className="h-7 w-7" disabled title="Opciones de envío (Próximamente)"><MoreVertical className="h-4 w-4" /></Button> */}
            </div>
          </div>
        </form>
      </Form>
    </div>
  );
}