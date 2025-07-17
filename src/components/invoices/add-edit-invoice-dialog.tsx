"use client";

import { useState, useEffect, useId } from "react";
import type { Invoice, Order, Lead, User, InvoiceStatus, InvoiceItem } from "@/lib/types";
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
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { CalendarIcon, PlusCircle, Trash2 } from "lucide-react";
import { format, parseISO, isValid } from "date-fns";
import { es } from 'date-fns/locale';
import { cn } from "@/lib/utils";
import { INVOICE_STATUSES } from "@/lib/constants";
import { useToast } from "@/hooks/use-toast";

interface AddEditInvoiceDialogProps {
  trigger: React.ReactNode;
  invoiceToEdit?: Invoice | null;
  orders: Order[]; 
  leads: Lead[];
  users: User[];
  currentUser: User | null;
  onSave: (invoice: Invoice) => Promise<void>;
  isOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
}

const defaultInvoiceBase: Omit<Invoice, 'id' | 'createdAt' | 'invoiceNumber' | 'issuedByUserId' | 'subtotal' | 'taxAmount' | 'total' | 'items' | 'dueDate'> = {
  orderId: "",
  leadId: "",
  status: "Borrador",
  notes: "",
  paymentMethod: "",
  paymentDate: undefined,
  discount: 0,
  taxRate: 0.21, // Default 21%
};

function generateInvoiceNumber(): string {
  const year = new Date().getFullYear();
  const randomNumber = Math.floor(1000 + Math.random() * 9000);
  return `FAC-${year}-${randomNumber}`;
}

