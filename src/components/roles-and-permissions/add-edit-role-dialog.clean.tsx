"use client";

import { Dialog, DialogContent } from "@/components/ui/dialog";
import React from "react";

interface AddEditRoleDialogCleanProps {
  isOpen: boolean;
  onClose: () => void;
}

const AddEditRoleDialogClean: React.FC<AddEditRoleDialogCleanProps> = ({
  isOpen,
  onClose,
}) => {
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent>
        <div>
          <h2>Modal de Rol Básico</h2>
          <p>Este es un esqueleto básico del modal de roles.</p>
          <button onClick={onClose}>Cerrar</button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default AddEditRoleDialogClean;