
"use client";

import type { ActivityLog, Lead, Contact, Ticket, User, Opportunity, ActivityType } from "@/lib/types";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CalendarDays, Edit3, FileClock, Link as LinkIcon, ListFilter, MessageSquareText, Phone, Trash2, UserCircle, Users, Video } from "lucide-react";
import { format, parseISO, isValid } from 'date-fns';
import { es } from 'date-fns/locale';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

interface ActivityLogListItemProps {
  activity: ActivityLog;
  users: User[];
  leads: Lead[];
  contacts: Contact[];
  tickets: Ticket[];
  opportunities: Opportunity[];
  onEdit: (activity: ActivityLog) => void;
  onDelete: (activityId: string) => void;
}

const ActivityIcon = ({ type }: { type: ActivityType }) => {
  switch (type) {
    case 'Llamada': return <Phone className="h-4 w-4 text-blue-500" />;
    case 'Reunión': return <Users className="h-4 w-4 text-green-500" />;
    case 'Correo Enviado': return <MessageSquareText className="h-4 w-4 text-purple-500" />;
    case 'Correo Recibido': return <MessageSquareText className="h-4 w-4 text-indigo-500" />;
    case 'Nota': return <FileClock className="h-4 w-4 text-gray-500" />;
    case 'Visita': return <Video className="h-4 w-4 text-orange-500" />;
    default: return <ListFilter className="h-4 w-4 text-muted-foreground" />;
  }
};

export function ActivityLogListItem({ 
    activity, 
    users, 
    leads, 
    contacts, 
    tickets, 
    opportunities,
    onEdit, 
    onDelete 
}: ActivityLogListItemProps) {

  const loggedByUser = users.find(u => u.id === activity.loggedByUserId);
  const relatedLead = activity.relatedLeadId ? leads.find(l => l.id === activity.relatedLeadId) : null;
  const relatedContact = activity.relatedContactId ? contacts.find(c => c.id === activity.relatedContactId) : null;
  const relatedTicket = activity.relatedTicketId ? tickets.find(t => t.id === activity.relatedTicketId) : null;
  const relatedOpportunity = activity.relatedOpportunityId ? opportunities.find(o => o.id === activity.relatedOpportunityId) : null;

  return (
    <Card className="shadow-sm hover:shadow-md transition-shadow">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3 min-w-0">
             <ActivityIcon type={activity.type} />
            <CardTitle className="text-base truncate" title={activity.subject || activity.type}>
              {activity.subject || activity.type}
            </CardTitle>
             <Badge variant="secondary" className="whitespace-nowrap">{activity.type}</Badge>
          </div>
          <div className="flex gap-1">
            <TooltipProvider><Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon" onClick={() => onEdit(activity)} className="h-8 w-8" disabled>
                  <Edit3 className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent><p>Editar Actividad (Próximamente)</p></TooltipContent>
            </Tooltip></TooltipProvider>
             <TooltipProvider><Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon" onClick={() => onDelete(activity.id)} className="h-8 w-8 text-destructive hover:text-destructive" disabled>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent><p>Eliminar Actividad (Próximamente)</p></TooltipContent>
            </Tooltip></TooltipProvider>
          </div>
        </div>
         {activity.outcome && (
          <CardDescription className="text-xs pt-1">Resultado: {activity.outcome}</CardDescription>
        )}
      </CardHeader>
      <CardContent className="pb-3 space-y-2 text-sm text-muted-foreground">
        <p className="line-clamp-3 whitespace-pre-wrap">{activity.details}</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1 text-xs pt-2 border-t mt-2">
          <div className="flex items-center gap-1" title="Fecha y Hora">
            <CalendarDays className="h-3 w-3 shrink-0" /> 
            {isValid(parseISO(activity.timestamp)) ? format(parseISO(activity.timestamp), "PPpp", { locale: es }) : 'Fecha inválida'}
          </div>
          {loggedByUser && (
            <div className="flex items-center gap-1 truncate" title={`Registrado por: ${loggedByUser.name}`}>
              <UserCircle className="h-3 w-3 shrink-0" /> {loggedByUser.name}
            </div>
          )}
          {activity.durationMinutes && activity.durationMinutes > 0 && (
            <div className="flex items-center gap-1">
              <FileClock className="h-3 w-3 shrink-0" /> Duración: {activity.durationMinutes} min
            </div>
          )}
        </div>
      </CardContent>
      {(relatedLead || relatedContact || relatedTicket || relatedOpportunity) && (
        <CardFooter className="pt-2 pb-3 border-t flex flex-wrap gap-x-3 gap-y-1 text-xs">
            {relatedLead && (
                <TooltipProvider><Tooltip>
                    <TooltipTrigger asChild>
                        <div className="flex items-center gap-1 text-primary cursor-default">
                            <LinkIcon className="h-3 w-3"/> Lead: <span className="font-medium truncate">{relatedLead.name}</span>
                        </div>
                    </TooltipTrigger>
                    <TooltipContent><p>Lead: {relatedLead.name} ({relatedLead.email})</p></TooltipContent>
                </Tooltip></TooltipProvider>
            )}
            {relatedContact && (
                 <TooltipProvider><Tooltip>
                    <TooltipTrigger asChild>
                        <div className="flex items-center gap-1 text-purple-600 cursor-default">
                            <LinkIcon className="h-3 w-3"/> Contacto: <span className="font-medium truncate">{relatedContact.firstName} {relatedContact.lastName}</span>
                        </div>
                    </TooltipTrigger>
                    <TooltipContent><p>Contacto: {relatedContact.firstName} {relatedContact.lastName} ({relatedContact.email})</p></TooltipContent>
                </Tooltip></TooltipProvider>
            )}
            {relatedTicket && (
                <TooltipProvider><Tooltip>
                    <TooltipTrigger asChild>
                        <div className="flex items-center gap-1 text-red-600 cursor-default">
                            <LinkIcon className="h-3 w-3"/> Ticket: <span className="font-medium truncate">#{relatedTicket.id.substring(0,6)}...</span>
                        </div>
                    </TooltipTrigger>
                    <TooltipContent><p>Ticket: {relatedTicket.title} (ID: {relatedTicket.id})</p></TooltipContent>
                </Tooltip></TooltipProvider>
            )}
            {relatedOpportunity && (
                <TooltipProvider><Tooltip>
                    <TooltipTrigger asChild>
                        <div className="flex items-center gap-1 text-green-600 cursor-default">
                            <LinkIcon className="h-3 w-3"/> Oportunidad: <span className="font-medium truncate">{relatedOpportunity.name}</span>
                        </div>
                    </TooltipTrigger>
                    <TooltipContent><p>Oportunidad: {relatedOpportunity.name}</p></TooltipContent>
                </Tooltip></TooltipProvider>
            )}
        </CardFooter>
      )}
    </Card>
  );
}
