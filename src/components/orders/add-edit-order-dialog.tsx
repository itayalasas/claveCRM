
"use client";

import { useState, useEffect, useId } from "react";
import type { Order, Lead, User, OrderStatus, OrderItem, Quote } from "@/lib/types";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PlusCircle, Trash2 } from "lucide-react";
import { ORDER_STATUSES } from "@/lib/constants";
import { useToast } from "@/hooks/use-toast";

interface AddEditOrderDialogProps {
  trigger: React.ReactNode;
  orderToEdit?: Order | null;
  leads: Lead[];
  users: User[];
  quotes: Quote[]; 
  currentUser: User | null;
  onSave: (order: Order) => Promise<void>;
  isOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
}

const defaultOrderBase: Omit<Order, 'id' | 'createdAt' | 'orderNumber' | 'placedByUserId' | 'subtotal' | 'taxAmount' | 'total' | 'items'> = {
  leadId: "",
  quoteId: undefined,
  status: "Pendiente",
  shippingAddress: "",
  billingAddress: "",
  discount: 0,
};

function generateOrderNumber(): string {
  const year = new Date().getFullYear();
  const randomNumber = Math.floor(10000 + Math.random() * 90000);
  return `PED-${year}-${randomNumber}`;
}

const NO_QUOTE_SELECTED_VALUE = "__no_quote_selected__";

