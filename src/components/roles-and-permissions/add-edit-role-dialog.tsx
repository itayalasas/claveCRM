// src/components/roles-and-permissions/add-edit-role-dialog.tsx
'use client';

import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Separator } from '@/components/ui/separator';

import { Role } from '@/types';

interface AddEditRoleDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (roleData: { name: string; permissions: string[] }) => void;
  initialData?: Role;
}

// Define the list of all available permissions based on the previous discussion
const allPermissions = [
  { module: "Panel Principal", permissions: ["ver-dashboard"] },
  { module: "Registro de Actividad", permissions: ["ver-registro-actividad", "crear-actividad", "editar-actividad", "eliminar-actividad"] },
  { module: "Registro de Auditoría", permissions: ["ver-registro-auditoria"] },
  { module: "Calendario", permissions: ["ver-calendario", "crear-reunion", "editar-reunion", "eliminar-reunion"] },
  { module: "Documentos", permissions: ["ver-documentos", "subir-documento", "editar-documento", "eliminar-documento", "compartir-documento", "ver-plantillas-documento", "crear-plantilla-documento", "editar-plantilla-documento", "eliminar-plantilla-documento"] },
  { module: "Correo Electrónico", permissions: ["ver-correos", "enviar-correo", "redactar-correo"] },
  { module: "Campañas de Correo Electrónico", permissions: ["ver-campanas-correo", "crear-campana-correo", "editar-campana-correo", "eliminar-campana-correo", "enviar-campana-correo", "ver-listas-contacto", "crear-lista-contacto", "editar-lista-contacto", "eliminar-lista-contacto", "gestionar-contactos-lista", "ver-plantillas-correo", "crear-plantilla-correo", "editar-plantilla-correo", "eliminar-plantilla-correo"] },
  { module: "Facturas", permissions: ["ver-facturas", "crear-factura", "editar-factura", "eliminar-factura", "enviar-factura"] },
  { module: "Base de Conocimiento", permissions: ["ver-base-conocimiento", "crear-articulo-kb", "editar-articulo-kb", "eliminar-articulo-kb"] },
  { module: "Páginas de Aterrizaje", permissions: ["ver-paginas-aterrizaje", "crear-pagina-aterrizaje", "editar-pagina-aterrizaje", "eliminar-pagina-aterrizaje", "publicar-pagina-aterrizaje"] },
  { module: "Chat en Vivo", permissions: ["ver-chat-vivo", "enviar-mensajes-chat", "cerrar-chat", "transferir-chat", "usar-respuestas-predefinidas"] },
  { module: "Automatización de Marketing", permissions: ["ver-automatizaciones", "crear-automatizacion", "editar-automatizacion", "eliminar-automatizacion", "activar-automatizacion", "desactivar-automatizacion"] },
  { module: "Pedidos", permissions: ["ver-pedidos", "crear-pedido", "editar-pedido", "eliminar-pedido", "cambiar-estado-pedido"] },
  { module: "Pipeline", permissions: ["ver-pipeline", "ver-leads", "crear-lead", "editar-lead", "eliminar-lead", "cambiar-etapa-lead"] },
  { module: "Cotizaciones", permissions: ["ver-cotizaciones", "crear-cotizacion", "editar-cotizacion", "eliminar-cotizacion", "enviar-cotizacion"] },
  { module: "Encuestas de Satisfacción", permissions: ["ver-encuestas", "crear-encuesta", "editar-encuesta", "eliminar-encuesta", "enviar-encuesta", "ver-respuestas-encuestas"] },
  { module: "Configuración", permissions: ["acceder-configuracion-general", "gestionar-reglas-escalamiento", "gestionar-slas", "gestionar-colas-soporte", "gestionar-configuracion-chat", "gestionar-cuenta-correo", "ver-logs-escalamiento", "ver-licencia"] },
  { module: "CRM Social", permissions: ["ver-social-crm", "publicar-redes-sociales", "interactuar-publicaciones-sociales"] },
  { module: "Tareas", permissions: ["ver-tareas", "crear-tarea", "editar-tarea", "eliminar-tarea", "completar-tarea", "asignar-tarea"] },
  { module: "Tickets de Soporte", permissions: ["ver-tickets", "crear-ticket", "editar-ticket", "eliminar-ticket", "asignar-ticket", "cambiar-estado-ticket", "agregar-comentario-ticket", "sugerir-articulo-kb"] },
  { module: "Gestión de Usuarios", permissions: ["ver-usuarios", "crear-usuario", "editar-usuario", "eliminar-usuario", "asignar-rol"] },
  { module: "Gestión de Roles y Permisos", permissions: ["ver-roles", "crear-rol", "editar-rol", "eliminar-rol", "asignar-permisos-rol"] },
];

