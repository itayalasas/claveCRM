"use client";

import { useState, useEffect, useId } from "react";
import type { Quote, Lead, User, QuoteStatus, QuoteItem } from "@/lib/types";
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
import { QUOTE_STATUSES } from "@/lib/constants";
import { useToast } from "@/hooks/use-toast";

interface AddEditQuoteDialogProps {
  trigger: React.ReactNode;
  quoteToEdit?: Quote | null;
  leads: Lead[];
  users: User[];
  currentUser: User | null;
  onSave: (quote: Quote) => Promise<void>;
  isOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
}

const defaultQuoteBase: Omit<Quote, 'id' | 'createdAt' | 'quoteNumber' | 'preparedByUserId' | 'subtotal' | 'taxAmount' | 'total' | 'items'> = {
  leadId: "",
  status: "Borrador",
  notes: "",
  validUntil: undefined,
  discount: 0,
  taxRate: 0.21, // Default 21%
};

function generateQuoteNumber(): string {
  const year = new Date().getFullYear();
  const randomNumber = Math.floor(1000 + Math.random() * 9000);
  return `COT-${year}-${randomNumber}`;
}

export function AddEditQuoteDialog({
  trigger,
  quoteToEdit,
  leads,
  users,
  currentUser,
  onSave,
  isOpen: controlledIsOpen,
  onOpenChange: controlledOnOpenChange,
}: AddEditQuoteDialogProps) {
  const [internalIsOpen, setInternalIsOpen] = useState(false);
  const isOpen = controlledIsOpen !== undefined ? controlledIsOpen : internalIsOpen;
  const setIsOpen = controlledOnOpenChange !== undefined ? controlledOnOpenChange : setInternalIsOpen;
  
  const { toast } = useToast();
  const dialogId = useId();

  const [formData, setFormData] = useState<Partial<Omit<Quote, 'id' | 'createdAt' | 'preparedByUserId'>>>(defaultQuoteBase);
  const [items, setItems] = useState<QuoteItem[]>([]);
  const [validUntilDate, setValidUntilDate] = useState<Date | undefined>(undefined);

  useEffect(() => {
    if (isOpen) {
      if (quoteToEdit) {
        setFormData({
          leadId: quoteToEdit.leadId,
          quoteNumber: quoteToEdit.quoteNumber,
          status: quoteToEdit.status,
          notes: quoteToEdit.notes,
          validUntil: quoteToEdit.validUntil,
          discount: quoteToEdit.discount,
          taxRate: quoteToEdit.taxRate,
          updatedAt: quoteToEdit.updatedAt,
        });
        setItems(quoteToEdit.items);
        setValidUntilDate(quoteToEdit.validUntil && isValid(parseISO(quoteToEdit.validUntil)) ? parseISO(quoteToEdit.validUntil) : undefined);
      } else {
        setFormData({...defaultQuoteBase, quoteNumber: generateQuoteNumber()});
        setItems([{ id: `item-${Date.now()}`, description: "", quantity: 1, unitPrice: 0, total: 0 }]);
        setValidUntilDate(undefined);
      }
    }
  }, [quoteToEdit, isOpen]);

  const calculateTotals = (currentItems: QuoteItem[], discount = 0, taxRate = 0.21) => {
    const subtotal = currentItems.reduce((sum, item) => sum + (item.quantity * item.unitPrice), 0);
    const discountAmount = subtotal * (discount / 100); // Assuming discount is a percentage
    const taxableAmount = subtotal - discountAmount;
    const taxAmount = taxableAmount * taxRate;
    const total = taxableAmount + taxAmount;
    return { subtotal, discountAmount, taxAmount, total };
  };

  const handleItemChange = (index: number, field: keyof QuoteItem, value: string | number) => {
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
  
  const handleSelectChange = (name: 'leadId' | 'status', value: string) => {
    setFormData((prev) => ({ ...prev, [name]: value as QuoteStatus }));
  };

  const handleDateChange = (date: Date | undefined) => {
    setValidUntilDate(date);
    setFormData((prev) => ({ ...prev, validUntil: date ? date.toISOString() : undefined }));
  };

  const handleSubmit = async () => {
    if (!formData.leadId || !currentUser?.id) {
      toast({ title: "Error de Validación", description: "El lead y el preparador son obligatorios.", variant: "destructive" });
      return;
    }
    if (items.some(item => !item.description || item.quantity <= 0 || item.unitPrice < 0)) {
      toast({ title: "Error en Items", description: "Todos los items deben tener descripción, cantidad positiva y precio.", variant: "destructive" });
      return;
    }

    const { subtotal, taxAmount, total } = calculateTotals(items, formData.discount, formData.taxRate);

    const quoteDataToSave: Quote = {
      id: quoteToEdit ? quoteToEdit.id : `quote-${Date.now()}`,
      quoteNumber: formData.quoteNumber!,
      leadId: formData.leadId!,
      createdAt: quoteToEdit ? quoteToEdit.createdAt : new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      preparedByUserId: quoteToEdit ? quoteToEdit.preparedByUserId : currentUser!.id,
      status: formData.status || "Borrador",
      items: items,
      subtotal,
      discount: formData.discount || 0,
      taxRate: formData.taxRate || 0.21,
      taxAmount,
      total,
      notes: formData.notes || "",
      validUntil: formData.validUntil,
    };
    
    await onSave(quoteDataToSave);
    // setIsOpen(false); // Parent handles closing
  };

  const { subtotal, discountAmount, taxAmount, total } = calculateTotals(items, formData.discount, formData.taxRate);

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>{quoteToEdit ? "Editar Cotización" : "Nueva Cotización"} No. {formData.quoteNumber}</DialogTitle>
          <DialogDescription>
            {quoteToEdit ? "Actualiza los detalles de esta cotización." : "Completa la información para la nueva cotización."}
          </DialogDescription>
        </DialogHeader>
        
        <div className="flex-grow overflow-y-auto pr-2 space-y-4 py-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor={`${dialogId}-leadId`}>Lead Asociado</Label>
              <Select name="leadId" value={formData.leadId || ""} onValueChange={(value) => handleSelectChange('leadId', value)}>
                <SelectTrigger id={`${dialogId}-leadId`}>
                  <SelectValue placeholder="Selecciona un lead" />
                </SelectTrigger>
                <SelectContent>
                  {leads.map((lead) => (
                    <SelectItem key={lead.id} value={lead.id}>{lead.name} ({lead.company || 'N/A'})</SelectItem>
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
                  {QUOTE_STATUSES.map(status => (
                    <SelectItem key={status} value={status}>{status}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div>
            <Label>Items de la Cotización</Label>
            <div className="space-y-2 mt-1">
              {items.map((item, index) => (
                <div key={item.id} className="grid grid-cols-[1fr_80px_100px_100px_auto] gap-2 items-center p-2 border rounded-md">
                  <Input 
                    placeholder="Descripción del item" 
                    value={item.description} 
                    onChange={(e) => handleItemChange(index, 'description', e.target.value)}
                    className="text-xs"
                  />
                  <Input 
                    type="number" 
                    placeholder="Cant." 
                    value={item.quantity} 
                    onChange={(e) => handleItemChange(index, 'quantity', e.target.value)}
                    className="text-xs" min="1"
                  />
                  <Input 
                    type="number" 
                    placeholder="Precio Unit." 
                    value={item.unitPrice} 
                    onChange={(e) => handleItemChange(index, 'unitPrice', e.target.value)}
                    className="text-xs" min="0" step="0.01"
                  />
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
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
             <div>
              <Label htmlFor={`${dialogId}-discount`}>Descuento (%)</Label>
              <Input id={`${dialogId}-discount`} name="discount" type="number" value={formData.discount || 0} onChange={handleChange} min="0" max="100" />
            </div>
            <div>
              <Label htmlFor={`${dialogId}-taxRate`}>Tasa de Impuesto (%)</Label>
              <Input id={`${dialogId}-taxRate`} name="taxRate" type="number" value={(formData.taxRate || 0) * 100} onChange={e => setFormData(prev => ({...prev, taxRate: parseFloat(e.target.value)/100}))} min="0" max="100" />
            </div>
            <div>
                <Label htmlFor={`${dialogId}-validUntil`}>Válida Hasta</Label>
                <Popover>
                <PopoverTrigger asChild>
                    <Button
                    variant={"outline"}
                    className={cn(
                        "w-full justify-start text-left font-normal",
                        !validUntilDate && "text-muted-foreground"
                    )}
                    >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {validUntilDate ? format(validUntilDate, "PPP", { locale: es }) : <span>Elige una fecha</span>}
                    </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                    <Calendar locale={es} mode="single" selected={validUntilDate} onSelect={handleDateChange} initialFocus />
                </PopoverContent>
                </Popover>
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
            {quoteToEdit ? "Guardar Cambios" : "Crear Cotización"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}