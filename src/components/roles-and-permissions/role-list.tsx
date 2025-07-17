'use client';

import { useCollection } from 'react-firebase-hooks/firestore';
import { collection, deleteDoc, doc } from 'firebase/firestore';
import { db } from '@/lib/firebase'; // Assuming your firebase instance is exported as 'db' from here
import { Pencil, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';

import { Role } from '@/types'; // Import the Role interface
interface RoleListProps {
  onEdit: (role: Role) => void;
  onDelete: (roleId: string) => Promise<void>;
}

// Define the Role interface outside the component if it's not already defined elsewhere
// Or ensure it matches the structure of your Firebase documents
const RoleList: React.FC<RoleListProps> = ({ onEdit, onDelete }) => {
  const [value, loading, error] = useCollection(collection(db, 'roles'), {
    snapshotListenOptions: { includeMetadataChanges: true },
  });

  if (loading) {
    return <p>Cargando roles...</p>;
  }

  if (error) {
    return <p>Error al cargar roles: {error.message}</p>;
  }

  const roles: Role[] = value?.docs.map(doc => ({
    id: doc.id,
    name: doc.data().name,
    permissions: doc.data().permissions || [], // Assuming permissions is an array of strings
    // Map other properties here
  })) || [];

  return (
    <div>
      <h2 className="text-xl font-semibold mb-4">Lista de Roles</h2>
      {roles.length === 0 ? (
        <p>No hay roles definidos aún.</p>
      ) : (
        <ul>
          {roles.map(role => (
            <li key={role.id} className="border-b py-2 flex justify-between items-center">
              {role.name}
              <div>
                <Button variant="ghost" size="sm" onClick={() => onEdit(role)}>
                  <Pencil className="h-4 w-4" />
                </Button>
                <Button variant="ghost" size="sm" onClick={() => onDelete(role.id)}>
                  <Trash2 className="h-4 w-4 text-red-500" />
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

export default RoleList;