type PermissionsState = Record<string, boolean>;

const AddEditRoleDialog: React.FC<AddEditRoleDialogProps> = ({
  isOpen,
  onClose,
  onSave,
  initialData,
}) => {
  const [localRoleName, setLocalRoleName] = useState(''); // New state for local role name
  const [permissions, setPermissions] = useState<PermissionsState>({});

  useEffect(() => {
    const initialPerms: PermissionsState = {};
    allPermissions.forEach(mod => {
      mod.permissions.forEach(p => {
        initialPerms[p] = initialData?.permissions?.includes(p) || false;
      });
    });
    // Initialize localRoleName when initialData changes and is available
    if (initialData && initialData.name !== undefined) {

      setLocalRoleName(initialData.name);
    } else {
        setLocalRoleName(''); // Clear localRoleName for new roles or when initialData is null/undefined
    }
    setPermissions(initialPerms);
  }, [initialData]);

  const handlePermissionChange = (perm: string, checked: boolean) => {
    setPermissions(prev => ({ ...prev, [perm]: checked }));
  };

  const handleSave = () => {
    const selected = Object.keys(permissions).filter(p => permissions[p]);
    onSave({ name: localRoleName, permissions: selected });
    onClose(); // onClose in parent will now handle cleaning up the state
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-lg md:max-w-2xl overflow-y-auto max-h-[90vh]">
        <DialogHeader>
          <DialogTitle>{initialData ? 'Editar Rol' : 'Agregar Nuevo Rol'}</DialogTitle>
        </DialogHeader>

        <div className="grid gap-4 py-4">
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="roleName" className="text-right">Nombre del Rol</Label>
            <Input
              id="localRoleName" // Changed ID to match state
              value={localRoleName}
              onChange={e => setLocalRoleName(e.target.value)}
              className="col-span-3"
            />
          </div>

          <div className="grid grid-cols-4 items-start gap-4">
            <Label className="text-right pt-2">Permisos</Label>
            <div className="col-span-3">
              <Accordion type="multiple">
                {allPermissions.map(mod => (
                  <AccordionItem key={mod.module} value={mod.module}>
                    <AccordionTrigger>{mod.module}</AccordionTrigger>
                    <AccordionContent>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 p-2">
                        {mod.permissions.map(p => (
                          <div
                            key={p}
                            className="flex items-center space-x-2"
                            onClick={e => e.stopPropagation()}
                          >
                            <Checkbox
                              id={p}
                              checked={permissions[p]}
                              onCheckedChange={checked => handlePermissionChange(p, !!checked)}
                            />
                            <Label htmlFor={p} className="text-sm capitalize">
                              {p.replace(/-/g, ' ')}
                            </Label>
                          </div>
                        ))}
                      </div>
                    </AccordionContent>
                  </AccordionItem>
                ))}
              </Accordion>
            </div>
          </div>
        </div>

        <Separator className="my-4" />

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={handleSave} disabled={!localRoleName}>Guardar Rol</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default AddEditRoleDialog;
