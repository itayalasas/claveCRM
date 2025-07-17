"use client";

import type { SLA } from "@/lib/types";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ShieldCheck, Edit3, Trash2, Clock, CalendarDays, AlertCircle } from "lucide-react";
import { format, parseISO, isValid } from 'date-fns';
import { es } from 'date-fns/locale';

interface SlaListItemProps {
  sla: SLA;
  onEdit: (sla: SLA) => void;
  onDelete: (slaId: string) => void;
}

export function SlaListItem({ sla, onEdit, onDelete }: SlaListItemProps) {
  return (
    <Card className="shadow-sm hover:shadow-md transition-shadow">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3 min-w-0">
             <ShieldCheck className={`h-5 w-5 ${sla.isEnabled ? 'text-green-500' : 'text-muted-foreground'}`} />
            <CardTitle className="text-base truncate" title={sla.name}>
              {sla.name}
            </CardTitle>
            <Badge variant={sla.isEnabled ? "default" : "secondary"} className={sla.isEnabled ? "bg-green-100 text-green-700" : ""}>
                {sla.isEnabled ? "Activo" : "Inactivo"}
            </Badge>
          </div>
          <div className="flex gap-1">
            <Button variant="ghost" size="icon" onClick={() => onEdit(sla)} className="h-8 w-8">
              <Edit3 className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="icon" onClick={() => onDelete(sla.id)} className="h-8 w-8 text-destructive hover:text-destructive">
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </div>
         {sla.description && (
          <CardDescription className="text-xs pt-1 line-clamp-2">{sla.description}</CardDescription>
        )}
      </CardHeader>
      <CardContent className="pb-3 space-y-2 text-sm text-muted-foreground">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1 text-xs">
          <div className="flex items-center gap-1" title="Tiempo de Primera Respuesta">
            <Clock className="h-3 w-3 shrink-0" /> Respuesta: {sla.responseTimeTargetMinutes} min
          </div>
          <div className="flex items-center gap-1" title="Tiempo de Resolución">
            <Clock className="h-3 w-3 shrink-0 text-green-500" /> Resolución: {sla.resolutionTimeTargetHours} horas
          </div>
           {sla.businessHoursOnly && (
            <div className="flex items-center gap-1 col-span-full text-amber-600" title="Solo Horario Laboral">
                <AlertCircle className="h-3 w-3 shrink-0" /> Solo aplica en horario laboral (config. pendiente)
            </div>
           )}
        </div>
        {sla.appliesToPriority && sla.appliesToPriority.length > 0 && (
            <div className="pt-1 mt-1 border-t">
                <span className="text-xs font-medium">Prioridades Aplicables: </span>
                {sla.appliesToPriority.map(p => <Badge key={p} variant="outline" className="text-xs capitalize ml-1">{p}</Badge>)}
            </div>
        )}
         {sla.appliesToQueues && sla.appliesToQueues.length > 0 && (
            <div className="pt-1 mt-1">
                <span className="text-xs font-medium">Colas Específicas: </span>
                {/* Placeholder: map queue names once available */}
                {sla.appliesToQueues.map(qId => <Badge key={qId} variant="secondary" className="text-xs ml-1">{qId.substring(0,6)}...</Badge>)}
            </div>
        )}
      </CardContent>
      <CardFooter className="pt-2 pb-3 border-t text-xs text-muted-foreground">
            <div className="flex items-center gap-1">
                <CalendarDays className="h-3 w-3 shrink-0" /> 
                Creado: {isValid(parseISO(sla.createdAt)) ? format(parseISO(sla.createdAt), "PP", { locale: es }) : 'Fecha inválida'}
            </div>
      </CardFooter>
    </Card>
  );
}