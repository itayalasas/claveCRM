
"use client";

import type { DocumentTemplate } from "@/lib/types";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { FileSignature, Edit3, Trash2, CalendarDays, Variable, FileText, Link as LinkIconLucide, Play } from "lucide-react";
import { format, parseISO, isValid } from 'date-fns';
import { es } from 'date-fns/locale';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface DocumentTemplateListItemProps {
  template: DocumentTemplate;
  onEdit: (template: DocumentTemplate) => void;
  onDelete: (template: DocumentTemplate) => void;
  onGenerate: (template: DocumentTemplate) => void; 
}

export function DocumentTemplateListItem({
  template,
  onEdit,
  onDelete,
  onGenerate,
}: DocumentTemplateListItemProps) {
  return (
    <Card className="shadow-sm hover:shadow-md transition-shadow flex flex-col justify-between h-full">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3 min-w-0">
            <FileSignature className="h-6 w-6 text-primary flex-shrink-0" />
            <div className="flex-grow min-w-0">
              <CardTitle className="text-base truncate" title={template.name}>
                {template.name}
              </CardTitle>
              {template.category && (
                <CardDescription className="text-xs truncate">
                  Categoría: {template.category}
                </CardDescription>
              )}
            </div>
          </div>
           <div className="flex gap-1">
            <TooltipProvider>
                <Tooltip>
                    <TooltipTrigger asChild>
                        <Button variant="ghost" size="icon" onClick={() => onGenerate(template)} className="h-8 w-8">
                           <Play className="h-4 w-4" />
                        </Button>
                    </TooltipTrigger>
                    <TooltipContent><p>Generar Documento</p></TooltipContent>
                </Tooltip>
            </TooltipProvider>
            <TooltipProvider>
                <Tooltip>
                    <TooltipTrigger asChild>
                        <Button variant="ghost" size="icon" onClick={() => onEdit(template)} className="h-8 w-8">
                            <Edit3 className="h-4 w-4" />
                        </Button>
                    </TooltipTrigger>
                    <TooltipContent><p>Editar Plantilla</p></TooltipContent>
                </Tooltip>
            </TooltipProvider>
            <TooltipProvider>
                 <Tooltip>
                    <TooltipTrigger asChild>
                        <Button variant="ghost" size="icon" onClick={() => onDelete(template)} className="h-8 w-8 text-destructive hover:text-destructive">
                            <Trash2 className="h-4 w-4" />
                        </Button>
                    </TooltipTrigger>
                    <TooltipContent><p>Eliminar Plantilla</p></TooltipContent>
                </Tooltip>
            </TooltipProvider>
          </div>
        </div>
      </CardHeader>
      <CardContent className="pb-3 space-y-1 text-xs text-muted-foreground flex-grow">
        {template.description && <p className="line-clamp-2 mb-2">{template.description}</p>}
        <div className="flex items-center gap-1">
          <CalendarDays className="h-3 w-3" />
          Creada: {isValid(parseISO(template.createdAt)) ? format(parseISO(template.createdAt), "PP", { locale: es }) : 'Fecha inválida'}
        </div>
        {template.updatedAt && isValid(parseISO(template.updatedAt)) && (
            <div className="flex items-center gap-1">
            <CalendarDays className="h-3 w-3" />
            Actualizada: {format(parseISO(template.updatedAt), "PP", { locale: es })}
            </div>
        )}
        {template.fileURL ? (
            <div className="flex items-center gap-1 mt-1" title={template.fileNameInStorage || template.name}>
                 <LinkIconLucide className="h-3 w-3 text-primary" />
                 <a href={template.fileURL} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline truncate">
                    Archivo base: {template.fileNameInStorage || template.name}
                </a>
            </div>
        ) : template.content ? (
            <div className="flex items-center gap-1 mt-1">
                <FileText className="h-3 w-3 text-primary" />
                <span>Contenido basado en texto</span>
            </div>
        ) : null}
      </CardContent>
      {(template.variables && template.variables.length > 0) && (
        <CardFooter className="pt-2 pb-3 border-t flex flex-wrap gap-1">
            <Variable className="h-3 w-3 text-muted-foreground mr-1"/>
            {template.variables.slice(0, 5).map((variable, index) => (
                <Badge key={index} variant="outline" className="text-xs">{variable}</Badge>
            ))}
            {template.variables.length > 5 && <Badge variant="outline" className="text-xs">+{template.variables.length - 5} más</Badge>}
        </CardFooter>
      )}
    </Card>
  );
}
