
"use client";

import type { EmailCampaign } from "@/lib/types";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Send, Edit3, Trash2, BarChart2, CalendarClock, TestTube2, Users, Beaker } from "lucide-react";
import { format, parseISO, isValid } from 'date-fns';
import { es } from 'date-fns/locale';

interface EmailCampaignItemProps {
  campaign: EmailCampaign;
  onEdit: (campaignId: string) => void;
  onDelete: (campaignId: string) => void;
  onViewAnalytics: (campaign: EmailCampaign) => void;
}

export function EmailCampaignItem({ campaign, onEdit, onDelete, onViewAnalytics }: EmailCampaignItemProps) {

  const getStatusBadge = (status: EmailCampaign['status']) => {
    switch (status) {
      case 'Borrador': return <Badge variant="outline">{status}</Badge>;
      case 'Programada': return <Badge className="bg-blue-500 hover:bg-blue-600 text-white">{status}</Badge>;
      case 'Enviando': return <Badge className="bg-amber-500 hover:bg-amber-600 text-white">{status}</Badge>;
      case 'Enviada': return <Badge className="bg-green-500 hover:bg-green-600 text-white">{status}</Badge>;
      case 'Archivada': return <Badge variant="secondary">{status}</Badge>;
      case 'Fallida': return <Badge variant="destructive">{status}</Badge>;
      default: return <Badge>{status}</Badge>;
    }
  };

  const analyticsAvailable = campaign.analytics && (typeof campaign.analytics.emailsSent === 'number' || typeof campaign.analytics.totalRecipients === 'number');
  const canViewAnalytics = campaign.status === 'Enviada' || campaign.status === 'Fallida' || (campaign.status === 'Enviando' && analyticsAvailable);
  const canEditCampaign = campaign.status === 'Borrador' || campaign.status === 'Programada' || campaign.status === 'Fallida';
  const isABTest = campaign.abTest?.isEnabled;


  return (
    <Card className="shadow-sm hover:shadow-md transition-shadow flex flex-col justify-between h-full">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <CardTitle className="text-lg flex items-center gap-2">
            <Send className="h-5 w-5 text-primary" />
            <span className="truncate" title={campaign.name}>{campaign.name}</span>
             {isABTest && <Badge variant="outline" className="text-xs border-purple-500 text-purple-600"><Beaker className="h-3 w-3 mr-1"/>A/B</Badge>}
          </CardTitle>
        </div>
        <CardDescription className="text-xs pt-1 line-clamp-2" title={campaign.subject}>
          Asunto: {campaign.subject} {isABTest && "(Variante A)"}
        </CardDescription>
         {isABTest && campaign.abTest?.variantBSubject && (
            <CardDescription className="text-xs pt-0.5 line-clamp-2" title={campaign.abTest.variantBSubject}>
              Asunto B: {campaign.abTest.variantBSubject}
            </CardDescription>
        )}
      </CardHeader>
      <CardContent className="pb-3 flex-grow space-y-2 text-sm">
        <div className="flex items-center justify-between">
            {getStatusBadge(campaign.status)}
        </div>

        <div className="text-xs text-muted-foreground space-y-1">
            {campaign.scheduledAt && isValid(parseISO(campaign.scheduledAt)) && campaign.status === "Programada" && (
                <p className="flex items-center gap-1"><CalendarClock className="h-3 w-3" /> Programada para: {format(parseISO(campaign.scheduledAt), "PPp", { locale: es })}</p>
            )}
            {campaign.sentAt && isValid(parseISO(campaign.sentAt)) && (campaign.status === "Enviada" || campaign.status === "Fallida") && (
                <p className="flex items-center gap-1"><CalendarClock className="h-3 w-3 text-green-500" /> {(campaign.status === "Enviada" ? "Enviada" : "Procesada")} el: {format(parseISO(campaign.sentAt), "PPp", { locale: es })}</p>
            )}
             <p className="flex items-center gap-1"><CalendarClock className="h-3 w-3" /> Creada: {format(parseISO(campaign.createdAt), "P", { locale: es })}</p>
        </div>
         {analyticsAvailable && (
          <div className="text-xs text-muted-foreground pt-2 border-t mt-2 space-y-0.5">
            {typeof campaign.analytics.totalRecipients === 'number' &&
                <p className="flex items-center gap-1"><Users className="h-3 w-3" /> Destinatarios: {campaign.analytics.totalRecipients}</p>
            }
            {typeof campaign.analytics.emailsSent === 'number' &&
                <p className="flex items-center gap-1"><Send className="h-3 w-3 text-green-500" />Enviados: {campaign.analytics.emailsSent}</p>
            }
          </div>
        )}
      </CardContent>
      <CardFooter className="flex flex-wrap justify-end items-center gap-2 pt-3 border-t">
        <Button
            variant="outline"
            size="sm"
            onClick={() => onViewAnalytics(campaign)}
            disabled={!canViewAnalytics}
        >
          <BarChart2 className="mr-2 h-4 w-4" /> Analíticas
        </Button>
        <Button variant="outline" size="sm" onClick={() => onEdit(campaign.id)}>
          <TestTube2 className="mr-2 h-4 w-4" /> Pruebas A/B
        </Button>
        <Button variant="default" size="sm" onClick={() => onEdit(campaign.id)} disabled={!canEditCampaign}>
          <Edit3 className="mr-2 h-4 w-4" /> Editar
        </Button>
        <Button variant="destructive" size="sm" onClick={() => onDelete(campaign.id)}>
          <Trash2 className="mr-2 h-4 w-4" /> Eliminar
        </Button>
      </CardFooter>
    </Card>
  );
}
