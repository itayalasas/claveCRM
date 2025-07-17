"use client";

import type { Quote, Lead, User } from "@/lib/types";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { DollarSign, Edit3, Trash2, UserCircle, CalendarDays, FileText, Percent } from "lucide-react";
import { format, parseISO, isValid } from 'date-fns';
import { es } from 'date-fns/locale';

interface QuoteListItemProps {
  quote: Quote;
  lead?: Lead | null;
  preparedBy?: User | null;
  onEdit: (quote: Quote) => void;
  onDelete: (quoteId: string) => void;
  // Añadiendo props de permisos
  canEdit: boolean;
  canDelete: boolean;
}

export function QuoteListItem({
  quote, 
  lead, 
  preparedBy, 
  onEdit, 
  onDelete,
  canEdit,
  canDelete
}: QuoteListItemProps) {
  
  const getStatusBadge = (status: Quote['status']) => {
    switch (status) {
      case 'Borrador': return <Badge variant="outline">{status}</Badge>;
      case 'Enviada': return <Badge className="bg-blue-500 hover:bg-blue-600 text-white">{status}</Badge>;
      case 'Aceptada': return <Badge className="bg-green-500 hover:bg-green-600 text-white">{status}</Badge>;
      case 'Rechazada': return <Badge variant="destructive">{status}</Badge>;
      case 'Expirada': return <Badge variant="secondary">{status}</Badge>;
      default: return <Badge>{status}</Badge>;
    }
  };

  return (
    // CAMBIO: Añadido w-full
    <Card className="shadow-sm hover:shadow-md transition-shadow w-full">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div>
            <CardTitle className="text-lg flex items-center gap-2">
              <FileText className="h-5 w-5 text-primary" /> Cotización #{quote.quoteNumber}
            </CardTitle>
            {lead && <CardDescription>Para: {lead.name} ({lead.company || 'N/A'})</CardDescription>}
          </div>
          <div className="flex gap-1">
            {canEdit && (
              <Button variant="ghost" size="icon" onClick={() => onEdit(quote)} className="h-8 w-8">
                <Edit3 className="h-4 w-4" />
              </Button>
            )}
            {canDelete && (
              <Button variant="ghost" size="icon" onClick={() => onDelete(quote.id)} className="h-8 w-8 text-destructive hover:text-destructive">
                <Trash2 className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="pb-3 space-y-2 text-sm">
        <div className="flex justify-between items-center">
          {getStatusBadge(quote.status)}
          <div className="font-semibold text-lg text-primary flex items-center">
            <DollarSign className="h-5 w-5 mr-1" />
            {quote.total.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground">
          <div className="flex items-center gap-1">
            <CalendarDays className="h-3 w-3" />
            Creada: {format(parseISO(quote.createdAt), "P", { locale: es })}
          </div>
          {quote.validUntil && isValid(parseISO(quote.validUntil)) && (
            <div className="flex items-center gap-1">
              <CalendarDays className="h-3 w-3" />
              Válida hasta: {format(parseISO(quote.validUntil), "P", { locale: es })}
            </div>
          )}
           {preparedBy && (
            <div className="flex items-center gap-1">
              <UserCircle className="h-3 w-3" />
              Preparada por: {preparedBy.name}
            </div>
          )}
          {typeof quote.discount === 'number' && quote.discount > 0 && (
            <div className="flex items-center gap-1 text-red-600">
                <Percent className="h-3 w-3" />
                Descuento: {quote.discount}%
            </div>
          )}
        </div>
         {quote.notes && <p className="text-xs text-muted-foreground pt-1 border-t mt-2 line-clamp-2">Notas: {quote.notes}</p>}
      </CardContent>
      <CardFooter className="text-xs text-muted-foreground">
        <p>Items: {quote.items.length}</p>
      </CardFooter>
    </Card>
  );
}