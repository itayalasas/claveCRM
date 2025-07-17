
// src/app/(app)/user-management/page.tsx
"use client";

import { useState, useEffect, useCallback } from "react";
import { useForm, type SubmitHandler } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
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
import { Loader2, Pen, Trash2, Users as UsersIcon } from "lucide-react"; // Added UsersIcon
import type { User, Role as UserRoleType } from "@/lib/types";
import { AddEditUserDialog, type UserFormValues, editUserFormSchema } from "@/components/user-management/add-edit-user-dialog";
import { UsersTable } from "@/components/user-management/users-table";
import { collection, getDocs, doc, setDoc, updateDoc, deleteDoc, serverTimestamp, getDoc } from "firebase/firestore";
import { db, auth } from "@/lib/firebase";
import { fetchSignInMethodsForEmail } from 'firebase/auth';
import { getStorage, ref as storageRef, uploadBytes, getDownloadURL } from "firebase/storage";
import { generateInitialsAvatar, dataUriToBlob, getRandomColor, getUserInitials } from "@/lib/utils";
import { getAllUsers } from "@/lib/userUtils"; // <-- AÑADIDO: Importar la nueva función
import { NAV_ITEMS } from "@/lib/constants"; // Import NAV_ITEMS
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card"; // Import Card components
import { useRouter } from "next/navigation"; // Import useRouter

// Define the schema for adding a new user (ensure it's defined if not imported from dialog component)
const addUserFormSchema = z.object({
    name: z.string().min(1, "El nombre es requerido"),
    email: z.string().email("Correo electrónico no válido"),
    password: z.string().min(6, "La contraseña debe tener al menos 6 caracteres"),
    role: z.string().min(1, "El rol es requerido"), 
});


