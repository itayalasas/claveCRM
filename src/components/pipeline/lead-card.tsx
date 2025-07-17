
"use client";

import type { Lead } from "@/lib/types";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { DollarSign, Edit3, Mail, Phone, MoreVertical, Star, Percent, CalendarClock, PhoneCall } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { format, parseISO, isValid } from "date-fns";
import { es } from "date-fns/locale";
import { getUserInitials } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { useRouter } from "next/navigation"; // Import useRouter

interface LeadCardProps {
  lead: Lead;
  onEdit: (lead: Lead) => void;
}

export function LeadCard({ lead, onEdit }: LeadCardProps) {
  const avatarFallback = getUserInitials(lead.name);
  const { toast } = useToast();
  const router = useRouter(); // Initialize router

  const handleCall = async () => {
    console.log(`LeadCard: Intentando llamar a ${lead.name} al ${lead.phone}`);
    if (lead.phone) {
      toast({
        title: "Iniciando llamada...",
        description: `Conectando con ${lead.name} al ${lead.phone}.`,
      });
      try {
        const response = await fetch('/api/initiate-call', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ toNumber: lead.phone }),
        });
        const result = await response.json();
        if (response.ok && result.success) {
          toast({
            title: "Llamada iniciada",
            description: `Llamada a ${lead.name} en curso. SID: ${result.callSid || 'N/A'}`,
            variant: "default"
          });
        } else {
          // Log the actual error from the server if available
          const errorDetail = result.error || "Error desconocido al iniciar la llamada desde el servidor.";
          console.error("Error desde /api/initiate-call:", errorDetail);
          toast({
            title: "Error al Iniciar Llamada",
            description: errorDetail,
            variant: "destructive",
          });
        }
      } catch (error: any) {
        console.error("Error al iniciar llamada (desde LeadCard):", error);
        toast({
          title: "Error al Iniciar Llamada",
          description: error.message || "No se pudo conectar con el servicio de llamadas.",
          variant: "destructive",
        });
      }
    } else {
      toast({
        title: "Número de Teléfono Faltante",
        description: `El lead ${lead.name} no tiene un número de teléfono registrado.`,
        variant: "destructive",
      });
    }
  };

  const handleSendEmail = () => {
    if (lead.email) {
      const subject = encodeURIComponent(`Seguimiento: ${lead.name}`);
      router.push(`/email?to=${lead.email}&subject=${subject}&leadName=${encodeURIComponent(lead.name)}`);
    } else {
      toast({
        title: "Email Faltante",
        description: `El lead ${lead.name} no tiene un correo electrónico registrado.`,
        variant: "destructive",
      });
    }
  };

  return (
    <Card className="mb-4 shadow-md hover:shadow-lg transition-shadow duration-200">
      <CardHeader className="p-4">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <Avatar className="h-10 w-10">
              <AvatarImage src={`https://avatar.vercel.sh/${lead.email || lead.name}.png?size=40`} alt={lead.name} data-ai-hint="company logo"/>
              <AvatarFallback>{avatarFallback}</AvatarFallback>
            </Avatar>
            <div>
              <CardTitle className="text-lg">{lead.name}</CardTitle>
              {lead.company && <CardDescription className="text-sm">{lead.company}</CardDescription>}
            </div>
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8">
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => onEdit(lead)}>
                <Edit3 className="mr-2 h-4 w-4" />
                Editar Lead
              </DropdownMenuItem>
              {lead.email && (
                <DropdownMenuItem onClick={handleSendEmail}>
                  <Mail className="mr-2 h-4 w-4" />
                  Enviar Correo
                </DropdownMenuItem>
              )}
              {lead.phone && (
                <DropdownMenuItem onClick={handleCall}>
                  <PhoneCall className="mr-2 h-4 w-4" />
                  Llamar
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </CardHeader>
      <CardContent className="p-4 pt-0 space-y-2">
        {lead.details && <p className="text-sm text-muted-foreground mb-3 line-clamp-2">{lead.details}</p>}
        
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs">
          {lead.email && (
            <TooltipProvider delayDuration={100}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <a href={`mailto:${lead.email}`} className="flex items-center gap-1 text-muted-foreground hover:text-primary transition-colors">
                    <Mail className="h-3 w-3" /> 
                    <span className="truncate max-w-[150px]">{lead.email}</span>
                  </a>
                </TooltipTrigger>
                <TooltipContent><p>{lead.email}</p></TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
          {lead.phone && (
            <TooltipProvider delayDuration={100}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className="flex items-center gap-1 text-muted-foreground">
                    <Phone className="h-3 w-3" />
                    {lead.phone}
                  </span>
                </TooltipTrigger>
                <TooltipContent><p>{lead.phone}</p></TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
        </div>

        <div className="flex flex-wrap gap-x-4 gap-y-2 items-center mt-2 text-xs">
           {typeof lead.score === 'number' && (
            <TooltipProvider delayDuration={100}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className="flex items-center gap-1 text-amber-600 font-medium">
                    <Star className="h-3 w-3 fill-amber-500 text-amber-500" /> {lead.score}/100
                  </span>
                </TooltipTrigger>
                <TooltipContent><p>Puntuación del Lead</p></TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
          {typeof lead.probability === 'number' && (
             <TooltipProvider delayDuration={100}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className="flex items-center gap-1 text-blue-600 font-medium">
                    <Percent className="h-3 w-3" /> {lead.probability}%
                  </span>
                </TooltipTrigger>
                <TooltipContent><p>Probabilidad de Cierre</p></TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
          {lead.expectedCloseDate && isValid(parseISO(lead.expectedCloseDate)) && (
             <TooltipProvider delayDuration={100}>
                <Tooltip>
                    <TooltipTrigger asChild>
                    <span className="flex items-center gap-1 text-muted-foreground">
                        <CalendarClock className="h-3 w-3" /> {format(parseISO(lead.expectedCloseDate), "P", { locale: es })}
                    </span>
                    </TooltipTrigger>
                    <TooltipContent><p>Fecha de Cierre Estimada</p></TooltipContent>
                </Tooltip>
            </TooltipProvider>
          )}
        </div>

      </CardContent>
      <CardFooter className="p-4 flex justify-between items-center text-sm border-t">
        {typeof lead.value === 'number' && lead.value > 0 ? (
          <div className="flex items-center font-semibold text-primary">
            <DollarSign className="h-4 w-4 mr-1" />
            {lead.value.toLocaleString('es-ES', {minimumFractionDigits: 0, maximumFractionDigits: 0})}
          </div>
        ) : <div />}
        <span className="text-xs text-muted-foreground">
          Agregado: {lead.createdAt && isValid(parseISO(lead.createdAt)) ? format(parseISO(lead.createdAt), "P", { locale: es }) : "Fecha desconocida"}
        </span>
      </CardFooter>
    </Card>
  );
}
