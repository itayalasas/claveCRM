"use client";

import { useState, useEffect } from "react";
import { useForm, SubmitHandler } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import type { User, UserRole } from "@/lib/types";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useAuth } from "@/contexts/auth-context";
import { Loader2 } from "lucide-react";
import { collection, getDocs, setDoc, doc } from "firebase/firestore";
import { db, auth } from "@/lib/firebase"; // Assuming db and auth are exported from "@/lib/firebase"
import { fetchSignInMethodsForEmail } from 'firebase/auth';
const addUserFormSchema = z.object({
  name: z.string().min(1, "El nombre es obligatorio."),
  email: z.string().email("Correo electrónico inválido."),
  password: z.string().min(6, "La contraseña debe tener al menos 6 caracteres."),
  role: z.string().min(1, "Debes seleccionar un rol."),
});

const editUserFormSchema = z.object({
  name: z.string().min(1, "El nombre es obligatorio."),
  email: z.string().email("Correo electrónico inválido."),
  role: z.string().min(1, "Debes seleccionar un rol."),
});

type UserFormValues = z.infer<typeof addUserFormSchema> | z.infer<typeof editUserFormSchema>;

interface AddEditUserDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  userToEdit?: User | null; 
  onSave: (userData: UserFormValues) => Promise<void>; // Callback to save user data (including creation)
}

export function AddEditUserDialog({ isOpen, onOpenChange, userToEdit, onSave }: AddEditUserDialogProps) {
  const { signup, updateUserInFirestore, currentUser: adminUser } = useAuth();
  const { toast } = useToast();
  
  const formSchema = userToEdit ? editUserFormSchema : addUserFormSchema;

  const form = useForm<UserFormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: userToEdit 
      ? { name: userToEdit.name, email: userToEdit.email, role: userToEdit.role }
 : { name: "", email: "", password: "", role: "" },
  });

   const [roles, setRoles] = useState<UserRole[]>([]);
  useEffect(() => {
     if (isOpen) {
       const fetchRoles = async () => {
 try {
 const fetchedRoles = await getDocs(collection(db, 'roles'));
 setRoles(fetchedRoles.docs.map(doc => ({ id: doc.id, ...doc.data() } as UserRole)));
 } catch (error) {
 console.error("Error fetching roles:", error);
 }
       };
 fetchRoles();
     }
  }, [isOpen]); // Dependency array for the first useEffect
  
  useEffect(() => {
    if (isOpen) { // Ensure reset only happens when dialog is open
      if (userToEdit) {
        form.reset({
          name: userToEdit.name,
          email: userToEdit.email,
          role: userToEdit.role,
        });
      } else {
        form.reset({ 
          name: "",
          email: "",
          password: "",
 role: "",
        });
      }
    }
  }, [userToEdit, isOpen, form]); // Dependency array for the second useEffect

  const onSubmitHandler: SubmitHandler<UserFormValues> = async (data) => {
    console.log("onSubmitHandler: Iniciando envío del formulario.");
    if (userToEdit) { // Editing existing user
      if (!adminUser) {
        toast({ title: "Error de autenticación", description: "No se pudo verificar el administrador.", variant: "destructive" });
        return;
      }
      try {
        const updatedUserData: Partial<User> = {
            name: data.name,
            role: (data as z.infer<typeof editUserFormSchema>).role, // Type assertion
        };
 await updateUserInFirestore(userToEdit.id, updatedUserData, adminUser); // Parent will refetch/update list
        toast({ title: "Usuario Actualizado", description: `Los datos de ${data.name} han sido actualizados.` });
        onOpenChange(false);
      } catch (error: any) {
        console.error("Error updating user:", error); // Handle error (e.g., with a toast)
        toast({ title: "Error al Actualizar", description: error.message || "No se pudo actualizar el usuario.", variant: "destructive" });
      } finally {} // No need to close dialog here, parent will handle after refetch
    } else { // Adding new user
      if (!adminUser) {
        toast({ title: "Error de autenticación", description: "No se pudo verificar el administrador.", variant: "destructive" });
        return;
      }
      const addData = data as z.infer<typeof addUserFormSchema>; // Type assertion
      try {
        // Call the parent's onSave function with the form data
        // The parent will handle user creation (including auth and firestore/avatar).
        // signup function in auth-context should return null if email is already in use.
        const createdUser = await onSave(addData);

        // If createdUser is null, it means signup returned null (duplicate email)
        if (createdUser === null) {
 form.setError("email", {
            type: "manual",
 message: "Este correo electrónico ya está registrado.",
          });
        } else {
           // If onSave (and signup) was successful, show success toast and close dialog
           toast({ title: "Usuario Creado", description: `El usuario ${addData.name} ha sido creado.` });
           onOpenChange(false); // Close dialog on success
        }
      } catch (error: any) {
 console.error("Error creating user (dialog):", error); // Handle other errors that onSave or signup might throw
 if (error.code === 'auth/email-already-in-use') {
 toast({ title: "Error de Registro", description: "Este correo electrónico ya está registrado.", variant: "destructive" });
 } else {
 toast({ title: "Error al Crear Usuario", description: error.message || "No se pudo crear el usuario.", variant: "destructive" });
 }

        }
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle>{userToEdit ? "Editar Usuario" : "Añadir Nuevo Usuario"}</DialogTitle>
          <DialogDescription>
            {userToEdit ? "Actualiza los detalles de este usuario." : "Completa la información para el nuevo usuario."}
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmitHandler)} className="space-y-4 py-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Nombre Completo</FormLabel>
                  <FormControl>
                    <Input placeholder="Ej. Juan Pérez" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Correo Electrónico</FormLabel>
                  <FormControl>
                    <Input type="email" placeholder="Ej. juan.perez@ejemplo.com" {...field} readOnly={!!userToEdit} />
                  </FormControl>
                   {!!userToEdit && <FormDescription className="text-xs">El correo electrónico no se puede cambiar después de la creación.</FormDescription>}
                  <FormMessage />
                </FormItem>
              )}
            />
            {!userToEdit && ( 
              <FormField
                control={form.control}
                name="password"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Contraseña</FormLabel>
                    <FormControl>
                      <Input type="password" placeholder="Mínimo 6 caracteres" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}
            {userToEdit && (
                <div className="text-sm p-3 bg-muted/50 rounded-md">
                    <p className="font-medium">Gestión de Contraseña:</p>
                    <p className="text-xs text-muted-foreground">
                        Los cambios de contraseña para usuarios existentes se realizan a través del proceso de "Olvidé mi contraseña" por el propio usuario, o por un administrador mediante herramientas específicas (no disponible en este formulario).
                    </p>
                </div>
            )}
            <FormField
              control={form.control}
              name="role"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Rol / Cargo</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecciona un rol" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {roles.map((role) => (
                        <SelectItem key={role.id} value={role.id} className="capitalize">
                          {role.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={form.formState.isSubmitting}>Cancelar</Button>
              <Button type="submit" disabled={form.formState.isSubmitting}>
                {form.formState.isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {form.formState.isSubmitting ? "Guardando..." : (userToEdit ? "Guardar Cambios" : "Crear Usuario")}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
