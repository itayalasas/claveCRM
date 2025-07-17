
"use client";

import React, { useState, useEffect } from "react";
import type { DocumentFile, DocumentUserPermission, DocumentGroupPermission, DocumentPermissionLevel, User } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Copy, Globe, EyeOff, PlusCircle, Trash2, Save, Loader2, Users2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { getUserInitials } from "@/lib/utils";

interface DocumentSharingDialogContentProps {
  documentFile: DocumentFile;
  allUsers: User[];
  currentUser: User;
  onSaveSharing: (documentId: string, newPermissions: { users?: DocumentUserPermission[], groups?: DocumentGroupPermission[] }) => Promise<void>;
  onTogglePublic: (documentId: string, currentIsPublic: boolean) => Promise<void>;
  onClose: () => void;
}

const NO_USER_SELECTED = "__NONE__";
const NO_GROUP_SELECTED = "__NONE__";

// Placeholder for predefined groups. In a real app, these would come from a database or config.
const PREDEFINED_GROUPS = [
    { id: "marketing-team", name: "Equipo de Marketing" },
    { id: "sales-team", name: "Equipo de Ventas" },
    { id: "all-employees", name: "Todos los Empleados" },
];


export function DocumentSharingDialogContent({
  documentFile,
  allUsers,
  currentUser,
  onSaveSharing,
  onTogglePublic,
  onClose,
}: DocumentSharingDialogContentProps) {
  const { toast } = useToast();
  const [isPublic, setIsPublic] = useState(!!documentFile.isPublic);
  const [localSharedUsers, setLocalSharedUsers] = useState<DocumentUserPermission[]>(
    documentFile.permissions?.users?.slice() || []
  );
  const [localSharedGroups, setLocalSharedGroups] = useState<DocumentGroupPermission[]>(
    documentFile.permissions?.groups?.slice() || []
  );

  const [selectedUserIdToAdd, setSelectedUserIdToAdd] = useState<string>(NO_USER_SELECTED);
  const [selectedUserPermissionLevel, setSelectedUserPermissionLevel] = useState<DocumentPermissionLevel>("view");

  const [selectedGroupIdToAdd, setSelectedGroupIdToAdd] = useState<string>(NO_GROUP_SELECTED);
  const [selectedGroupPermissionLevel, setSelectedGroupPermissionLevel] = useState<DocumentPermissionLevel>("view");


  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    setIsPublic(!!documentFile.isPublic);
    setLocalSharedUsers(documentFile.permissions?.users?.slice() || []);
    setLocalSharedGroups(documentFile.permissions?.groups?.slice() || []);
  }, [documentFile]);

  const handleCopyToClipboard = () => {
    if (isPublic && documentFile.fileURL) {
      navigator.clipboard.writeText(documentFile.fileURL)
        .then(() => toast({ title: "Enlace Copiado", description: "El enlace público ha sido copiado." }))
        .catch(() => toast({ title: "Error al Copiar", variant: "destructive" }));
    }
  };

  const handleTogglePublicSwitch = async (checked: boolean) => {
    setIsSaving(true);
    await onTogglePublic(documentFile.id, isPublic);
    setIsPublic(checked); 
    setIsSaving(false);
  };

  const handleAddUserPermission = () => {
    if (selectedUserIdToAdd === NO_USER_SELECTED) {
      toast({ title: "Selecciona un usuario", variant: "destructive" });
      return;
    }
    if (localSharedUsers.some(u => u.userId === selectedUserIdToAdd)) {
      toast({ title: "Usuario ya añadido", description: "Este usuario ya tiene permisos para este documento.", variant: "default" });
      return;
    }
    const user = allUsers.find(u => u.id === selectedUserIdToAdd);
    if (user) {
      setLocalSharedUsers(prev => [
        ...prev,
        { userId: user.id, userName: user.name, email: user.email, avatarUrl: user.avatarUrl, level: selectedUserPermissionLevel }
      ]);
      setSelectedUserIdToAdd(NO_USER_SELECTED); 
    }
  };

  const handleRemoveUserPermission = (userIdToRemove: string) => {
    setLocalSharedUsers(prev => prev.filter(u => u.userId !== userIdToRemove));
  };

  const handleChangeUserPermissionLevel = (userIdToChange: string, newLevel: DocumentPermissionLevel) => {
    setLocalSharedUsers(prev =>
      prev.map(u => (u.userId === userIdToChange ? { ...u, level: newLevel } : u))
    );
  };

  const handleAddGroupPermission = () => {
    if (selectedGroupIdToAdd === NO_GROUP_SELECTED) {
      toast({ title: "Selecciona un grupo", variant: "destructive" });
      return;
    }
    if (localSharedGroups.some(g => g.groupId === selectedGroupIdToAdd)) {
      toast({ title: "Grupo ya añadido", description: "Este grupo ya tiene permisos para este documento.", variant: "default" });
      return;
    }
    const group = PREDEFINED_GROUPS.find(g => g.id === selectedGroupIdToAdd);
    if (group) {
      setLocalSharedGroups(prev => [
        ...prev,
        { groupId: group.id, groupName: group.name, level: selectedGroupPermissionLevel }
      ]);
      setSelectedGroupIdToAdd(NO_GROUP_SELECTED);
    }
  };

  const handleRemoveGroupPermission = (groupIdToRemove: string) => {
    setLocalSharedGroups(prev => prev.filter(g => g.groupId !== groupIdToRemove));
  };

  const handleChangeGroupPermissionLevel = (groupIdToChange: string, newLevel: DocumentPermissionLevel) => {
    setLocalSharedGroups(prev =>
      prev.map(g => (g.groupId === groupIdToChange ? { ...g, level: newLevel } : g))
    );
  };


  const handleSaveChanges = async () => {
    setIsSaving(true);
    await onSaveSharing(documentFile.id, { users: localSharedUsers, groups: localSharedGroups });
    setIsSaving(false);
    onClose(); 
  };
  
  const availableUsersToAdd = allUsers.filter(u => u.id !== currentUser.id && !localSharedUsers.some(sharedUser => sharedUser.userId === u.id));
  const availableGroupsToAdd = PREDEFINED_GROUPS.filter(g => !localSharedGroups.some(sg => sg.groupId === g.id));


  return (
    <div className="space-y-4"> {/* Reduced main spacing for better fit */}
      {/* Public Sharing Section */}
      <div>
        <h3 className="text-md font-semibold mb-1">Acceso Público</h3>
        <div className="flex items-center justify-between p-2.5 border rounded-md">
          <div className="space-y-0.5">
            <Label htmlFor="public-access-switch" className="text-sm font-medium">
              {isPublic ? "Documento Público" : "Documento Privado"}
            </Label>
            <p className="text-xs text-muted-foreground">
              {isPublic ? "Cualquiera con el enlace puede ver." : "Solo usuarios/grupos compartidos."}
            </p>
          </div>
          <Switch
            id="public-access-switch"
            checked={isPublic}
            onCheckedChange={handleTogglePublicSwitch}
            disabled={isSaving}
          />
        </div>
        {isPublic && documentFile.fileURL && (
          <div className="mt-2 space-y-0.5">
            <Label htmlFor={`share-link-${documentFile.id}`} className="text-xs">Enlace Público:</Label>
            <div className="flex items-center space-x-1.5">
              <Input id={`share-link-${documentFile.id}`} value={documentFile.fileURL} readOnly className="text-xs h-8" />
              <Button type="button" size="sm" onClick={handleCopyToClipboard} variant="outline" className="h-8 px-2">
                <Copy className="mr-1 h-3 w-3" /> Copiar
              </Button>
            </div>
          </div>
        )}
      </div>

      <Separator />

      {/* User-Specific Sharing Section */}
      <div>
        <h3 className="text-md font-semibold mb-1">Compartir con Usuarios</h3>
        <div className="p-2.5 border rounded-md space-y-3">
          <div className="flex items-end gap-1.5">
            <div className="flex-grow">
              <Label htmlFor="select-user-to-add" className="text-xs">Usuario</Label>
              <Select
                value={selectedUserIdToAdd}
                onValueChange={setSelectedUserIdToAdd}
                disabled={availableUsersToAdd.length === 0 || isSaving}
              >
                <SelectTrigger id="select-user-to-add" className="h-8 text-xs">
                  <SelectValue placeholder={availableUsersToAdd.length === 0 ? "No hay más usuarios" : "Selecciona un usuario"} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NO_USER_SELECTED} disabled>Selecciona un usuario</SelectItem>
                  {availableUsersToAdd.map(user => (
                    <SelectItem key={user.id} value={user.id}>
                      {user.name} ({user.email})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="w-[100px]">
              <Label htmlFor="select-user-permission-level" className="text-xs">Permiso</Label>
              <Select
                value={selectedUserPermissionLevel}
                onValueChange={(val) => setSelectedUserPermissionLevel(val as DocumentPermissionLevel)}
                disabled={isSaving}
              >
                <SelectTrigger id="select-user-permission-level" className="h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="view">Ver</SelectItem>
                  <SelectItem value="edit">Editar</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button 
                type="button" 
                size="icon" 
                onClick={handleAddUserPermission} 
                disabled={selectedUserIdToAdd === NO_USER_SELECTED || isSaving}
                className="h-8 w-8"
                title="Añadir permiso de usuario"
            >
              <PlusCircle className="h-4 w-4" />
            </Button>
          </div>
          {localSharedUsers.length > 0 && (
            <ScrollArea className="h-[120px] mt-2">
              <div className="space-y-1.5 pr-2">
                {localSharedUsers.map(sharedUser => (
                  <div key={sharedUser.userId} className="flex items-center justify-between p-1.5 bg-muted/50 rounded-md">
                    <div className="flex items-center gap-1.5">
                      <Avatar className="h-6 w-6">
                        <AvatarImage src={sharedUser.avatarUrl || `https://avatar.vercel.sh/${sharedUser.email}.png`} alt={sharedUser.userName} data-ai-hint="user avatar" />
                        <AvatarFallback>{getUserInitials(sharedUser.userName)}</AvatarFallback>
                      </Avatar>
                      <span className="text-xs truncate max-w-[120px]" title={sharedUser.userName}>{sharedUser.userName}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <Select
                        value={sharedUser.level}
                        onValueChange={(val) => handleChangeUserPermissionLevel(sharedUser.userId, val as DocumentPermissionLevel)}
                        disabled={isSaving}
                      >
                        <SelectTrigger className="h-7 text-xs w-[80px] px-2 py-1">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="view">Ver</SelectItem>
                          <SelectItem value="edit">Editar</SelectItem>
                        </SelectContent>
                      </Select>
                      <Button type="button" variant="ghost" size="icon" onClick={() => handleRemoveUserPermission(sharedUser.userId)} className="h-6 w-6 text-destructive hover:text-destructive" disabled={isSaving} title="Quitar permiso">
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          )}
           {localSharedUsers.length === 0 && ( <p className="text-xs text-muted-foreground text-center py-1">No compartido con usuarios específicos.</p> )}
        </div>
      </div>
      
      <Separator />

      {/* Group Sharing Section */}
      <div>
        <h3 className="text-md font-semibold mb-1">Compartir con Grupos</h3>
        <div className="p-2.5 border rounded-md space-y-3">
           <div className="flex items-end gap-1.5">
            <div className="flex-grow">
              <Label htmlFor="select-group-to-add" className="text-xs">Grupo</Label>
              <Select
                value={selectedGroupIdToAdd}
                onValueChange={setSelectedGroupIdToAdd}
                disabled={availableGroupsToAdd.length === 0 || isSaving}
              >
                <SelectTrigger id="select-group-to-add" className="h-8 text-xs">
                  <SelectValue placeholder={availableGroupsToAdd.length === 0 ? "No hay más grupos" : "Selecciona un grupo"} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NO_GROUP_SELECTED} disabled>Selecciona un grupo</SelectItem>
                  {availableGroupsToAdd.map(group => (
                    <SelectItem key={group.id} value={group.id}>
                      {group.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="w-[100px]">
              <Label htmlFor="select-group-permission-level" className="text-xs">Permiso</Label>
              <Select
                value={selectedGroupPermissionLevel}
                onValueChange={(val) => setSelectedGroupPermissionLevel(val as DocumentPermissionLevel)}
                disabled={isSaving}
              >
                <SelectTrigger id="select-group-permission-level" className="h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="view">Ver</SelectItem>
                  <SelectItem value="edit">Editar</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button 
                type="button" 
                size="icon" 
                onClick={handleAddGroupPermission} 
                disabled={selectedGroupIdToAdd === NO_GROUP_SELECTED || isSaving}
                className="h-8 w-8"
                title="Añadir permiso de grupo"
            >
              <PlusCircle className="h-4 w-4" />
            </Button>
          </div>
          {localSharedGroups.length > 0 && (
            <ScrollArea className="h-[120px] mt-2">
              <div className="space-y-1.5 pr-2">
                {localSharedGroups.map(sharedGroup => (
                  <div key={sharedGroup.groupId} className="flex items-center justify-between p-1.5 bg-muted/50 rounded-md">
                    <div className="flex items-center gap-1.5">
                      <Users2 className="h-4 w-4 text-muted-foreground" />
                      <span className="text-xs truncate max-w-[120px]" title={sharedGroup.groupName}>{sharedGroup.groupName}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <Select
                        value={sharedGroup.level}
                        onValueChange={(val) => handleChangeGroupPermissionLevel(sharedGroup.groupId, val as DocumentPermissionLevel)}
                        disabled={isSaving}
                      >
                        <SelectTrigger className="h-7 text-xs w-[80px] px-2 py-1">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="view">Ver</SelectItem>
                          <SelectItem value="edit">Editar</SelectItem>
                        </SelectContent>
                      </Select>
                      <Button type="button" variant="ghost" size="icon" onClick={() => handleRemoveGroupPermission(sharedGroup.groupId)} className="h-6 w-6 text-destructive hover:text-destructive" disabled={isSaving} title="Quitar permiso">
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          )}
           {localSharedGroups.length === 0 && ( <p className="text-xs text-muted-foreground text-center py-1">No compartido con grupos específicos.</p> )}
           <p className="text-xs text-muted-foreground">La gestión de grupos se realizará en otra sección. Aquí solo se asignan permisos a grupos existentes.</p>
        </div>
      </div>


      <div className="flex justify-end gap-2 mt-1">
        <Button variant="outline" onClick={onClose} disabled={isSaving}>
          Cancelar
        </Button>
        <Button onClick={handleSaveChanges} disabled={isSaving || (JSON.stringify(localSharedUsers) === JSON.stringify(documentFile.permissions?.users || []) && JSON.stringify(localSharedGroups) === JSON.stringify(documentFile.permissions?.groups || []))}>
          {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4"/>}
          Guardar Permisos
        </Button>
      </div>
    </div>
  );
}

    
