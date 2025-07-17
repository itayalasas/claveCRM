
"use client";

import type { Meeting, Lead, User, Resource } from "@/lib/types";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CalendarClock, Edit3, Trash2, Users, MapPin, Link as LinkIcon, Video, Briefcase } from "lucide-react";
import { format, parseISO, isValid } from 'date-fns';
import { es } from 'date-fns/locale';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { getUserInitials } from "@/lib/utils";

interface MeetingListItemProps {
  meeting: Meeting;
  leads: Lead[]; 
  users: User[]; 
  resources: Resource[];
  onEdit: (meeting: Meeting) => void;
  onDelete: (meetingId: string) => void;
}

export function MeetingListItem({ meeting, leads, users, resources, onEdit, onDelete }: MeetingListItemProps) {
  
  const getStatusBadge = (status: Meeting['status']) => {
    switch (status) {
      case 'Programada': return <Badge variant="outline" className="border-blue-500 text-blue-500">{status}</Badge>;
      case 'Confirmada': return <Badge className="bg-green-500 hover:bg-green-600 text-white">{status}</Badge>;
      case 'Cancelada': return <Badge variant="destructive">{status}</Badge>;
      case 'Realizada': return <Badge variant="secondary">{status}</Badge>;
      case 'Pospuesta': return <Badge className="bg-amber-500 hover:bg-amber-600 text-white">{status}</Badge>;
      default: return <Badge>{status}</Badge>;
    }
  };

  const relatedLead = meeting.relatedLeadId ? leads.find(l => l.id === meeting.relatedLeadId) : null;
  const createdByUser = users.find(u => u.id === meeting.createdByUserId);
  const selectedResource = meeting.resourceId ? resources.find(r => r.id === meeting.resourceId) : null;

  const formatTime = (isoString: string) => {
    if (!isValid(parseISO(isoString))) return "Hora inválida";
    return format(parseISO(isoString), "p", { locale: es });
  };
  
  const formatDate = (isoString: string) => {
     if (!isValid(parseISO(isoString))) return "Fecha inválida";
     return format(parseISO(isoString), "PP", { locale: es });
  }

  const getAttendeeName = (attendee: Meeting['attendees'][0]) => {
    if (attendee.type === 'user') {
        const user = users.find(u => u.id === attendee.id);
        return user ? user.name : attendee.name;
    }
    return attendee.name;
  }

  return (
    <Card className="shadow-sm hover:shadow-md transition-shadow">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <CardTitle className="text-lg flex items-center gap-2">
            <CalendarClock className="h-5 w-5 text-primary" />
            <span className="truncate" title={meeting.title}>{meeting.title}</span>
          </CardTitle>
          <div className="flex gap-1">
            <Button variant="ghost" size="icon" onClick={() => onEdit(meeting)} className="h-8 w-8">
              <Edit3 className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="icon" onClick={() => onDelete(meeting.id)} className="h-8 w-8 text-destructive hover:text-destructive">
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </div>
        <CardDescription className="text-xs pt-1 line-clamp-2">
          {meeting.description || "Sin descripción adicional."}
        </CardDescription>
      </CardHeader>
      <CardContent className="pb-3 space-y-2 text-sm">
        <div className="flex justify-between items-center">
          {getStatusBadge(meeting.status)}
          <div className="text-xs text-muted-foreground">
            {formatDate(meeting.startTime)}: {formatTime(meeting.startTime)} - {formatTime(meeting.endTime)}
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-muted-foreground pt-2 border-t mt-2">
          {meeting.location && (
            <div className="flex items-center gap-1 truncate" title={meeting.location}>
                <MapPin className="h-3 w-3 shrink-0" /> {meeting.location}
            </div>
          )}
          {meeting.conferenceLink && (
            <a href={meeting.conferenceLink} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-primary hover:underline truncate" title={meeting.conferenceLink}>
                <Video className="h-3 w-3 shrink-0" /> Enlace de Videoconferencia
            </a>
          )}
          {relatedLead && (
            <div className="flex items-center gap-1 truncate" title={`Lead: ${relatedLead.name}`}>
                <LinkIcon className="h-3 w-3 shrink-0" /> Lead: {relatedLead.name}
            </div>
          )}
           {selectedResource && (
            <div className="flex items-center gap-1 truncate" title={`Recurso: ${selectedResource.name}`}>
                <Briefcase className="h-3 w-3 shrink-0" /> Recurso: {selectedResource.name}
            </div>
          )}
          {createdByUser && (
             <div className="flex items-center gap-1 truncate" title={`Creado por: ${createdByUser.name}`}>
                <Users className="h-3 w-3 shrink-0" /> Creado por: {createdByUser.name}
            </div>
          )}
        </div>
      </CardContent>
      {meeting.attendees && meeting.attendees.length > 0 && (
        <CardFooter className="text-xs text-muted-foreground pt-2 border-t">
            <div className="flex items-center gap-1 mr-2"><Users className="h-3 w-3"/> Asistentes:</div>
            <div className="flex flex-wrap gap-1">
            {meeting.attendees.slice(0, 3).map(att => (
                 <TooltipProvider key={att.id} delayDuration={100}>
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <Avatar className="h-5 w-5 border">
                                <AvatarImage src={`https://avatar.vercel.sh/${att.email}.png`} alt={getAttendeeName(att)} data-ai-hint="attendee avatar"/>
                                <AvatarFallback>{getUserInitials(getAttendeeName(att))}</AvatarFallback>
                            </Avatar>
                        </TooltipTrigger>
                        <TooltipContent><p>{getAttendeeName(att)} ({att.email}) - {att.status}</p></TooltipContent>
                    </Tooltip>
                 </TooltipProvider>
            ))}
            {meeting.attendees.length > 3 && <Badge variant="outline">+{meeting.attendees.length - 3} más</Badge>}
            </div>
        </CardFooter>
      )}
    </Card>
  );
}
