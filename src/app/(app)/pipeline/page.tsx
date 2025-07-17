
"use client";

import { useState, useEffect, useCallback } from "react";
import type { Lead, PipelineStage } from "@/lib/types";
import { INITIAL_PIPELINE_STAGES, NAV_ITEMS } from "@/lib/constants";
import { PipelineStageColumn } from "@/components/pipeline/pipeline-stage-column";
import { AddEditLeadDialog } from "@/components/pipeline/add-edit-lead-dialog";
import { Button } from "@/components/ui/button";
import { PlusCircle } from "lucide-react";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { db } from "@/lib/firebase";
import { collection, getDocs, doc, setDoc, query, orderBy, Timestamp, where } from "firebase/firestore";
import { useToast } from "@/hooks/use-toast";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/contexts/auth-context";
import { logSystemEvent } from "@/lib/auditLogger";
import { useSearchParams, useRouter } from "next/navigation";
import { isValid, parseISO } from "date-fns";

const parseDateField = (fieldValue: any): string | undefined => {
    if (!fieldValue) return undefined;
    if (fieldValue instanceof Timestamp) {
        return fieldValue.toDate().toISOString();
    }
    if (typeof fieldValue === 'string') {
        const parsedDate = parseISO(fieldValue);
        if (isValid(parsedDate)) {
            return parsedDate.toISOString();
        }
    }
    if (fieldValue && typeof fieldValue === 'object' && fieldValue.hasOwnProperty('_methodName') && fieldValue._methodName === 'serverTimestamp') {
        return new Date().toISOString(); 
    }
    console.warn("Formato de fecha inesperado en parseDateField para Pipeline:", fieldValue);
    if (typeof fieldValue === 'string') {
        const parsed = new Date(fieldValue);
        if (isValid(parsed)) return parsed.toISOString();
    }
    return undefined;
};

