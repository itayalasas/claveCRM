
"use client";

import type { Order, Lead, User, Quote } from "@/lib/types";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { DollarSign, Edit3, Trash2, UserCircle, CalendarDays, ShoppingCart, FileText } from "lucide-react";
import { format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';

interface OrderListItemProps {
  order: Order;
  lead?: Lead | null;
  quote?: Quote | null;
  placedBy?: User | null;
  onEdit: (order: Order) => void;
  onDelete: (orderId: string) => void;
  // Asumiendo que podrías querer pasar permisos también, similar a InvoiceListItem
  canEdit: boolean;
  canDelete: boolean;
}

export function OrderListItem({ 
  order, 
  lead, 
  quote, 
  placedBy, 
  onEdit, 
  onDelete,
  canEdit,
  canDelete 
}: OrderListItemProps) {
  
  const getStatusBadge = (status: Order['status']) => {
    switch (status) {
      case 'Pendiente': return <Badge variant="outline">{status}</Badge>;
      case 'Procesando': return <Badge className="bg-amber-500 hover:bg-amber-600 text-white">{status}</Badge>;
      case 'Enviado': return <Badge className="bg-blue-500 hover:bg-blue-600 text-white">{status}</Badge>;
      case 'Entregado': return <Badge className="bg-green-500 hover:bg-green-600 text-white">{status}</Badge>;
      case 'Cancelado': return <Badge variant="destructive">{status}</Badge>;
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
              <ShoppingCart className="h-5 w-5 text-primary" /> Pedido #{order.orderNumber}
            </CardTitle>
            {lead && <CardDescription>Cliente: {lead.name} ({lead.company || 'N/A'})</CardDescription>}
          </div>
          <div className="flex gap-1">
            {canEdit && (
              <Button variant="ghost" size="icon" onClick={() => onEdit(order)} className="h-8 w-8">
                <Edit3 className="h-4 w-4" />
              </Button>
            )}
            {canDelete && (
              <Button variant="ghost" size="icon" onClick={() => onDelete(order.id)} className="h-8 w-8 text-destructive hover:text-destructive">
                <Trash2 className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="pb-3 space-y-2 text-sm">
        <div className="flex justify-between items-center">
          {getStatusBadge(order.status)}
          <div className="font-semibold text-lg text-primary flex items-center">
            <DollarSign className="h-5 w-5 mr-1" />
            {order.total.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground">
          <div className="flex items-center gap-1">
            <CalendarDays className="h-3 w-3" />
            Creado: {format(parseISO(order.createdAt), "P p", { locale: es })}
          </div>
          {placedBy && (
            <div className="flex items-center gap-1">
              <UserCircle className="h-3 w-3" />
              Realizado por: {placedBy.name}
            </div>
          )}
          {quote && (
            <div className="flex items-center gap-1 col-span-2">
                <FileText className="h-3 w-3" />
                Desde Cotización: #{quote.quoteNumber}
            </div>
          )}
        </div>
         {order.shippingAddress && <p className="text-xs text-muted-foreground pt-1 border-t mt-2 line-clamp-1">Envío: {order.shippingAddress}</p>}
      </CardContent>
       <CardFooter className="text-xs text-muted-foreground">
        <p>Items: {order.items.length}</p>
      </CardFooter>
    </Card>
  );
}
