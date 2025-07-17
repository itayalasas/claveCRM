'use client';

import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { PlusCircle } from 'lucide-react';
import { useState, useCallback, useEffect } from 'react';
import { collection, addDoc, updateDoc, doc, deleteDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase'; // Assuming your Firebase db instance is exported from here
import { useAuth } from '@/contexts/auth-context';
import { useRouter } from 'next/navigation';
import AddEditRoleDialog from '@/components/roles-and-permissions/add-edit-role-dialog';
import RoleList from '@/components/roles-and-permissions/role-list';
import { Role } from '@/types'; // Import the Role interface

const RolesAndPermissionsPage = () => {
  const [editingRoleData, setEditingRoleData] = useState<Role | null>(null); // State to hold role data when editing, typed with Role interface
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  const { currentUser, loading, hasPermission } = useAuth();
  const router = useRouter();

  useEffect(() => {
    // Espera a que el estado de carga termine
    if (!loading) {
      // Verifica si el usuario existe y tiene el permiso 'ver-roles'
      if (!currentUser || !hasPermission('ver-roles')) {
        // Si no tiene permiso, redirige
        router.push('/access-denied'); // O la ruta que prefieras para acceso denegado
      }
    }
  }, [currentUser, loading, hasPermission, router]);

  // Implement handleSaveRole function
  const handleSaveRole = async (roleData: { name: string; permissions: string[] }) => {
    try {
      const rolesCollectionRef = collection(db, "roles");
      if (editingRoleData) {
        // Update existing role
        const roleDocRef = doc(db, "roles", editingRoleData.id);
        await updateDoc(roleDocRef, roleData);
      } else {
        // Add new role
        const docRef = await addDoc(rolesCollectionRef, roleData);
      }
      setIsDialogOpen(false); // Close the dialog
      setEditingRoleData(null); // Clear editing state
    } catch (error) {
    }
  };

  // Implement handleEditRole function (assuming role object is passed from RoleList)
  const handleEditRole = useCallback((role: Role) => { // role object should contain id, name, and permissions, typed with Role interface
    if (role) {
      setEditingRoleData(role);
      setIsDialogOpen(true);
    } else {
        console.error("Error: No role data provided for editing.");
    }
  }, []);

  // Implement handleDeleteRole async function
  const handleDeleteRole = async (roleId: string) => {
    try {
      const roleDocRef = doc(db, "roles", roleId);
      await deleteDoc(roleDocRef);
      console.log("Rol eliminado con ID:", roleId);
    } catch (error) {
      console.error("Error al eliminar el rol:", error);
    }
  };

  const handleAddRoleClick = () => {
    setIsDialogOpen(true);
  };

  // Si loading es true, puedes mostrar un spinner o mensaje de carga
  if (loading) {
    return (
       <div className="flex flex-col items-center justify-center h-screen">
           <Skeleton className="h-10 w-1/2 mb-4" />
           <Skeleton className="h-6 w-1/3 mb-8" />
           <Skeleton className="h-64 w-2/3" />
       </div>
    );
  }

  return (
    <div className="flex-1 space-y-4 p-8 pt-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">Gestión de Roles y Permisos</h2>
        <Button onClick={() => setIsDialogOpen(true)}>
          <PlusCircle className="mr-2 h-4 w-4" />
          Agregar Nuevo Rol
        </Button>
      </div>
      <Separator />
      <RoleList onEdit={handleEditRole} onDelete={handleDeleteRole} /> {/* Removed roles prop */}
      
      {/*
        The AddEditRoleDialog is a modal that overlays the content. Pass the onSave prop.
      */}
 <AddEditRoleDialog
 isOpen={isDialogOpen}
        onClose={() => {
 setIsDialogOpen(false);
 setEditingRoleData(null); // Clear editing state when modal is closed
 }}
        onSave={handleSaveRole} // Pass the save handler
        initialData={editingRoleData} // Pass the editingRoleData here
      />
    </div>
  );
};

export default RolesAndPermissionsPage;