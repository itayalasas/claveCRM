
"use client";

import { useState, useEffect, useCallback } from "react";
import { useForm, SubmitHandler } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import type { Contact, ContactList } from "@/lib/types";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Checkbox } from "@/components/ui/checkbox";
import { PlusCircle, Trash2, Loader2, Users } from "lucide-react";
import { db } from "@/lib/firebase";
import { collection, addDoc, getDocs, doc, serverTimestamp, query, where, updateDoc, arrayUnion, arrayRemove, writeBatch, setDoc } from "firebase/firestore";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
import { getUserInitials } from "@/lib/utils";

const addContactFormSchema = z.object({
  email: z.string().email("Correo electrónico inválido."),
  firstName: z.string().optional(),
  lastName: z.string().optional(),
  subscribed: z.boolean().default(true),
});
type AddContactFormValues = z.infer<typeof addContactFormSchema>;

const selectContactFormSchema = z.object({
  contactId: z.string().min(1, "Debes seleccionar un contacto"),
});
type SelectContactFormValues = z.infer<typeof selectContactFormSchema>;


interface ManageContactsDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  list: ContactList;
  allContacts: Contact[]; // All contacts in the system
  onContactsUpdated: () => void; // Callback to refresh parent data
}

export function ManageContactsDialog({ isOpen, onOpenChange, list, allContacts, onContactsUpdated }: ManageContactsDialogProps) {
  const [contactsInList, setContactsInList] = useState<Contact[]>([]);
  const [availableContacts, setAvailableContacts] = useState<Contact[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();

  const addContactForm = useForm<AddContactFormValues>({
    resolver: zodResolver(addContactFormSchema),
    defaultValues: { email: "", firstName: "", lastName: "", subscribed: true },
  });

  const selectContactForm = useForm<SelectContactFormValues>({
    resolver: zodResolver(selectContactFormSchema),
    defaultValues: { contactId: "" },
  });

  const fetchContactsInList = useCallback(async () => {
    if (!list?.id) return;
    setIsLoading(true);
    try {
      // Contacts are in the 'contacts' collection, filtered by listIds array containing current list.id
      const q = query(collection(db, "contacts"), where("listIds", "array-contains", list.id));
      const querySnapshot = await getDocs(q);
      const fetchedContacts = querySnapshot.docs.map(docSnap => ({ id: docSnap.id, ...docSnap.data() } as Contact));
      setContactsInList(fetchedContacts);
    } catch (error) {
      console.error("Error fetching contacts for list:", error);
      toast({ title: "Error al Cargar Contactos de Lista", variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  }, [list, toast]);

  useEffect(() => {
    if (isOpen && list) {
      fetchContactsInList();
    }
  }, [isOpen, list, fetchContactsInList]);

  useEffect(() => {
    // Update available contacts when allContacts or contactsInList changes
    const contactsInListIds = contactsInList.map(c => c.id);
    setAvailableContacts(allContacts.filter(c => !contactsInListIds.includes(c.id)));
  }, [allContacts, contactsInList]);

  const handleAddExistingContactSubmit: SubmitHandler<SelectContactFormValues> = async (data) => {
    if (!list) return;
    setIsSubmitting(true);
    try {
      const contactDocRef = doc(db, "contacts", data.contactId);
      await updateDoc(contactDocRef, {
        listIds: arrayUnion(list.id)
      });
      // Update contact count on list
      const listDocRef = doc(db, "contactLists", list.id);
      await updateDoc(listDocRef, {
        contactCount: contactsInList.length + 1
      });
      toast({ title: "Contacto Añadido", description: "El contacto existente ha sido añadido a la lista." });
      fetchContactsInList(); // Refresh contacts in list
      onContactsUpdated(); // Refresh parent data
      selectContactForm.reset();
    } catch (error) {
      console.error("Error adding existing contact to list:", error);
      toast({ title: "Error al Añadir Contacto", variant: "destructive" });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleAddNewContactSubmit: SubmitHandler<AddContactFormValues> = async (data) => {
    if (!list) return;
    setIsSubmitting(true);
    try {
      // Check if contact with this email already exists
      const q = query(collection(db, "contacts"), where("email", "==", data.email));
      const existingSnapshot = await getDocs(q);

      let contactId: string;
      let isNewContactInSystem = false;

      if (existingSnapshot.empty) {
        // Add new contact to 'contacts' collection
        const newContactRef = doc(collection(db, "contacts"));
        contactId = newContactRef.id;
        await setDoc(newContactRef, {
          ...data,
          id: contactId, // Explicitly set ID
          listIds: [list.id],
          createdAt: serverTimestamp(),
        });
        isNewContactInSystem = true;
        toast({ title: "Contacto Creado", description: `Contacto ${data.email} creado y añadido a la lista.` });
      } else {
        // Contact exists, add listId to it if not already there
        contactId = existingSnapshot.docs[0].id;
        const existingContactData = existingSnapshot.docs[0].data() as Contact;
        if (!existingContactData.listIds?.includes(list.id)) {
          await updateDoc(doc(db, "contacts", contactId), {
            listIds: arrayUnion(list.id)
          });
          toast({ title: "Contacto Añadido", description: `Contacto ${data.email} existente añadido a la lista.` });
        } else {
          toast({ title: "Información", description: `Contacto ${data.email} ya está en esta lista.` });
          setIsSubmitting(false);
          return;
        }
      }
      
      // Update contact count on list
      const listDocRef = doc(db, "contactLists", list.id);
      await updateDoc(listDocRef, {
          contactCount: contactsInList.length + 1 // This might be slightly off if contact was already in list but added again, but good for now.
      });

      addContactForm.reset();
      fetchContactsInList();
      onContactsUpdated();
    } catch (error) {
      console.error("Error creating/adding contact to list:", error);
      toast({ title: "Error al Guardar Contacto", variant: "destructive" });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRemoveContactFromList = async (contactId: string) => {
    if (!list) return;
    if (!window.confirm("¿Seguro que quieres quitar este contacto de la lista? (No se eliminará de tus contactos generales)")) return;
    setIsSubmitting(true);
    try {
      const contactDocRef = doc(db, "contacts", contactId);
      await updateDoc(contactDocRef, {
        listIds: arrayRemove(list.id)
      });
      const listDocRef = doc(db, "contactLists", list.id);
      await updateDoc(listDocRef, {
        contactCount: Math.max(0, contactsInList.length - 1)
      });
      toast({ title: "Contacto Eliminado de la Lista", description: "El contacto ha sido quitado de esta lista." });
      fetchContactsInList();
      onContactsUpdated();
    } catch (error) {
      console.error("Error removing contact from list:", error);
      toast({ title: "Error al Quitar Contacto", variant: "destructive" });
    } finally {
      setIsSubmitting(false);
    }
  };


  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Gestionar Contactos en &quot;{list?.name}&quot;</DialogTitle>
          <DialogDescription>Añade, visualiza o elimina contactos de esta lista.</DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 py-4">
          {/* Section to add NEW contact */}
          <div className="space-y-4 p-4 border rounded-md">
            <h3 className="font-semibold text-md">Añadir Nuevo Contacto a la Lista</h3>
            <Form {...addContactForm}>
              <form onSubmit={addContactForm.handleSubmit(handleAddNewContactSubmit)} className="space-y-3">
                <FormField control={addContactForm.control} name="email" render={({ field }) => (
                  <FormItem><FormLabel>Email</FormLabel><FormControl><Input placeholder="ejemplo@dominio.com" {...field} /></FormControl><FormMessage /></FormItem>
                )} />
                <FormField control={addContactForm.control} name="firstName" render={({ field }) => (
                  <FormItem><FormLabel>Nombre (Opcional)</FormLabel><FormControl><Input placeholder="Juan" {...field} /></FormControl><FormMessage /></FormItem>
                )} />
                <FormField control={addContactForm.control} name="lastName" render={({ field }) => (
                  <FormItem><FormLabel>Apellido (Opcional)</FormLabel><FormControl><Input placeholder="Pérez" {...field} /></FormControl><FormMessage /></FormItem>
                )} />
                <FormField control={addContactForm.control} name="subscribed" render={({ field }) => (
                  <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-3 shadow-sm">
                    <FormControl><Checkbox checked={field.value} onCheckedChange={field.onChange} /></FormControl>
                    <div className="space-y-1 leading-none"><FormLabel>Suscrito a comunicaciones</FormLabel></div>
                  </FormItem>
                )} />
                <Button type="submit" disabled={isSubmitting}>
                  {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <PlusCircle className="mr-2 h-4 w-4" />}
                  Crear y Añadir Contacto
                </Button>
              </form>
            </Form>
          </div>

          {/* Section to add EXISTING contact */}
          <div className="space-y-4 p-4 border rounded-md">
            <h3 className="font-semibold text-md">Añadir Contacto Existente a la Lista</h3>
            {availableContacts.length > 0 ? (
              <Form {...selectContactForm}>
                <form onSubmit={selectContactForm.handleSubmit(handleAddExistingContactSubmit)} className="space-y-3">
                  <FormField control={selectContactForm.control} name="contactId" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Seleccionar Contacto</FormLabel>
                       <FormControl>
                          <select {...field} className="w-full p-2 border rounded-md bg-background">
                            <option value="">-- Elige un contacto --</option>
                            {availableContacts.map(c => (
                              <option key={c.id} value={c.id}>{c.firstName || c.lastName ? `${c.firstName || ''} ${c.lastName || ''} (${c.email})` : c.email}</option>
                            ))}
                          </select>
                        </FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <Button type="submit" variant="secondary" disabled={isSubmitting}>
                    {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <PlusCircle className="mr-2 h-4 w-4" />}
                    Añadir Contacto Seleccionado
                  </Button>
                </form>
              </Form>
            ) : (
              <p className="text-sm text-muted-foreground">Todos tus contactos ya están en esta lista o no tienes otros contactos.</p>
            )}
          </div>
        </div>
        
        <div className="mt-6">
          <h3 className="font-semibold text-md mb-2">Contactos en esta Lista ({contactsInList.length})</h3>
          {isLoading ? (
            <p>Cargando contactos...</p>
          ) : contactsInList.length > 0 ? (
            <ScrollArea className="h-64 border rounded-md">
              <div className="p-4 space-y-2">
                {contactsInList.map(contact => (
                  <div key={contact.id} className="flex items-center justify-between p-2 hover:bg-muted/50 rounded-md">
                    <div className="flex items-center gap-3">
                      <Avatar className="h-8 w-8">
                        <AvatarImage src={`https://avatar.vercel.sh/${contact.email}.png`} alt={contact.firstName || contact.email} data-ai-hint="user avatar" />
                        <AvatarFallback>{getUserInitials(contact.firstName || contact.email)}</AvatarFallback>
                      </Avatar>
                      <div>
                        <p className="text-sm font-medium">{contact.firstName || ""} {contact.lastName || ""}</p>
                        <p className="text-xs text-muted-foreground">{contact.email}</p>
                      </div>
                       {contact.subscribed ? <Badge variant="default" className="text-xs bg-green-500 hover:bg-green-600">Suscrito</Badge> : <Badge variant="secondary" className="text-xs">No Suscrito</Badge>}
                    </div>
                    <Button variant="ghost" size="icon" onClick={() => handleRemoveContactFromList(contact.id)} disabled={isSubmitting} title="Quitar de la lista">
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                ))}
              </div>
            </ScrollArea>
          ) : (
            <p className="text-sm text-muted-foreground">No hay contactos en esta lista todavía.</p>
          )}
        </div>

        <DialogFooter className="mt-6">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cerrar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
