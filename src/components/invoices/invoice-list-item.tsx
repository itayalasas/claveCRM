"use client";

import type { Invoice, Order, Lead, User } from "@/lib/types";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { DollarSign, Edit3, Trash2, UserCircle, CalendarDays, Receipt, ShoppingCart } from "lucide-react";
import { format, parseISO, isValid } from 'date-fns';
import { es } from 'date-fns/locale';

interface InvoiceListItemProps {
  invoice: Invoice;
  order?: Order | null;
  lead?: Lead | null;
  issuedBy?: User | null;
  onEdit: (invoice: Invoice) => void;
  onDelete: (invoiceId: string) => void;
  canEdit: boolean; // Nuevo prop para controlar la edición
  canDelete: boolean; // Nuevo prop para controlar la eliminación
}

export function InvoiceListItem({ 
  invoice, 
  order, 
  lead, 
  issuedBy, 
  onEdit, 
  onDelete,
  canEdit,
  canDelete 
}: InvoiceListItemProps) {
  
  const getStatusBadge = (status: Invoice['status']) => {
    switch (status) {
      case 'Borrador': return <Badge variant="outline">{status}</Badge>;
      case 'Enviada': return <Badge className="bg-blue-500 hover:bg-blue-600 text-white">{status}</Badge>;
      case 'Pagada': return <Badge className="bg-green-500 hover:bg-green-600 text-white">{status}</Badge>;
      case 'Vencida': return <Badge variant="destructive" className="bg-orange-500 hover:bg-orange-600 text-white">{status}</Badge>;
      case 'Cancelada': return <Badge variant="destructive">{status}</Badge>;
      default: return <Badge>{status}</Badge>;
    }
  };

  return (
    // CAMBIO: Añadido w-full para que el Card ocupe el ancho del contenedor padre
    <Card className="shadow-sm hover:shadow-md transition-shadow w-full">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div>
            <CardTitle className="text-lg flex items-center gap-2">
              <Receipt className="h-5 w-5 text-primary" /> Factura #{invoice.invoiceNumber}
            </CardTitle>
            {lead && <CardDescription>Cliente: {lead.name} ({lead.company || 'N/A'})</CardDescription>}
          </div>
          <div className="flex gap-1">
            {canEdit && (
              <Button variant="ghost" size="icon" onClick={() => onEdit(invoice)} className="h-8 w-8">
                <Edit3 className="h-4 w-4" />
              </Button>
            )}
            {canDelete && (
              <Button variant="ghost" size="icon" onClick={() => onDelete(invoice.id)} className="h-8 w-8 text-destructive hover:text-destructive">
                <Trash2 className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="pb-3 space-y-2 text-sm">
        <div className="flex justify-between items-center">
          {getStatusBadge(invoice.status)}
          <div className="font-semibold text-lg text-primary flex items-center">
            <DollarSign className="h-5 w-5 mr-1" />
            {invoice.total.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground">
          <div className="flex items-center gap-1">
            <CalendarDays className="h-3 w-3" />
            Emitida: {format(parseISO(invoice.createdAt), "P", { locale: es })}
          </div>
          <div className="flex items-center gap-1">
            <CalendarDays className="h-3 w-3 text-red-500" />
            Vence: {format(parseISO(invoice.dueDate), "P", { locale: es })}
          </div>
           {issuedBy && (
            <div className="flex items-center gap-1">
              <UserCircle className="h-3 w-3" />
              Emitida por: {issuedBy.name}
            </div>
          )}
          {order && (
            <div className="flex items-center gap-1">
                <ShoppingCart className="h-3 w-3" />
                Pedido: #{order.orderNumber}
            </div>
          )}
        </div>
         {invoice.paymentMethod && invoice.status === 'Pagada' && (
            <p className="text-xs text-green-600 pt-1 border-t mt-2">
                Pagada el {invoice.paymentDate ? format(parseISO(invoice.paymentDate), "P", { locale: es }) : ''} vía {invoice.paymentMethod}
            </p>
         )}
         {invoice.notes && <p className="text-xs text-muted-foreground pt-1 border-t mt-2 line-clamp-2">Notas: {invoice.notes}</p>}
      </CardContent>
      <CardFooter className="text-xs text-muted-foreground">
        <p>Items: {invoice.items.length}</p>
      </CardFooter>
    </Card>
  );
}