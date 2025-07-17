
"use client";

import type { ChatSession } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { formatDistanceToNowStrict, isValid, parseISO } from "date-fns";
import { es } from "date-fns/locale";
import { UserCheck, MessagesSquare, History, UserCircle, Smartphone } from "lucide-react"; // Added Smartphone
import { getUserInitials } from "@/lib/utils";

interface ChatListProps {
  sessions: ChatSession[];
  selectedSessionId: string | null;
  onSelectSession: (session: ChatSession) => void;
  isLoading: boolean;
  currentAgentId: string | null;
  isHistoryList?: boolean; // New prop
}

const VisitorDisplayIcon = ({ session }: { session: ChatSession }) => {
  const isGenericVisitor = !session.visitorName || session.visitorName.startsWith("Visitante ");
  const visitorName = session.visitorName || "Visitante";
  const fallbackInitial = getUserInitials(visitorName);

  if (session.channel === 'whatsapp') {
    return <Smartphone className="h-9 w-9 mr-3 text-green-500" />;
  }

  if (isGenericVisitor) {
    return <UserCircle className="h-9 w-9 mr-3 text-muted-foreground" />;
  }

  return (
    <Avatar className="h-9 w-9 mr-3">
      <AvatarImage src={`https://avatar.vercel.sh/${session.visitorId}.png?size=40`} alt={visitorName} data-ai-hint="visitor avatar" />
      <AvatarFallback>{fallbackInitial}</AvatarFallback>
    </Avatar>
  );
};


export function ChatList({ sessions, selectedSessionId, onSelectSession, isLoading, currentAgentId, isHistoryList = false }: ChatListProps) {
  if (isLoading) {
    return (
      <div className="space-y-2">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="flex items-center space-x-3 p-2">
            <Skeleton className="h-10 w-10 rounded-full" />
            <div className="space-y-1">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-3 w-24" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (sessions.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-muted-foreground p-4 text-center">
        {isHistoryList ? <History size={32} className="mb-2" /> : <MessagesSquare size={32} className="mb-2" />}
        <p className="text-sm">
          {isHistoryList ? "No hay chats en el historial." : "No hay conversaciones activas o pendientes."}
        </p>
        <p className="text-xs">
          {isHistoryList ? "Los chats cerrados aparecerán aquí." : "Nuevos chats aparecerán aquí."}
        </p>
      </div>
    );
  }

  return (
    <ScrollArea className="h-full">
      <div className="space-y-1">
        {sessions.map((session) => {
          let timeAgo = "hace un momento";
          if (session.lastMessageAt) {
            const lastMessageDate = parseISO(session.lastMessageAt);
            if (isValid(lastMessageDate)) {
              timeAgo = formatDistanceToNowStrict(lastMessageDate, { addSuffix: true, locale: es });
            } else {
              const attemptParseWithNewDate = new Date(session.lastMessageAt);
              if (isValid(attemptParseWithNewDate)) {
                timeAgo = formatDistanceToNowStrict(attemptParseWithNewDate, { addSuffix: true, locale: es });
              } else {
                 console.warn(`Invalid lastMessageAt for session ${session.id}: ${session.lastMessageAt}`);
              }
            }
          }

          return (
            <Button
              key={session.id}
              variant="ghost"
              className={cn(
                "w-full h-auto justify-start p-2 text-left",
                selectedSessionId === session.id && "bg-primary/10 text-primary hover:bg-primary/15"
              )}
              onClick={() => onSelectSession(session)}
            >
              <VisitorDisplayIcon session={session} />
              <div className="flex-grow min-w-0">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium truncate">{session.visitorName || `Visitante ${session.visitorId.substring(0,6)}`}</p>
                  <span className="text-xs text-muted-foreground shrink-0 ml-2">
                    {timeAgo}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  {session.status === 'pending' && !isHistoryList ? (
                    <Badge variant="outline" className="text-xs border-amber-500 text-amber-600">Pendiente</Badge>
                  ) : session.agentId === currentAgentId && !isHistoryList ? (
                    <Badge variant="default" className="text-xs bg-primary text-primary-foreground">Asignado a ti</Badge>
                  ) : session.agentId && !isHistoryList ? (
                     <Badge variant="secondary" className="text-xs">Asignado</Badge>
                  ) : session.status === 'closed' ? (
                      <Badge variant="outline" className="text-xs">Cerrado</Badge>
                  ) : (
                      <Badge variant="outline" className="text-xs">{session.status}</Badge>
                  )}
                  {session.channel === 'whatsapp' && <Smartphone className="h-3 w-3 text-green-500 ml-1" />}
                  {session.initialMessage && <p className="text-xs text-muted-foreground truncate">{session.initialMessage.substring(0,25)}...</p>}
                </div>
              </div>
            </Button>
          );
        })}
      </div>
    </ScrollArea>
  );
}