export default function PipelinePage() {
  const [stages, setStages] = useState<PipelineStage[]>([]);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [editingLead, setEditingLead] = useState<Lead | null>(null);
  const [isLoadingLeads, setIsLoadingLeads] = useState(true);
  const [isSubmittingLead, setIsSubmittingLead] = useState(false);
  const [isLeadDialogOpen, setIsLeadDialogOpen] = useState(false);

  const pipelineNavItem = NAV_ITEMS.find(item => item.href === '/pipeline');
  const { toast } = useToast();
  const { currentUser } = useAuth();
  const searchParams = useSearchParams();
  const router = useRouter();
  

  const fetchLeads = useCallback(async () => {
    if (!currentUser || !currentUser.tenantId) { 
        setIsLoadingLeads(false);
        if (currentUser) {
            toast({ title: "Error de Tenant", description: "No se pudo identificar tu organización para cargar los leads.", variant: "destructive" });
        }
        return []; 
    }

    setIsLoadingLeads(true);
    console.log(`PipelinePage fetchLeads: Cargando leads para el tenant: ${currentUser.tenantId}.`);

    try {
      const leadsCollectionRef = collection(db, "leads");
      const q = query(leadsCollectionRef, where("tenantId", "==", currentUser.tenantId), orderBy("createdAt", "desc"));
      
      const querySnapshot = await getDocs(q);
      const fetchedLeads = querySnapshot.docs.map(docSnap => {
        const data = docSnap.data();
        return {
          id: docSnap.id,
          ...data,
          createdAt: parseDateField(data.createdAt) || new Date().toISOString(),
          expectedCloseDate: parseDateField(data.expectedCloseDate),
        } as Lead;
      });
      setLeads(fetchedLeads);
      return fetchedLeads;
    } catch (error) {
      console.error("Error al obtener leads:", error);
      toast({
        title: "Error al Cargar Leads",
        description: "No se pudieron cargar los leads del embudo.",
        variant: "destructive",
      });
      return [];
    } finally {
      setIsLoadingLeads(false);
    }
  }, [currentUser, toast]);

  useEffect(() => {
    setStages(INITIAL_PIPELINE_STAGES.sort((a, b) => a.order - b.order));
    if (currentUser !== undefined) { 
        fetchLeads().then(fetchedLeads => {
          if (!fetchedLeads) return; 
          const leadIdFromQuery = searchParams.get('leadId');
          if (leadIdFromQuery && fetchedLeads) {
            const leadToOpen = fetchedLeads.find(l => l.id === leadIdFromQuery);
            if (leadToOpen) {
              setEditingLead(leadToOpen);
              setIsLeadDialogOpen(true);
            }
          }
        });
    }
  }, [fetchLeads, searchParams, router, currentUser]); 

  const handleSaveLead = async (leadData: Lead) => {
    if (!currentUser || !currentUser.tenantId) {
      toast({ title: "Error", description: "Usuario no autenticado o sin tenant asignado.", variant: "destructive" });
      return;
    }

    setIsSubmittingLead(true);
    const isEditing = !!leadData.id && leads.some(l => l.id === leadData.id);
    const leadId = leadData.id || doc(collection(db, "leads")).id;

    try {
        const leadDocRef = doc(db, "leads", leadId);
        
        const finalLeadData = {
            ...leadData,
            id: leadId,
            createdAt: leadData.createdAt ? (typeof leadData.createdAt === 'string' ? leadData.createdAt : (leadData.createdAt as unknown as Timestamp).toDate().toISOString()) : new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            expectedCloseDate: leadData.expectedCloseDate ? (typeof leadData.expectedCloseDate === 'string' ? leadData.expectedCloseDate : (leadData.expectedCloseDate as unknown as Timestamp).toDate().toISOString()) : undefined,
            tenantId: currentUser.tenantId, // Ensure tenantId is set
        };
        
        const dataToSaveForFirestore = {
          ...finalLeadData,
          createdAt: Timestamp.fromDate(new Date(finalLeadData.createdAt)),
          updatedAt: Timestamp.fromDate(new Date(finalLeadData.updatedAt!)),
          expectedCloseDate: finalLeadData.expectedCloseDate ? Timestamp.fromDate(new Date(finalLeadData.expectedCloseDate)) : null,
        };
        
        await setDoc(leadDocRef, dataToSaveForFirestore, { merge: true });

        fetchLeads();
        toast({
          title: isEditing ? "Lead Actualizado" : "Lead Creado",
          description: `El lead "${leadData.name}" ha sido guardado exitosamente.`,
        });

        const actionType = isEditing ? 'update' : 'create';
        const actionDetails = isEditing ?
          `Lead "${leadData.name}" actualizado.` :
          `Lead "${leadData.name}" creado.`;
        if (currentUser) { 
          await logSystemEvent(currentUser, actionType, 'Lead', leadId, actionDetails);
        }
        
        setEditingLead(null);
        setIsLeadDialogOpen(false);
    } catch (error) {
        console.error("Error al guardar lead:", error);
        toast({
          title: "Error al Guardar Lead",
          description: "Ocurrió un error al guardar el lead.",
          variant: "destructive",
        });
    } finally {
        setIsSubmittingLead(false);
    }
  };

  const handleEditLead = (lead: Lead) => {
    setEditingLead(lead);
    setIsLeadDialogOpen(true);
  };
  
  const openNewLeadDialog = () => {
    setEditingLead(null);
    setIsLeadDialogOpen(true);
  };

  return (
    <div className="flex flex-col h-[calc(100vh-var(--header-height,4rem)-2rem)]">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-semibold">{pipelineNavItem ? pipelineNavItem.label : "Embudo de Ventas"}</h2>
        <Button onClick={openNewLeadDialog} disabled={isSubmittingLead || currentUser === undefined}>
          <PlusCircle className="mr-2 h-5 w-5" /> Añadir Lead
        </Button>
      </div>
      
      {isLoadingLeads && currentUser !== undefined ? (
         <div className="flex flex-grow items-center justify-center">
           <div className="space-y-2 text-center">
            <Skeleton className="h-8 w-64 mx-auto" />
            <Skeleton className="h-64 w-full" />
            <Skeleton className="h-4 w-48 mx-auto" />
            <p className="text-sm text-muted-foreground">Cargando leads...</p>
           </div>
         </div>
      ) : (currentUser === undefined) ? (
        <div className="flex flex-grow items-center justify-center">
            <p className="text-sm text-muted-foreground">Inicializando y esperando datos de usuario...</p>
        </div>
      ) : leads.length === 0 ? (
         <div className="flex flex-grow items-center justify-center">
            <p className="text-lg text-muted-foreground">No hay leads en este embudo.</p>
        </div>
      ) : (
        <ScrollArea className="flex-grow pb-4">
          <div className="flex gap-4 h-full">
            {stages.map((stage) => (
              <PipelineStageColumn
                key={stage.id}
                stage={stage}
                leads={leads.filter((lead) => lead.stageId === stage.id)}
                onEditLead={handleEditLead}
              />
            ))}
          </div>
          <ScrollBar orientation="horizontal" />
        </ScrollArea>
      )}
      <AddEditLeadDialog
          isOpen={isLeadDialogOpen}
          onOpenChange={setIsLeadDialogOpen}
          stages={stages}
          leadToEdit={editingLead}
          onSave={handleSaveLead}
          isSubmitting={isSubmittingLead}
          trigger={<span style={{ display: 'none' }} />}
        />
    </div>
  );
}
