
"use client";

import type { SupportQueue, User, SLA } from "@/lib/types";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { LayersIcon, Edit3, Trash2, Users, UserCircle, ShieldCheck, CalendarDays } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { format, parseISO, isValid } from 'date-fns';
import { es } from 'date-fns/locale';
import { getUserInitials } from '@/lib/utils';


interface SupportQueueListItemProps {
  queue: SupportQueue;
  users: User[];
  slas: SLA[];
  onEdit: (queue: SupportQueue) => void;
  onDelete: (queueId: string) => void;
}

export function SupportQueueListItem({ queue, users, slas, onEdit, onDelete }: SupportQueueListItemProps) {
  const defaultAssignee = queue.defaultAssigneeUserId ? users.find(u => u.id === queue.defaultAssigneeUserId) : null;
  const defaultSla = queue.defaultSlaId ? slas.find(s => s.id === queue.defaultSlaId) : null;
  const memberCount = queue.memberUserIds?.length || 0;

  return (
    <Card className="shadow-sm hover:shadow-md transition-shadow">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3 min-w-0">
             <LayersIcon className="h-5 w-5 text-primary" />
            <CardTitle className="text-base truncate" title={queue.name}>
              {queue.name}
            </CardTitle>
          </div>
          <div className="flex gap-1">
            <Button variant="ghost" size="icon" onClick={() => onEdit(queue)} className="h-8 w-8">
              <Edit3 className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="icon" onClick={() => onDelete(queue.id)} className="h-8 w-8 text-destructive hover:text-destructive">
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </div>
         {queue.description && (
          <CardDescription className="text-xs pt-1 line-clamp-2">{queue.description}</CardDescription>
        )}
      </CardHeader>
      <CardContent className="pb-3 space-y-2 text-sm text-muted-foreground">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1 text-xs">
          {defaultAssignee && (
            <div className="flex items-center gap-1" title={`Asignado por defecto: ${defaultAssignee.name}`}>
              <UserCircle className="h-3 w-3 shrink-0" /> Asignado por defecto: {defaultAssignee.name}
            </div>
          )}
           {defaultSla && (
            <div className="flex items-center gap-1" title={`SLA por defecto: ${defaultSla.name}`}>
              <ShieldCheck className="h-3 w-3 shrink-0 text-green-500" /> SLA: {defaultSla.name}
            </div>
          )}
          <div className="flex items-center gap-1" title="Número de miembros en la cola">
            <Users className="h-3 w-3 shrink-0" /> {memberCount} Miembro(s)
          </div>
        </div>
        {queue.memberUserIds && queue.memberUserIds.length > 0 && (
             <div className="pt-1 mt-1 border-t">
                <span className="text-xs font-medium">Miembros: </span>
                <div className="flex flex-wrap gap-1 mt-0.5">
                {queue.memberUserIds.slice(0,5).map(userId => {
                    const user = users.find(u => u.id === userId);
                    if (!user) return null;
                    return (
                        <TooltipProvider key={userId}>
                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <Avatar className="h-5 w-5 border">
                                        <AvatarImage src={user.avatarUrl || `https://avatar.vercel.sh/${user.email}.png`} alt={user.name} data-ai-hint="user avatar" />
                                        <AvatarFallback>{getUserInitials(user.name)}</AvatarFallback>
                                    </Avatar>
                                </TooltipTrigger>
                                <TooltipContent><p>{user.name}</p></TooltipContent>
                            </Tooltip>
                        </TooltipProvider>
                    )
                })}
                {memberCount > 5 && <Badge variant="outline" className="text-xs self-center">+{memberCount-5} más</Badge>}
                </div>
            </div>
        )}
      </CardContent>
      <CardFooter className="pt-2 pb-3 border-t text-xs text-muted-foreground">
            <div className="flex items-center gap-1">
                <CalendarDays className="h-3 w-3 shrink-0" /> 
                Creada: {isValid(parseISO(queue.createdAt)) ? format(parseISO(queue.createdAt), "PP", { locale: es }) : 'Fecha inválida'}
            </div>
      </CardFooter>
    </Card>
  );
}

    