export function AddEditInvoiceDialog({
  trigger,
  invoiceToEdit,
  orders,
  leads,
  users,
  currentUser,
  onSave,
  isOpen: controlledIsOpen,
  onOpenChange: controlledOnOpenChange,
}: AddEditInvoiceDialogProps) {
  const [internalIsOpen, setInternalIsOpen] = useState(false);
  const isOpen = controlledIsOpen !== undefined ? controlledIsOpen : internalIsOpen;
  const setIsOpen = controlledOnOpenChange !== undefined ? controlledOnOpenChange : setInternalIsOpen;

  const { toast } = useToast();
  const dialogId = useId();

  const [formData, setFormData] = useState<Partial<Omit<Invoice, 'id' | 'createdAt' | 'issuedByUserId'>>>(defaultInvoiceBase);
  const [items, setItems] = useState<InvoiceItem[]>([]);
  const [dueDate, setDueDate] = useState<Date | undefined>(undefined);
  const [paymentDate, setPaymentDate] = useState<Date | undefined>(undefined);


  useEffect(() => {
    if (isOpen) {
      if (invoiceToEdit) {
        setFormData({
          invoiceNumber: invoiceToEdit.invoiceNumber,
          orderId: invoiceToEdit.orderId,
          leadId: invoiceToEdit.leadId,
          dueDate: invoiceToEdit.dueDate,
          status: invoiceToEdit.status,
          paymentMethod: invoiceToEdit.paymentMethod,
          paymentDate: invoiceToEdit.paymentDate,
          notes: invoiceToEdit.notes,
          discount: invoiceToEdit.discount,
          taxRate: invoiceToEdit.taxRate,
          updatedAt: invoiceToEdit.updatedAt,
        });
        setItems(invoiceToEdit.items);
        setDueDate(invoiceToEdit.dueDate && isValid(parseISO(invoiceToEdit.dueDate)) ? parseISO(invoiceToEdit.dueDate) : undefined);
        setPaymentDate(invoiceToEdit.paymentDate && isValid(parseISO(invoiceToEdit.paymentDate)) ? parseISO(invoiceToEdit.paymentDate) : undefined);
      } else {
        setFormData({...defaultInvoiceBase, invoiceNumber: generateInvoiceNumber()});
        setItems([{ id: `item-${Date.now()}`, description: "", quantity: 1, unitPrice: 0, total: 0 }]);
        setDueDate(undefined);
        setPaymentDate(undefined);
      }
    }
  }, [invoiceToEdit, isOpen]);

  const calculateTotals = (currentItems: InvoiceItem[], discount = 0, taxRate = 0.21) => {
    const subtotal = currentItems.reduce((sum, item) => sum + (item.quantity * item.unitPrice), 0);
    const discountAmount = subtotal * (discount / 100);
    const taxableAmount = subtotal - discountAmount;
    const taxAmount = taxableAmount * taxRate;
    const total = taxableAmount + taxAmount;
    return { subtotal, discountAmount, taxAmount, total };
  };

  const handleItemChange = (index: number, field: keyof InvoiceItem, value: string | number) => {
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
    setFormData((prev) => ({ ...prev, [name]: (name === 'discount' || name === 'taxRate') ? parseFloat(value) : value }));
  };
  
  const handleSelectChange = (name: 'orderId' | 'leadId' | 'status', value: string) => {
    if (name === 'orderId') {
      const selectedOrder = orders.find(o => o.id === value);
      if (selectedOrder) {
        setFormData(prev => ({
          ...prev,
          orderId: value,
          leadId: selectedOrder.leadId, // Auto-fill leadId from order
          items: selectedOrder.items.map(oi => ({...oi, id: `item-${Date.now()}-${Math.random()}`})), // Copy items
          discount: selectedOrder.discount,
        }));
        setItems(selectedOrder.items.map(oi => ({...oi, id: `item-${Date.now()}-${Math.random()}`})));
      } else {
        setFormData(prev => ({ ...prev, orderId: value, leadId: ""})); // Clear lead if order removed
      }
    } else {
        setFormData((prev) => ({ ...prev, [name]: value as InvoiceStatus }));
    }
  };

  const handleDateChange = (date: Date | undefined, field: 'dueDate' | 'paymentDate') => {
    if (field === 'dueDate') setDueDate(date);
    if (field === 'paymentDate') setPaymentDate(date);
    setFormData((prev) => ({ ...prev, [field]: date ? date.toISOString() : undefined }));
  };

  const handleSubmit = async () => {
    if (!formData.orderId || !formData.leadId || !formData.dueDate || !currentUser?.id) {
      toast({ title: "Error de Validación", description: "Pedido, lead, fecha de vencimiento e emisor son obligatorios.", variant: "destructive" });
      return;
    }
    if (items.some(item => !item.description || item.quantity <= 0 || item.unitPrice < 0)) {
      toast({ title: "Error en Items", description: "Todos los items deben tener descripción, cantidad positiva y precio.", variant: "destructive" });
      return;
    }

    const { subtotal, taxAmount, total } = calculateTotals(items, formData.discount, formData.taxRate);

    const invoiceDataToSave: Invoice = {
      id: invoiceToEdit ? invoiceToEdit.id : `invoice-${Date.now()}`,
      invoiceNumber: formData.invoiceNumber!,
      orderId: formData.orderId!,
      leadId: formData.leadId!,
      createdAt: invoiceToEdit ? invoiceToEdit.createdAt : new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      dueDate: formData.dueDate!,
      issuedByUserId: invoiceToEdit ? invoiceToEdit.issuedByUserId : currentUser!.id,
      status: formData.status || "Borrador",
      items,
      subtotal,
      discount: formData.discount || 0,
      taxRate: formData.taxRate || 0.21,
      taxAmount,
      total,
      paymentMethod: formData.paymentMethod || "",
      paymentDate: formData.paymentDate,
      notes: formData.notes || "",
    };
    
    await onSave(invoiceDataToSave);
  };
  
  const { subtotal, discountAmount, taxAmount, total } = calculateTotals(items, formData.discount, formData.taxRate);

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>{invoiceToEdit ? "Editar Factura" : "Nueva Factura"} No. {formData.invoiceNumber}</DialogTitle>
          <DialogDescription>
            {invoiceToEdit ? "Actualiza los detalles de esta factura." : "Completa la información para la nueva factura."}
          </DialogDescription>
        </DialogHeader>

        <div className="flex-grow overflow-y-auto pr-2 space-y-4 py-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                 <div>
                    <Label htmlFor={`${dialogId}-orderId`}>Pedido Asociado</Label>
                    <Select name="orderId" value={formData.orderId || ""} onValueChange={(value) => handleSelectChange('orderId', value)}>
                        <SelectTrigger id={`${dialogId}-orderId`}>
                        <SelectValue placeholder="Selecciona un pedido" />
                        </SelectTrigger>
                        <SelectContent>
                        {orders.map((order) => (
                            <SelectItem key={order.id} value={order.id}>#{order.orderNumber} ({leads.find(l=>l.id===order.leadId)?.name})</SelectItem>
                        ))}
                        </SelectContent>
                    </Select>
                </div>
                <div>
                    <Label htmlFor={`${dialogId}-status`}>Estado</Label>
                    <Select name="status" value={formData.status || "Borrador"} onValueChange={(value) => handleSelectChange('status', value)}>
                        <SelectTrigger id={`${dialogId}-status`}>
                        <SelectValue placeholder="Selecciona un estado" />
                        </SelectTrigger>
                        <SelectContent>
                        {INVOICE_STATUSES.map(status => (
                            <SelectItem key={status} value={status}>{status}</SelectItem>
                        ))}
                        </SelectContent>
                    </Select>
                </div>
            </div>
             <div>
                <Label htmlFor={`${dialogId}-leadId`}>Lead (auto-seleccionado por pedido)</Label>
                <Input id={`${dialogId}-leadId`} value={leads.find(l => l.id === formData.leadId)?.name || 'Selecciona un pedido'} disabled />
             </div>

            <div>
                <Label>Items de la Factura</Label>
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

             <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                    <Label htmlFor={`${dialogId}-dueDate`}>Fecha de Vencimiento</Label>
                    <Popover>
                        <PopoverTrigger asChild>
                            <Button variant={"outline"} className={cn("w-full justify-start text-left font-normal", !dueDate && "text-muted-foreground")}>
                                <CalendarIcon className="mr-2 h-4 w-4" />
                                {dueDate ? format(dueDate, "PPP", { locale: es }) : <span>Elige una fecha</span>}
                            </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                            <Calendar locale={es} mode="single" selected={dueDate} onSelect={(d) => handleDateChange(d, 'dueDate')} initialFocus />
                        </PopoverContent>
                    </Popover>
                </div>
                 <div>
                    <Label htmlFor={`${dialogId}-paymentDate`}>Fecha de Pago (Opcional)</Label>
                    <Popover>
                        <PopoverTrigger asChild>
                            <Button variant={"outline"} className={cn("w-full justify-start text-left font-normal", !paymentDate && "text-muted-foreground")}>
                                <CalendarIcon className="mr-2 h-4 w-4" />
                                {paymentDate ? format(paymentDate, "PPP", { locale: es }) : <span>Elige una fecha</span>}
                            </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                            <Calendar locale={es} mode="single" selected={paymentDate} onSelect={(d) => handleDateChange(d, 'paymentDate')} />
                        </PopoverContent>
                    </Popover>
                </div>
             </div>
             <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                 <div>
                    <Label htmlFor={`${dialogId}-discount`}>Descuento (%)</Label>
                    <Input id={`${dialogId}-discount`} name="discount" type="number" value={formData.discount || 0} onChange={handleChange} min="0" max="100" />
                </div>
                <div>
                    <Label htmlFor={`${dialogId}-taxRate`}>Tasa de Impuesto (%)</Label>
                    <Input id={`${dialogId}-taxRate`} name="taxRate" type="number" value={(formData.taxRate || 0) * 100} onChange={e => setFormData(prev => ({...prev, taxRate: parseFloat(e.target.value)/100 || 0}))} min="0" max="100" />
                </div>
                 <div>
                    <Label htmlFor={`${dialogId}-paymentMethod`}>Método de Pago</Label>
                    <Input id={`${dialogId}-paymentMethod`} name="paymentMethod" value={formData.paymentMethod || ""} onChange={handleChange} />
                </div>
            </div>

            <div>
                <Label htmlFor={`${dialogId}-notes`}>Notas Adicionales</Label>
                <Textarea id={`${dialogId}-notes`} name="notes" value={formData.notes || ""} onChange={handleChange} rows={2} />
            </div>

            <div className="mt-4 p-3 border rounded-md bg-muted/50">
                <h4 className="text-sm font-semibold mb-2">Resumen de Totales</h4>
                <div className="space-y-1 text-sm">
                    <div className="flex justify-between"><span>Subtotal:</span> <span>${subtotal.toFixed(2)}</span></div>
                    {formData.discount && formData.discount > 0 && <div className="flex justify-between text-red-600"><span>Descuento ({formData.discount}%):</span> <span>-${discountAmount.toFixed(2)}</span></div>}
                    <div className="flex justify-between"><span>Impuestos ({((formData.taxRate || 0) * 100).toFixed(0)}%):</span> <span>${taxAmount.toFixed(2)}</span></div>
                    <div className="flex justify-between font-bold text-lg border-t pt-1 mt-1"><span>Total:</span> <span>${total.toFixed(2)}</span></div>
                </div>
            </div>

        </div>

        <DialogFooter className="pt-4 border-t">
          <Button type="button" variant="outline" onClick={() => setIsOpen(false)}>Cancelar</Button>
          <Button type="submit" onClick={handleSubmit}>
            {invoiceToEdit ? "Guardar Cambios" : "Crear Factura"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}