export default function UserManagementPage() {
    const [usersData, setUsersData] = useState<User[]>([]); // Renamed to avoid conflict with Card's users prop if any
    const [roles, setRoles] = useState<UserRoleType[]>([]);
    const [isLoadingData, setIsLoadingData] = useState(true); // Combined loading state
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [userToEdit, setUserToEdit] = useState<User | null>(null);
    
    // CAMBIO: getAllUsers eliminado de useAuth()
    const { currentUser: adminUser, signup, updateUserInFirestore, loading: authLoading, hasPermission } = useAuth();
    const { toast } = useToast();
    const router = useRouter();

    const navItem = NAV_ITEMS.flatMap(item => item.subItems || item).find(item => item.href === '/user-management');
    const PageIcon = navItem?.icon || UsersIcon;

    const fetchPageData = useCallback(async () => {
        if (!adminUser) {
            setIsLoadingData(false);
            return;
        }
        setIsLoadingData(true);
        try {
            // CAMBIO: Llamar a getAllUsers importada
            const [fetchedUsers, rolesSnapshot] = await Promise.all([
                getAllUsers(),
                getDocs(collection(db, "roles"))
            ]);
            
            const rolesList = rolesSnapshot.docs.map(docSnap => ({ id: docSnap.id, ...docSnap.data() })) as UserRoleType[];
            setRoles(rolesList);

            const rolesMap = new Map(rolesList.map(role => [role.id, role.name]));
            const usersWithRoleNames = fetchedUsers.map(user => ({
                ...user,
                roleName: rolesMap.get(user.role) || user.role // Fallback to role ID if name not found
            }));       
            setUsersData(usersWithRoleNames);

        } catch (error: any) {
            console.error("Error fetching page data:", error);
            toast({ title: "Error al cargar datos", description: error.message || "No se pudieron cargar los datos necesarios.", variant: "destructive" });
        } finally {
            setIsLoadingData(false);
        }
    // CAMBIO: dependencias ajustadas
    }, [adminUser, toast]);

    useEffect(() => {
        if (!authLoading) {
            if (!adminUser || !hasPermission('ver-usuarios')) { // Asumiendo permiso 'ver-usuarios'
                router.push('/access-denied');
                return;
            }
            fetchPageData();
        } else if (!authLoading && !adminUser) {
            setUsersData([]);
            setRoles([]);
            setIsLoadingData(false);
        }
    // CAMBIO: fetchPageData ahora es estable en sus dependencias
    }, [authLoading, adminUser, hasPermission, router, fetchPageData]);

    const handleEditUser = useCallback((user: User) => {
        setUserToEdit(user);
        setIsDialogOpen(true);
    }, []);

    const handleAddUser = () => {
        if (!hasPermission('crear-usuario')) { // Asumiendo permiso 'crear-usuario'
            toast({ title: "Acción no permitida", description: "No tienes permisos para crear usuarios.", variant: "destructive" });
            return;
        }
        setUserToEdit(null);
        setIsDialogOpen(true);
    };

    const handleCloseDialog = () => {
        setIsDialogOpen(false);
        setUserToEdit(null);
    };

    const handleDeleteUser = async (userId: string, userName: string) => {
        if (!adminUser || !hasPermission('eliminar-usuario')) { // Asumiendo permiso 'eliminar-usuario'
             toast({ title: "Acción no permitida", description: "No tienes permisos para eliminar usuarios.", variant: "destructive" });
             return;
        }
         if (window.confirm(`¿Estás seguro de que quieres eliminar a ${userName}? Esta acción no se puede deshacer.`)) {
            try {
                 await deleteDoc(doc(db, "users", userId));
                 toast({ title: "Usuario Eliminado", description: `${userName} ha sido eliminado de la base de datos.` });
                 fetchPageData(); // Re-fetch data
            } catch (error: any) {
                console.error("Error deleting user from Firestore:", error);
                toast({ title: "Error al Eliminar Usuario", description: error.message || "No se pudo eliminar el usuario.", variant: "destructive" });
            }
         }
    };

    const handleSaveUserWithAvatar = async (userData: UserFormValues) => {
        if (!adminUser) {
            toast({ title: "Error de autenticación", variant: "destructive" });
            throw new Error("Usuario administrador no autenticado.");
        }
        setIsLoadingData(true); // Usar el loading state general para el submit también
        try {
            if (userToEdit && userToEdit.id) { 
                if (!hasPermission('editar-usuario')) { // Asumiendo permiso 'editar-usuario'
                    toast({ title: "Acción no permitida", description: "No tienes permisos para editar usuarios.", variant: "destructive" });
                    throw new Error("Permiso denegado para editar usuario.");
                }
                const editData = userData as z.infer<typeof editUserFormSchema>; 
                const roleIdToUpdate = editData.role;
                const updatedUserData: Partial<User> = {
                    name: editData.name,
                    role: roleIdToUpdate,
                };
                await updateUserInFirestore(userToEdit.id, updatedUserData, adminUser);
                toast({ title: "Usuario Actualizado", description: `Los datos de ${editData.name} han sido actualizados.` });
            } else { 
                 if (!hasPermission('crear-usuario')) { // Doble chequeo
                    toast({ title: "Acción no permitida", description: "No tienes permisos para crear usuarios.", variant: "destructive" });
                    throw new Error("Permiso denegado para crear usuario.");
                }
                const addData = userData as z.infer<typeof addUserFormSchema>; 
                const signInMethods = await fetchSignInMethodsForEmail(auth, addData.email);
                if (signInMethods.length > 0) {
                  toast({ title: "Error", description: "El correo electrónico ya está registrado.", variant: "destructive" });
                  setIsLoadingData(false);
                  return;
                }
                // Asegúrate que el signup en AuthContext use el tenantId del adminUser si es necesario
                const newFirebaseUser = await signup(addData.email, addData.password, addData.name, roles.find(r => r.id === addData.role)!, adminUser);

                if (newFirebaseUser && newFirebaseUser.uid) {
                    const initials = getUserInitials(addData.name); 
                    const avatarColor = getRandomColor();
                    const avatarDataUri = generateInitialsAvatar(initials, avatarColor);
                    const avatarBlob = dataUriToBlob(avatarDataUri);
                    const storage = getStorage();
                    const avatarRef = storageRef(storage, `avatars/${newFirebaseUser.uid}.png`);
                    await uploadBytes(avatarRef, avatarBlob);
                    const avatarUrl = await getDownloadURL(avatarRef);
                    const userDocRef = doc(db, "users", newFirebaseUser.uid);
                    // Almacenar el tenantId del admin que crea el usuario, o el del tenant actual si es diferente.
                    // Esto es crucial para la lógica multi-tenant.
                    await updateDoc(userDocRef, { avatarUrl: avatarUrl, tenantId: adminUser.tenantId }); 
                    toast({ title: "Usuario Creado", description: `El usuario ${addData.name} ha sido creado.` });
                } else {
                   toast({ title: "Error de Creación", description: "La creación del usuario falló.", variant: "destructive" });
                   return;
                }
            }
            fetchPageData(); // Re-fetch data
            handleCloseDialog();
        } catch (error: any) {
            console.error("Error guardando usuario:", error);
            toast({ title: "Error al Guardar Usuario", description: error.message || "Ocurrió un error.", variant: "destructive" });
        } finally {
            setIsLoadingData(false);
        }
    }; 

    if (authLoading) {
        return (
            <div className="flex flex-col gap-6 w-full p-6 items-center justify-center h-screen">
                <Loader2 className="h-12 w-12 animate-spin text-primary" />
                <p>Cargando autenticación...</p>
            </div>
        );
    }

    if (!adminUser || !hasPermission('ver-usuarios')) {
        return (
            <div className="flex flex-col items-center justify-center h-screen w-full p-6 text-center">
                <UsersIcon size={48} className="text-muted-foreground mb-4" />
                <h2 className="text-xl font-semibold">Acceso Denegado</h2>
                <p className="text-muted-foreground">No tienes permisos para ver la gestión de usuarios.</p>
            </div>
        );
    }

    return (
        // CAMBIO: Añadido w-full y estructura de Card
        <div className="flex flex-col gap-6 w-full">
            <Card className="shadow-lg w-full">
                <CardHeader>
                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
                        <div>
                            <CardTitle className="flex items-center gap-2 text-2xl">
                                <PageIcon className="h-6 w-6 text-primary" />
                                {navItem?.label || "Gestión de Usuarios"}
                            </CardTitle>
                            <CardDescription>
                                Administra los usuarios del sistema, sus roles y permisos.
                            </CardDescription>
                        </div>
                        {hasPermission('crear-usuario') && (
                            <Button onClick={handleAddUser} className="mt-4 sm:mt-0">
                                Añadir Nuevo Usuario
                            </Button>
                        )}
                    </div>
                </CardHeader>
                <CardContent>
                    {isLoadingData && usersData.length === 0 ? (
                        <div className="flex justify-center items-center h-64">
                            <Loader2 className="h-8 w-8 animate-spin text-primary" />
                            <p className="ml-2">Cargando usuarios...</p>
                        </div>
                    ) : (
                        <UsersTable
                            users={usersData}
                            isLoading={isLoadingData}
                            onEditUser={handleEditUser} 
                            onDeleteUser={(userId) => {
                                const user = usersData.find(u => u.id === userId);
                                if (user && user.name) handleDeleteUser(userId, user.name);
                                else if (user) handleDeleteUser(userId, "este usuario") // Fallback si el nombre no está
                            }}
                            // Pasar permisos para acciones en la tabla
                            canEditUsers={hasPermission('editar-usuario')}
                            canDeleteUsers={hasPermission('eliminar-usuario')}
                        />
                    )}
                </CardContent>
            </Card>

            <AddEditUserDialog
                isOpen={isDialogOpen}
                onOpenChange={setIsDialogOpen}
                userToEdit={userToEdit}
                roles={roles}
                onSave={handleSaveUserWithAvatar}
                isLoadingSubmit={isLoadingData} // Pasar el estado de carga al diálogo
            />
        </div>
    );
}
