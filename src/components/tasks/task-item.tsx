
"use client";

import type { Task, Lead, User } from "@/lib/types"; 
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Edit3, Trash2, CalendarDays, User as UserIcon, LinkIcon, Paperclip, MessageSquareText, Repeat } from "lucide-react"; 
import { format, parseISO, differenceInDays, isValid } from 'date-fns';
import { es } from 'date-fns/locale'; 
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useAuth } from "@/contexts/auth-context";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion"


interface TaskItemProps {
  task: Task;
  leads: Lead[];
  users: User[]; 
  onToggleComplete: (taskId: string) => void;
  onEdit: (task: Task) => void;
  onDelete: (taskId: string) => void;
}

const UserAvatarTooltip = ({ user, labelPrefix, currentAuthUser }: { user?: User, labelPrefix?: string, currentAuthUser?: User | null }) => {
  if (!user) return <span className="text-xs text-muted-foreground">N/A</span>;
  return (
    <TooltipProvider delayDuration={100}>
      <Tooltip>
        <TooltipTrigger asChild>
          <div className="flex items-center gap-1">
            {labelPrefix && <span className="text-xs">{labelPrefix}</span>}
            <Avatar className="h-5 w-5">
              <AvatarImage src={user.avatarUrl || `https://avatar.vercel.sh/${user.email}.png`} alt={user.name} data-ai-hint="user avatar" />
              <AvatarFallback>{user.name.substring(0, 1).toUpperCase()}</AvatarFallback>
            </Avatar>
            <span className="text-xs hidden sm:inline">{user.name} {currentAuthUser && user.id === currentAuthUser.id ? "(Yo)" : ""}</span>
          </div>
        </TooltipTrigger>
        <TooltipContent>
          <p>{user.name}</p>
          <p className="text-xs text-muted-foreground">{user.email}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};


export function TaskItem({ task, leads, users, onToggleComplete, onEdit, onDelete }: TaskItemProps) {
  const { currentUser } = useAuth();
  const relatedLead = task.relatedLeadId ? leads.find(l => l.id === task.relatedLeadId) : null;
  const assignee = task.assigneeUserId ? users.find(u => u.id === task.assigneeUserId) : null;
  
  const getDueDateBadge = () => {
    if (!task.dueDate || !isValid(parseISO(task.dueDate))) return null;
    const dueDate = parseISO(task.dueDate);
    const today = new Date();
    today.setHours(0,0,0,0); 
    const daysDiff = differenceInDays(dueDate, today);

    if (task.completed) return <Badge className="bg-green-500 hover:bg-green-600 text-white">Completada</Badge>;
    if (daysDiff < 0) return <Badge className="bg-red-500 hover:bg-red-600 text-white">Vencida</Badge>;
    if (daysDiff === 0) return <Badge className="bg-amber-500 hover:bg-amber-600 text-white">Vence Hoy</Badge>;
    if (daysDiff <= 3) return <Badge className="bg-yellow-400 hover:bg-yellow-500 text-black">Vence Pronto</Badge>;
    return <Badge variant="outline">Vence {format(dueDate, "d MMM", { locale: es })}</Badge>;
  };

  const getPriorityBadge = () => {
    if (!task.priority) return null;
    let priorityText = task.priority;
    let badgeClass = "capitalize";

    switch (task.priority) {
      case 'high': 
        priorityText = 'Alta';
        badgeClass += " bg-red-500 hover:bg-red-600 text-white"; 
        break;
      case 'medium': 
        priorityText = 'Media';
        badgeClass += " bg-amber-500 hover:bg-amber-600 text-white";
        break;
      case 'low': 
        priorityText = 'Baja';
        badgeClass += " bg-gray-400 hover:bg-gray-500 text-white"; 
        break;
      default: 
        return <Badge variant="outline" className="capitalize">{priorityText}</Badge>;
    }
    return <Badge className={badgeClass}>{priorityText}</Badge>;
  };

  return (
    <Card className={`transition-all duration-200 ${task.completed ? 'bg-muted/50 opacity-70' : 'bg-card'}`}>
      <CardContent className="p-0">
        <Accordion type="single" collapsible className="w-full">
          <AccordionItem value={`task-${task.id}-details`} className="border-b-0">
             <div className="flex items-start gap-4 p-4">
                <Checkbox
                id={`task-${task.id}`}
                checked={task.completed}
                onCheckedChange={() => onToggleComplete(task.id)}
                className="mt-1 shrink-0"
                aria-label={task.completed ? "Marcar tarea como incompleta" : "Marcar tarea como completa"}
                />
                <div className="flex-grow">
                  <AccordionTrigger className="p-0 hover:no-underline">
                    <label
                        htmlFor={`task-${task.id}`} 
                        className={`font-medium cursor-pointer text-left ${task.completed ? "line-through text-muted-foreground" : "text-card-foreground"}`}
                    >
                        {task.title}
                    </label>
                  </AccordionTrigger>
                
                {task.description && (
                    <p className={`text-sm mt-1 ${task.completed ? "text-muted-foreground/70" : "text-muted-foreground"}`}>
                    {task.description.length > 100 ? `${task.description.substring(0, 97)}...` : task.description}
                    </p>
                )}
                <div className="mt-2 flex flex-wrap gap-2 items-center text-xs text-muted-foreground">
                    {task.dueDate && isValid(parseISO(task.dueDate)) && (
                    <span className="flex items-center gap-1">
                        <CalendarDays className="h-3 w-3" /> {format(parseISO(task.dueDate), "PP", { locale: es })}
                    </span>
                    )}
                    {getDueDateBadge()}
                    {getPriorityBadge()}
                    {task.isMonthlyRecurring && (
                       <TooltipProvider delayDuration={100}>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <span className="flex items-center gap-1 p-1 px-1.5 bg-blue-100 text-blue-700 rounded-md hover:bg-blue-200 cursor-default">
                              <Repeat className="h-3 w-3" /> Recurrente
                            </span>
                          </TooltipTrigger>
                          <TooltipContent>
                            <p>Esta tarea es recurrente (mensual, primer día del mes).</p>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    )}
                    {relatedLead && (
                    <TooltipProvider delayDuration={100}>
                        <Tooltip>
                        <TooltipTrigger asChild>
                            <span className="flex items-center gap-1 p-1 px-1.5 bg-secondary rounded-md hover:bg-secondary/80 cursor-default">
                            <LinkIcon className="h-3 w-3 text-primary" /> {relatedLead.name}
                            </span>
                        </TooltipTrigger>
                        <TooltipContent>
                            <p>Enlazado a Lead: {relatedLead.name}</p>
                        </TooltipContent>
                        </Tooltip>
                    </TooltipProvider>
                    )}
                    {assignee ? (
                        <UserAvatarTooltip user={assignee} labelPrefix="Para:" currentAuthUser={currentUser} />
                    ) : (
                    <span className="flex items-center gap-1 p-1 px-1.5 bg-muted rounded-md text-xs">
                        <UserIcon className="h-3 w-3" /> Sin asignar
                    </span>
                    )}
                </div>
                </div>
                <div className="flex gap-1 shrink-0">
                <Button variant="ghost" size="icon" onClick={() => onEdit(task)} className="h-8 w-8" aria-label="Editar tarea">
                    <Edit3 className="h-4 w-4" />
                </Button>
                <Button variant="ghost" size="icon" onClick={() => onDelete(task.id)} className="h-8 w-8 text-destructive hover:text-destructive" aria-label="Eliminar tarea">
                    <Trash2 className="h-4 w-4" />
                </Button>
                </div>
            </div>
            <AccordionContent className="px-4 pb-4 space-y-3">
                {task.description && task.description.length > 100 && (
                    <div className="pt-2 border-t">
                        <h4 className="text-xs font-semibold text-muted-foreground mb-1">Descripción Completa:</h4>
                        <p className="text-sm text-card-foreground whitespace-pre-wrap">{task.description}</p>
                    </div>
                )}
                {task.solutionDescription && (
                <div className="pt-2 border-t">
                    <h4 className="text-sm font-semibold text-primary flex items-center gap-1 mb-1"><MessageSquareText className="h-4 w-4"/>Descripción de la Solución:</h4>
                    <p className="text-sm text-card-foreground whitespace-pre-wrap">{task.solutionDescription}</p>
                </div>
                )}
                {task.attachments && task.attachments.length > 0 && (
                <div className="pt-2 border-t">
                    <h4 className="text-sm font-semibold text-primary flex items-center gap-1 mb-1"><Paperclip className="h-4 w-4"/>Adjuntos:</h4>
                    <ul className="list-none space-y-1 text-sm text-card-foreground">
                    {task.attachments.map((url, index) => {
                       const fileName = decodeURIComponent(url.split('/').pop()?.split('?')[0] || 'archivo').substring(url.indexOf('-') + 1) ; // Basic name extraction
                       return (
                         <li key={index}>
                           <a 
                             href={url} 
                             target="_blank" 
                             rel="noopener noreferrer" 
                             className="text-primary hover:underline flex items-center gap-1 break-all"
                             title={`Descargar ${fileName}`}
                            >
                             <Paperclip className="h-3 w-3 shrink-0"/> {fileName}
                           </a>
                         </li> 
                       );
                    })}
                    </ul>
                </div>
                )}
                {!task.solutionDescription && (!task.attachments || task.attachments.length === 0) && (!task.description || task.description.length <=100) && (
                     <p className="text-sm text-muted-foreground pt-2 border-t">No hay detalles adicionales para esta tarea.</p>
                )}
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      </CardContent>
    </Card>
  );
}

