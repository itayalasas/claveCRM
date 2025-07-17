"use client";

import { useState, useEffect, useId } from "react";
import type { Lead, PipelineStage } from "@/lib/types";
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
import { CalendarIcon, Loader2 } from "lucide-react";
import { format, parseISO, isValid } from "date-fns";
import { es } from 'date-fns/locale';
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { doc, collection } from "firebase/firestore"; // For generating ID
import { db } from "@/lib/firebase"; // Import db

interface AddEditLeadDialogProps {
  trigger: React.ReactNode;
  stages: PipelineStage[];
  leadToEdit?: Lead | Partial<Lead> | null; // Allow Partial<Lead> for initialData
  onSave: (lead: Lead) => Promise<void>; 
  isSubmitting?: boolean;
  isOpen?: boolean; // For controlled dialog
  onOpenChange?: (open: boolean) => void; // For controlled dialog
}

const defaultLeadBase: Omit<Lead, 'id' | 'createdAt'> = {
  name: "",
  email: "",
  phone: "",
  company: "",
  stageId: "",
  details: "",
  value: 0,
  score: 0,
  probability: 0,
  expectedCloseDate: undefined,
};

export function AddEditLeadDialog({ 
    trigger, 
    stages, 
    leadToEdit, 
    onSave, 
    isSubmitting = false,
    isOpen: controlledIsOpen,
    onOpenChange: controlledOnOpenChange,
}: AddEditLeadDialogProps) {
  const [internalIsOpen, setInternalIsOpen] = useState(false);
  const isOpen = controlledIsOpen !== undefined ? controlledIsOpen : internalIsOpen;
  const setIsOpen = controlledOnOpenChange || setInternalIsOpen;

  const [formData, setFormData] = useState<Omit<Lead, 'id' | 'createdAt'>>(defaultLeadBase);
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(undefined);
  const { toast } = useToast();
  const dialogIdPrefix = useId();

  useEffect(() => {
    if (isOpen) {
      if (leadToEdit && 'id' in leadToEdit && leadToEdit.id) { // Editing existing lead
        const initialData = {
          name: leadToEdit.name || "",
          email: leadToEdit.email || "",
          phone: leadToEdit.phone || "",
          company: leadToEdit.company || "",
          stageId: leadToEdit.stageId || (stages.length > 0 ? stages[0].id : ""),
          details: leadToEdit.details || "",
          value: leadToEdit.value || 0,
          score: leadToEdit.score || 0,
          probability: leadToEdit.probability || 0,
          expectedCloseDate: leadToEdit.expectedCloseDate,
        };
        setFormData(initialData);
        setSelectedDate(leadToEdit.expectedCloseDate && isValid(parseISO(leadToEdit.expectedCloseDate)) ? parseISO(leadToEdit.expectedCloseDate) : undefined);
      } else if (leadToEdit) { // Creating new lead with initial data (e.g., from chat)
        setFormData({
            ...defaultLeadBase,
            ...leadToEdit, // Spread initial data
            stageId: leadToEdit.stageId || (stages.length > 0 ? stages[0].id : ""),
        });
        setSelectedDate(leadToEdit.expectedCloseDate && isValid(parseISO(leadToEdit.expectedCloseDate)) ? parseISO(leadToEdit.expectedCloseDate) : undefined);
      } else { // Creating brand new lead
        setFormData(prev => ({...defaultLeadBase, stageId: stages[0]?.id || ""}));
        setSelectedDate(undefined);
      }
    }
  }, [leadToEdit, isOpen, stages]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ 
      ...prev, 
      [name]: (name === 'value' || name === 'score' || name === 'probability') ? parseFloat(value) || 0 : value 
    }));
  };

  const handleStageChange = (value: string) => {
    setFormData((prev) => ({ ...prev, stageId: value }));
  };

  const handleDateChange = (date: Date | undefined) => {
    setSelectedDate(date);
    setFormData((prev) => ({ ...prev, expectedCloseDate: date ? date.toISOString() : undefined }));
  };

  const handleSubmit = async () => {
    if (!formData.name || !formData.stageId) {
      toast({ title: "Error de Validación", description: "El nombre y la etapa son obligatorios.", variant: "destructive"});
      return;
    }
    
    // Ensure id and createdAt are correctly handled for new vs edit
    const isEditing = leadToEdit && 'id' in leadToEdit && leadToEdit.id;
    const leadId = isEditing ? leadToEdit.id : doc(collection(db, "leads")).id;
    const createdAt = isEditing && leadToEdit.createdAt ? leadToEdit.createdAt : new Date().toISOString();

    const newLead: Lead = {
      ...formData,
      id: leadId!, 
      createdAt: createdAt!,
    };
    await onSave(newLead);
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => { if (!isSubmitting) setIsOpen(open)}}>
      <DialogTrigger asChild onClick={() => !isOpen && setIsOpen(true)}>{trigger}</DialogTrigger>
      <DialogContent className="sm:max-w-[520px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{leadToEdit && 'id' in leadToEdit && leadToEdit.id ? "Editar Lead" : "Añadir Nuevo Lead"}</DialogTitle>
          <DialogDescription>
            {leadToEdit && 'id' in leadToEdit && leadToEdit.id ? "Actualiza los detalles de este lead." : "Completa la información para el nuevo lead."}
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor={`${dialogIdPrefix}-name`} className="text-right">
              Nombre
            </Label>
            <Input id={`${dialogIdPrefix}-name`} name="name" value={formData.name} onChange={handleChange} className="col-span-3" disabled={isSubmitting}/>
          </div>
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor={`${dialogIdPrefix}-email`} className="text-right">
              Correo
            </Label>
            <Input id={`${dialogIdPrefix}-email`} name="email" type="email" value={formData.email} onChange={handleChange} className="col-span-3" disabled={isSubmitting}/>
          </div>
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor={`${dialogIdPrefix}-phone`} className="text-right">
              Teléfono
            </Label>
            <Input id={`${dialogIdPrefix}-phone`} name="phone" value={formData.phone} onChange={handleChange} className="col-span-3" disabled={isSubmitting}/>
          </div>
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor={`${dialogIdPrefix}-company`} className="text-right">
              Empresa
            </Label>
            <Input id={`${dialogIdPrefix}-company`} name="company" value={formData.company} onChange={handleChange} className="col-span-3" disabled={isSubmitting}/>
          </div>
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor={`${dialogIdPrefix}-value`} className="text-right">
              Valor ($)
            </Label>
            <Input id={`${dialogIdPrefix}-value`} name="value" type="number" value={formData.value} onChange={handleChange} className="col-span-3" disabled={isSubmitting}/>
          </div>
           <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor={`${dialogIdPrefix}-score`} className="text-right">
              Puntuación
            </Label>
            <Input id={`${dialogIdPrefix}-score`} name="score" type="number" min="0" max="100" value={formData.score} onChange={handleChange} className="col-span-3" placeholder="0-100" disabled={isSubmitting}/>
          </div>
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor={`${dialogIdPrefix}-probability`} className="text-right">
              Probabilidad (%)
            </Label>
            <Input id={`${dialogIdPrefix}-probability`} name="probability" type="number" min="0" max="100" value={formData.probability} onChange={handleChange} className="col-span-3" placeholder="0-100" disabled={isSubmitting}/>
          </div>
           <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor={`${dialogIdPrefix}-expectedCloseDate`} className="text-right">Fecha Cierre</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant={"outline"}
                  className={cn(
                    "col-span-3 justify-start text-left font-normal",
                    !selectedDate && "text-muted-foreground"
                  )}
                  disabled={isSubmitting}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {selectedDate ? format(selectedDate, "PPP", { locale: es }) : <span>Elige una fecha</span>}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  locale={es}
                  mode="single"
                  selected={selectedDate}
                  onSelect={handleDateChange}
                  initialFocus
                />
              </PopoverContent>
            </Popover>
          </div>
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor={`${dialogIdPrefix}-stageId`} className="text-right">
              Etapa
            </Label>
            <Select name="stageId" value={formData.stageId} onValueChange={handleStageChange} disabled={isSubmitting}>
              <SelectTrigger className="col-span-3" id={`${dialogIdPrefix}-stageId`}>
                <SelectValue placeholder="Selecciona una etapa" />
              </SelectTrigger>
              <SelectContent>
                {stages.map((stage) => (
                  <SelectItem key={stage.id} value={stage.id}>
                    {stage.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-4 items-start gap-4">
            <Label htmlFor={`${dialogIdPrefix}-details`} className="text-right pt-2">
              Detalles
            </Label>
            <Textarea id={`${dialogIdPrefix}-details`} name="details" value={formData.details} onChange={handleChange} className="col-span-3" rows={3} disabled={isSubmitting}/>
          </div>
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => setIsOpen(false)} disabled={isSubmitting}>Cancelar</Button>
          <Button type="submit" onClick={handleSubmit} disabled={isSubmitting}>
            {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {isSubmitting ? "Guardando..." : "Guardar Lead"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
