
"use client";

import type { SurveyTemplate } from "@/lib/types";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { FileText, Edit3, Trash2, CalendarDays, CheckCircle2, Star, MessageSquareText } from "lucide-react";
import { format, parseISO, isValid } from 'date-fns';
import { es } from 'date-fns/locale';

interface SurveyTemplateListItemProps {
  template: SurveyTemplate;
  onEdit: (template: SurveyTemplate) => void;
  onDelete: (templateId: string) => void;
}

export function SurveyTemplateListItem({ template, onEdit, onDelete }: SurveyTemplateListItemProps) {
  const getSurveyTypeIcon = (type: SurveyTemplate['type']) => {
    switch (type) {
      case 'CSAT': return <CheckCircle2 className="h-4 w-4 text-green-500" />;
      case 'NPS': return <Star className="h-4 w-4 text-amber-500" />;
      case 'Custom': return <MessageSquareText className="h-4 w-4 text-blue-500" />;
      default: return <FileText className="h-4 w-4 text-muted-foreground" />;
    }
  };

  return (
    <Card className="shadow-sm hover:shadow-md transition-shadow flex flex-col justify-between h-full">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <CardTitle className="text-lg flex items-center gap-2">
            <FileText className="h-5 w-5 text-primary" />
            <span className="truncate" title={template.name}>{template.name}</span>
          </CardTitle>
          <Badge variant={template.isEnabled ? "default" : "outline"} className={template.isEnabled ? "bg-green-100 text-green-700" : "border-gray-400 text-gray-500"}>
            {template.isEnabled ? "Activa" : "Inactiva"}
          </Badge>
        </div>
        {template.description && (
          <CardDescription className="text-xs pt-1 line-clamp-2">{template.description}</CardDescription>
        )}
      </CardHeader>
      <CardContent className="pb-3 flex-grow space-y-1 text-sm">
        <div className="flex items-center gap-1 text-xs text-muted-foreground">
            {getSurveyTypeIcon(template.type)} Tipo: {template.type}
        </div>
        <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <CalendarDays className="h-3 w-3" />
            Creada: {template.createdAt && isValid(parseISO(template.createdAt)) ? format(parseISO(template.createdAt), "P", { locale: es }) : 'Fecha desconocida'}
        </div>
        <p className="text-xs text-muted-foreground">Preguntas: {template.questions.length}</p>
      </CardContent>
      <CardFooter className="flex justify-end gap-2 pt-3 border-t">
        <Button variant="outline" size="sm" onClick={() => onEdit(template)}>
          <Edit3 className="mr-2 h-4 w-4" /> Editar
        </Button>
        <Button variant="destructive" size="sm" onClick={() => onDelete(template.id)}>
          <Trash2 className="mr-2 h-4 w-4" /> Eliminar
        </Button>
      </CardFooter>
    </Card>
  );
}