export function AddEditOrderDialog({
  trigger,
  orderToEdit,
  leads,
  users,
  quotes,
  currentUser,
  onSave,
  isOpen: controlledIsOpen,
  onOpenChange: controlledOnOpenChange,
}: AddEditOrderDialogProps) {
  const [internalIsOpen, setInternalIsOpen] = useState(false);
  const isOpen = controlledIsOpen !== undefined ? controlledIsOpen : internalIsOpen;
  const setIsOpen = controlledOnOpenChange !== undefined ? controlledOnOpenChange : setInternalIsOpen;

  const { toast } = useToast();
  const dialogId = useId();

  const [formData, setFormData] = useState<Partial<Omit<Order, 'id' | 'createdAt' | 'placedByUserId'>>>(defaultOrderBase);
  const [items, setItems] = useState<OrderItem[]>([]);

  useEffect(() => {
    if (isOpen) {
      if (orderToEdit) {
        setFormData({
          leadId: orderToEdit.leadId,
          orderNumber: orderToEdit.orderNumber,
          quoteId: orderToEdit.quoteId,
          status: orderToEdit.status,
          shippingAddress: orderToEdit.shippingAddress,
          billingAddress: orderToEdit.billingAddress,
          discount: orderToEdit.discount,
          updatedAt: orderToEdit.updatedAt,
        });
        setItems(orderToEdit.items);
      } else {
        setFormData({...defaultOrderBase, orderNumber: generateOrderNumber()});
        setItems([{ id: `item-${Date.now()}`, description: "", quantity: 1, unitPrice: 0, total: 0 }]);
      }
    }
  }, [orderToEdit, isOpen]);

  const calculateTotals = (currentItems: OrderItem[], discount = 0) => {
    const subtotal = currentItems.reduce((sum, item) => sum + (item.quantity * item.unitPrice), 0);
    const discountAmount = subtotal * (discount / 100);
    const total = subtotal - discountAmount; 
    return { subtotal, discountAmount, total, taxAmount: 0 }; 
  };

  const handleItemChange = (index: number, field: keyof OrderItem, value: string | number) => {
    const newItems = [...items];
    const item = newItems[index];
    (item[field] as any) = field === 'description' ? value : Number(value) || 0;
    item.total = item.quantity * item.unitPrice;
    setItems(newItems);
  };

  const addItem = () => {
    setItems([...items, { id: `item-${Date.now()}`, description: "", quantity: 1, unitPrice: 0, total: 0 }]);
  };

  const removeItem = (index: number) => {
    setItems(items.filter((_, i) => i !== index));
  };
  
  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: name === 'discount' ? parseFloat(value) : value }));
  };
  
  const handleSelectChange = (name: 'leadId' | 'status' | 'quoteId', value: string) => {
     if (name === 'quoteId') {
        const selectedQuote = quotes.find(q => q.id === value);
        if (selectedQuote) {
            setFormData(prev => ({
                ...prev,
                quoteId: value,
                leadId: selectedQuote.leadId,
                discount: selectedQuote.discount || 0,
            }));
            setItems(selectedQuote.items.map(qi => ({ ...qi, id: `item-${Date.now()}-${Math.random()}` })));
        } else {
             setFormData(prev => ({ ...prev, quoteId: undefined, leadId: prev.leadId })); // Keep leadId if quote removed
        }
     } else {
        setFormData((prev) => ({ ...prev, [name]: value as OrderStatus }));
     }
  };

  const handleSubmit = async () => {
    if (!formData.leadId || !currentUser?.id) {
      toast({ title: "Error de Validación", description: "El lead y el solicitante son obligatorios.", variant: "destructive" });
      return;
    }
     if (items.some(item => !item.description || item.quantity <= 0 || item.unitPrice < 0)) {
      toast({ title: "Error en Items", description: "Todos los items deben tener descripción, cantidad positiva y precio.", variant: "destructive" });
      return;
    }

    const { subtotal, taxAmount, total } = calculateTotals(items, formData.discount);

    const orderDataToSave: Order = {
      id: orderToEdit ? orderToEdit.id : `order-${Date.now()}`,
      orderNumber: formData.orderNumber!,
      leadId: formData.leadId!,
      quoteId: formData.quoteId === NO_QUOTE_SELECTED_VALUE ? undefined : formData.quoteId,
      createdAt: orderToEdit ? orderToEdit.createdAt : new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      placedByUserId: orderToEdit ? orderToEdit.placedByUserId : currentUser!.id,
      status: formData.status || "Pendiente",
      items,
      subtotal,
      discount: formData.discount || 0,
      taxAmount, 
      total,
      shippingAddress: formData.shippingAddress || "",
      billingAddress: formData.billingAddress || "",
    };
    
    await onSave(orderDataToSave);
  };

  const { subtotal, discountAmount, total } = calculateTotals(items, formData.discount);

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>{orderToEdit ? "Editar Pedido" : "Nuevo Pedido"} No. {formData.orderNumber}</DialogTitle>
          <DialogDescription>
            {orderToEdit ? "Actualiza los detalles de este pedido." : "Completa la información para el nuevo pedido."}
          </DialogDescription>
        </DialogHeader>

        <div className="flex-grow overflow-y-auto pr-2 space-y-4 py-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                 <div>
                    <Label htmlFor={`${dialogId}-quoteId`}>Cotización Asociada (Opcional)</Label>
                    <Select name="quoteId" value={formData.quoteId || NO_QUOTE_SELECTED_VALUE} onValueChange={(value) => handleSelectChange('quoteId', value)}>
                        <SelectTrigger id={`${dialogId}-quoteId`}>
                            <SelectValue placeholder="Selecciona una cotización" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value={NO_QUOTE_SELECTED_VALUE}>Ninguna</SelectItem>
                            {quotes.filter(q => q.status === 'Aceptada' || q.status === 'Enviada').map((quote) => ( // Filter for relevant quotes
                                <SelectItem key={quote.id} value={quote.id}>
                                    #{quote.quoteNumber} ({leads.find(l => l.id === quote.leadId)?.name}) - Total: ${quote.total.toFixed(2)}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>
                <div>
                    <Label htmlFor={`${dialogId}-leadId`}>Lead Asociado</Label>
                    <Select name="leadId" value={formData.leadId || ""} onValueChange={(value) => handleSelectChange('leadId', value)} disabled={!!formData.quoteId && formData.quoteId !== NO_QUOTE_SELECTED_VALUE}>
                        <SelectTrigger id={`${dialogId}-leadId`}>
                        <SelectValue placeholder="Selecciona un lead" />
                        </SelectTrigger>
                        <SelectContent>
                        {leads.map((lead) => (
                            <SelectItem key={lead.id} value={lead.id}>{lead.name} ({lead.company || 'N/A'})</SelectItem>
                        ))}
                        </SelectContent>
                    </Select>
                     {!!formData.quoteId && formData.quoteId !== NO_QUOTE_SELECTED_VALUE && <p className="text-xs text-muted-foreground mt-1">Lead seleccionado desde cotización.</p>}
                </div>
            </div>
            <div>
                <Label htmlFor={`${dialogId}-status`}>Estado</Label>
                <Select name="status" value={formData.status || "Pendiente"} onValueChange={(value) => handleSelectChange('status', value)}>
                    <SelectTrigger id={`${dialogId}-status`}>
                    <SelectValue placeholder="Selecciona un estado" />
                    </SelectTrigger>
                    <SelectContent>
                    {ORDER_STATUSES.map(status => (
                        <SelectItem key={status} value={status}>{status}</SelectItem>
                    ))}
                    </SelectContent>
                </Select>
            </div>

            <div>
                <Label>Items del Pedido</Label>
                <div className="space-y-2 mt-1">
                {items.map((item, index) => (
                    <div key={item.id} className="grid grid-cols-[1fr_80px_100px_100px_auto] gap-2 items-center p-2 border rounded-md">
                    <Input placeholder="Descripción del item" value={item.description} onChange={(e) => handleItemChange(index, 'description', e.target.value)} className="text-xs"/>
                    <Input type="number" placeholder="Cant." value={item.quantity} onChange={(e) => handleItemChange(index, 'quantity', e.target.value)} className="text-xs" min="1"/>
                    <Input type="number" placeholder="Precio Unit." value={item.unitPrice} onChange={(e) => handleItemChange(index, 'unitPrice', e.target.value)} className="text-xs" min="0" step="0.01"/>
                    <span className="text-xs text-right pr-2">${(item.quantity * item.unitPrice).toFixed(2)}</span>
                    <Button variant="ghost" size="icon" onClick={() => removeItem(index)} className="h-7 w-7">
                        <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                    </div>
                ))}
                </div>
                <Button type="button" variant="outline" size="sm" onClick={addItem} className="mt-2">
                <PlusCircle className="mr-2 h-4 w-4" /> Añadir Item
                </Button>
            </div>
            
            <div>
                <Label htmlFor={`${dialogId}-discount`}>Descuento (%)</Label>
                <Input id={`${dialogId}-discount`} name="discount" type="number" value={formData.discount || 0} onChange={handleChange} min="0" max="100" />
            </div>

            <div>
                <Label htmlFor={`${dialogId}-shippingAddress`}>Dirección de Envío</Label>
                <Textarea id={`${dialogId}-shippingAddress`} name="shippingAddress" value={formData.shippingAddress || ""} onChange={handleChange} rows={2} />
            </div>
            <div>
                <Label htmlFor={`${dialogId}-billingAddress`}>Dirección de Facturación</Label>
                <Textarea id={`${dialogId}-billingAddress`} name="billingAddress" value={formData.billingAddress || ""} onChange={handleChange} rows={2} />
            </div>

            <div className="mt-4 p-3 border rounded-md bg-muted/50">
                <h4 className="text-sm font-semibold mb-2">Resumen de Totales</h4>
                <div className="space-y-1 text-sm">
                    <div className="flex justify-between"><span>Subtotal:</span> <span>${subtotal.toFixed(2)}</span></div>
                    {formData.discount && formData.discount > 0 && <div className="flex justify-between text-red-600"><span>Descuento ({formData.discount}%):</span> <span>-${discountAmount.toFixed(2)}</span></div>}
                    {/* Tax display simplified for orders */}
                    <div className="flex justify-between font-bold text-lg border-t pt-1 mt-1"><span>Total:</span> <span>${total.toFixed(2)}</span></div>
                </div>
            </div>
        </div>

        <DialogFooter className="pt-4 border-t">
          <Button type="button" variant="outline" onClick={() => setIsOpen(false)}>Cancelar</Button>
          <Button type="submit" onClick={handleSubmit}>
            {orderToEdit ? "Guardar Cambios" : "Crear Pedido"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
