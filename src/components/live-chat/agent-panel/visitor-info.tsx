
"use client";

import type { ChatSession, Lead, Ticket } from "@/lib/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { UserCircle, Link as LinkIconLucide, Users, ListChecks, PlusCircle, ExternalLink } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useRouter } from "next/navigation"; // Import useRouter

interface VisitorInfoProps {
  session: ChatSession | null;
  onOpenCreateLeadDialog: (session: ChatSession) => void;
  onOpenCreateTicketDialog: (session: ChatSession) => void;
  onOpenLinkEntityDialog: (session: ChatSession) => void;
  linkedLead: Lead | null;
  linkedTicket: Ticket | null;
}

export function VisitorInfo({ 
    session, 
    onOpenCreateLeadDialog, 
    onOpenCreateTicketDialog,
    onOpenLinkEntityDialog,
    linkedLead,
    linkedTicket
}: VisitorInfoProps) {
  const router = useRouter(); // Initialize router

  if (!session) {
    return (
      <Card className="h-full flex flex-col">
        <CardHeader className="p-2 pb-1">
          <CardTitle className="text-sm flex items-center gap-1">
            <UserCircle className="h-4 w-4 text-muted-foreground" />
            Información del Visitante
          </CardTitle>
        </CardHeader>
        <CardContent className="p-2 text-xs text-muted-foreground flex-grow flex items-center justify-center">
          <p>Selecciona un chat para ver la información del visitante y opciones de CRM.</p>
        </CardContent>
      </Card>
    );
  }

  const handleNavigateToLead = (leadId: string) => {
    router.push(`/pipeline?leadId=${leadId}`);
  };

  const handleNavigateToTicket = (ticketId: string) => {
    router.push(`/tickets?ticketId=${ticketId}`);
  };

  return (
    <Card className="h-full flex flex-col">
      <CardHeader className="p-2 pb-1">
        <CardTitle className="text-sm flex items-center gap-1">
            <UserCircle className="h-4 w-4 text-muted-foreground" />
            Información del Visitante
        </CardTitle>
      </CardHeader>
      <CardContent className="p-2 text-xs space-y-1 flex-grow overflow-y-auto">
        <p><strong>ID:</strong> <span className="text-muted-foreground">{session.visitorId.substring(0,12)}...</span></p>
        {session.visitorName && <p><strong>Nombre:</strong> <span className="text-muted-foreground">{session.visitorName}</span></p>}
        {session.currentPageUrl && (
            <div className="flex items-start gap-1">
                <strong>Página:</strong>
                <a 
                    href={session.currentPageUrl} 
                    target="_blank" 
                    rel="noopener noreferrer" 
                    className="text-primary hover:underline truncate text-muted-foreground"
                    title={session.currentPageUrl}
                >
                    <LinkIconLucide className="inline h-3 w-3 mr-0.5"/>{session.currentPageUrl}
                </a>
            </div>
        )}
        
        <div className="pt-2 mt-2 border-t">
            <h4 className="font-semibold text-xs mb-1">Vínculos CRM:</h4>
            {linkedLead ? (
                <div className="flex items-center justify-between text-xs p-1.5 bg-primary/10 rounded-md">
                    <span className="flex items-center gap-1">
                        <Users className="h-3 w-3 text-primary"/> Lead: {linkedLead.name}
                    </span>
                    <Button variant="ghost" size="icon" className="h-5 w-5" onClick={() => handleNavigateToLead(linkedLead.id)}>
                        <ExternalLink className="h-3 w-3"/>
                    </Button>
                </div>
            ) : session.relatedLeadId && <p className="text-xs text-muted-foreground">ID Lead Vinculado: {session.relatedLeadId.substring(0,8)}...</p>
            }
            {linkedTicket ? (
                <div className="flex items-center justify-between text-xs p-1.5 bg-primary/10 rounded-md mt-1">
                     <span className="flex items-center gap-1">
                        <ListChecks className="h-3 w-3 text-primary"/> Ticket: {linkedTicket.title}
                    </span>
                     <Button variant="ghost" size="icon" className="h-5 w-5" onClick={() => handleNavigateToTicket(linkedTicket.id)}>
                        <ExternalLink className="h-3 w-3"/>
                    </Button>
                </div>
            ) : session.relatedTicketId && <p className="text-xs text-muted-foreground mt-1">ID Ticket Vinculado: {session.relatedTicketId.substring(0,8)}...</p>
            }
             {session.relatedContactId && <p className="text-xs text-muted-foreground mt-1">ID Contacto Vinculado: {session.relatedContactId.substring(0,8)}...</p>}

            {!linkedLead && !linkedTicket && !session.relatedContactId && (
                <p className="text-xs text-muted-foreground">Este chat no está vinculado a ningún elemento del CRM.</p>
            )}
        </div>

      </CardContent>
       <CardContent className="p-2 border-t mt-auto">
        <div className="space-y-1.5">
            <Button size="sm" className="w-full text-xs justify-start" onClick={() => onOpenCreateLeadDialog(session)} disabled={!!session.relatedLeadId}>
                <PlusCircle className="mr-1.5 h-3.5 w-3.5"/> Crear Lead desde Chat
            </Button>
            <Button size="sm" className="w-full text-xs justify-start" onClick={() => onOpenCreateTicketDialog(session)} disabled={!!session.relatedTicketId}>
                <PlusCircle className="mr-1.5 h-3.5 w-3.5"/> Crear Ticket desde Chat
            </Button>
            <Button variant="outline" size="sm" className="w-full text-xs justify-start" onClick={() => onOpenLinkEntityDialog(session)}>
                <LinkIconLucide className="mr-1.5 h-3.5 w-3.5"/> Vincular a Lead/Contacto Existente
            </Button>
        </div>
      </CardContent>
    </Card>
  );
}

