
"use client";

import type { EmailMessage } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Paperclip, ArrowLeft, Reply, ReplyAll, Forward, Trash2, Clock, Send, Inbox, Archive as ArchiveIcon, MailOpen } from "lucide-react"; // Added MailOpen
import { format, parseISO, isValid } from "date-fns";
import { es } from 'date-fns/locale';
import { getUserInitials } from "@/lib/utils";
import { Badge } from "@/components/ui/badge"; // Added Badge
import { Separator } from "@/components/ui/separator"; // Added Separator

interface EmailDetailViewProps {
  email: EmailMessage;
  onClose: () => void;
  onReply: (email: EmailMessage) => void;
  onReplyAll: (email: EmailMessage) => void;
  onForward: (email: EmailMessage) => void;
  onDelete: (emailId: string, currentStatus: EmailMessage['status'], collectionSource: 'incomingEmails' | 'outgoingEmails') => void; 
}

export function EmailDetailView({ email, onClose, onReply, onReplyAll, onForward, onDelete }: EmailDetailViewProps) {
  
  const renderRecipientsList = (recipients: { name?: string, email: string }[] | undefined, type: "Para" | "CC" | "CCO") => {
    if (!recipients || recipients.length === 0) return null;
    return (
        <div className="flex items-start text-xs">
            <span className="font-medium text-muted-foreground w-12 shrink-0">{type}:</span>
            <span className="text-foreground break-all">{recipients.map(r => r.name ? `${r.name} <${r.email}>` : r.email).join(', ')}</span>
        </div>
    );
  };

  const getStatusIcon = (status: EmailMessage['status']) => {
    // ... (keep existing getStatusIcon logic)
    switch (status) {
      case 'sent': return <Send className="h-4 w-4 text-green-500" />;
      case 'pending': return <Clock className="h-4 w-4 text-amber-500" />;
      case 'received': return <Inbox className="h-4 w-4 text-blue-500" />;
      case 'draft': return <ArchiveIcon className="h-4 w-4 text-gray-500" />;
      case 'deleted': return <Trash2 className="h-4 w-4 text-destructive" />;
      default: return null;
    }
  };

  const formatFileSize = (bytes?: number): string => {
    if (bytes === undefined || bytes === null || isNaN(bytes)) return '';
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `(${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]})`;
  };

  return (
    <div className="flex flex-col h-full bg-card text-card-foreground">
      {/* Header Toolbar */}
      <div className="p-2 border-b flex items-center justify-between shrink-0 bg-muted/30">
        <div className="flex items-center gap-1">
            <Button variant="ghost" size="icon" onClick={onClose} title="Volver a la lista">
                <ArrowLeft className="h-5 w-5" />
            </Button>
            <Separator orientation="vertical" className="h-6 mx-1" />
            <Button variant="ghost" size="sm" onClick={() => onReply(email)} title="Responder">
                <Reply className="mr-1.5 h-4 w-4" /> Responder
            </Button>
            <Button variant="ghost" size="sm" onClick={() => onReplyAll(email)} title="Responder a Todos" disabled={(email.to?.length || 0) + (email.cc?.length || 0) <= 0 && email.status !== 'received'}>
                <ReplyAll className="mr-1.5 h-4 w-4" />
            </Button>
            <Button variant="ghost" size="sm" onClick={() => onForward(email)} title="Reenviar">
                <Forward className="mr-1.5 h-4 w-4" />
            </Button>
        </div>
        <div className="flex items-center gap-1">
             {getStatusIcon(email.status) && (
                 <Badge variant="outline" className="text-xs capitalize py-0.5 px-1.5 border-transparent">
                    {getStatusIcon(email.status)}
                    <span className="ml-1">{email.status}</span>
                 </Badge>
             )}
             <Separator orientation="vertical" className="h-6 mx-1" />
            <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-destructive" title="Mover a Papelera" onClick={() => onDelete(email.id, email.status, email.collectionSource)} disabled={email.status === 'deleted'}>
                <Trash2 className="h-5 w-5" />
            </Button>
        </div>
      </div>

      {/* Email Metadata Area */}
      <div className="p-4 border-b shrink-0">
        <h2 className="text-xl font-semibold mb-3 break-all">{email.subject || "(Sin Asunto)"}</h2>
        <div className="flex items-start gap-3">
          <Avatar className="h-10 w-10 mt-0.5">
            <AvatarImage src={email.from.avatarUrl || `https://avatar.vercel.sh/${email.from.email}.png`} alt={email.from.name || email.from.email} data-ai-hint="sender avatar"/>
            <AvatarFallback>{getUserInitials(email.from.name || email.from.email)}</AvatarFallback>
          </Avatar>
          <div className="flex-grow space-y-0.5">
            <div className="flex justify-between items-baseline">
                <span className="text-sm font-semibold text-foreground">{email.from.name || email.from.email}</span>
                <time className="text-xs text-muted-foreground">
                    {isValid(parseISO(email.date)) ? format(parseISO(email.date), "PPpp", { locale: es }) : "Fecha inválida"}
                </time>
            </div>
            {renderRecipientsList(email.to, "Para")}
            {renderRecipientsList(email.cc, "CC")}
            {renderRecipientsList(email.bcc, "CCO")}
          </div>
        </div>
      </div>

      {/* Email Body & Attachments */}
      <ScrollArea className="flex-grow">
        <div className="p-4">
          {email.bodyHtml ? (
            <div className="prose prose-sm max-w-none prose-p:my-1 prose-headings:my-2" dangerouslySetInnerHTML={{ __html: email.bodyHtml }} />
          ) : (
            <pre className="text-sm whitespace-pre-wrap font-sans">{email.bodyText || "Este correo no tiene contenido de texto visible."}</pre>
          )}

          {email.attachments && email.attachments.length > 0 && (
            <div className="mt-6 pt-4 border-t">
              <h4 className="text-sm font-semibold mb-2 text-muted-foreground">Adjuntos ({email.attachments.length})</h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
                {email.attachments.map((att, index) => (
                  <a 
                    key={index} 
                    href={att.url || '#'} 
                    download={att.name} 
                    target="_blank" 
                    rel="noopener noreferrer" 
                    className="group flex items-center gap-2 p-2 border rounded-md hover:bg-muted/50 transition-colors text-xs"
                    title={`Descargar ${att.name}`}
                  >
                    <Paperclip className="h-4 w-4 text-muted-foreground group-hover:text-primary shrink-0" /> 
                    <span className="truncate flex-grow">{att.name}</span>
                    <span className="text-muted-foreground/70 shrink-0">{formatFileSize(att.size)}</span>
                  </a>
                ))}
              </div>
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}