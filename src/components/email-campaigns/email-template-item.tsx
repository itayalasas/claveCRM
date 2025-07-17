
"use client";

import type { EmailTemplate } from "@/lib/types";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { FileText as TemplateIcon, Edit3, Trash2, CalendarDays, Eye } from "lucide-react";
import { format, parseISO, isValid } from 'date-fns';
import { es } from 'date-fns/locale';

interface EmailTemplateItemProps {
  template: EmailTemplate;
  onEdit: (templateId: string) => void;
  onDelete: (templateId: string) => void;
  onPreview: (template: EmailTemplate) => void;
}

export function EmailTemplateItem({ template, onEdit, onDelete, onPreview }: EmailTemplateItemProps) {
  return (
    <Card className="shadow-sm hover:shadow-md transition-shadow flex flex-col justify-between h-full">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <CardTitle className="text-lg flex items-center gap-2">
            <TemplateIcon className="h-5 w-5 text-primary" />
            <span className="truncate" title={template.name}>{template.name}</span>
          </CardTitle>
        </div>
        {template.subject && (
            <CardDescription className="text-xs pt-1 line-clamp-2" title={template.subject}>
                Asunto: {template.subject}
            </CardDescription>
        )}
      </CardHeader>
      <CardContent className="pb-3 flex-grow">
        <p className="text-xs text-muted-foreground flex items-center gap-1">
            <CalendarDays className="h-3 w-3" />
            Creada: {template.createdAt && isValid(parseISO(template.createdAt)) ? format(parseISO(template.createdAt), "P", { locale: es }) : 'Fecha desconocida'}
        </p>
        {template.updatedAt && isValid(parseISO(template.updatedAt)) && (
             <p className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
                <CalendarDays className="h-3 w-3" />
                Actualizada: {format(parseISO(template.updatedAt), "P", { locale: es })}
            </p>
        )}
      </CardContent>
      <CardFooter className="flex justify-end gap-2 pt-3 border-t">
        <Button variant="ghost" size="sm" onClick={() => onPreview(template)}>
          <Eye className="mr-2 h-4 w-4" /> Previsualizar
        </Button>
        <Button variant="outline" size="sm" onClick={() => onEdit(template.id)}>
          <Edit3 className="mr-2 h-4 w-4" /> Editar
        </Button>
        <Button variant="destructive" size="sm" onClick={() => onDelete(template.id)}>
          <Trash2 className="mr-2 h-4 w-4" /> Eliminar
        </Button>
      </CardFooter>
    </Card>
  );
}
