
"use client";

import type { ContactList } from "@/lib/types";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Users, Eye, Trash2, CalendarDays } from "lucide-react";
import { format, parseISO, isValid } from 'date-fns';
import { es } from 'date-fns/locale';
import { Badge } from "@/components/ui/badge";

interface ContactListItemProps {
  list: ContactList;
  onDelete: (listId: string) => void;
  onManageContacts: (listId: string) => void;
}

export function ContactListItem({ list, onDelete, onManageContacts }: ContactListItemProps) {
  return (
    <Card className="shadow-sm hover:shadow-md transition-shadow flex flex-col justify-between h-full">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <CardTitle className="text-lg flex items-center gap-2">
            <Users className="h-5 w-5 text-primary" />
            <span className="truncate" title={list.name}>{list.name}</span>
          </CardTitle>
          <Badge variant="secondary">{list.contactCount || 0} Contactos</Badge>
        </div>
        {list.description && (
            <CardDescription className="text-xs pt-1 line-clamp-2">{list.description}</CardDescription>
        )}
      </CardHeader>
      <CardContent className="pb-3 flex-grow">
        <p className="text-xs text-muted-foreground flex items-center gap-1">
            <CalendarDays className="h-3 w-3" />
            Creada: {list.createdAt && isValid(parseISO(list.createdAt)) ? format(parseISO(list.createdAt), "P", { locale: es }) : 'Fecha desconocida'}
        </p>
      </CardContent>
      <CardFooter className="flex justify-end gap-2 pt-3 border-t">
        <Button variant="outline" size="sm" onClick={() => onManageContacts(list.id)}>
          <Eye className="mr-2 h-4 w-4" /> Ver/Añadir Contactos
        </Button>
        <Button variant="destructive" size="sm" onClick={() => onDelete(list.id)}>
          <Trash2 className="mr-2 h-4 w-4" /> Eliminar
        </Button>
      </CardFooter>
    </Card>
  );
}
