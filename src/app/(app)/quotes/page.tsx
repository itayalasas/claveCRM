
"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import type { Quote, Lead, User } from "@/lib/types";
import { NAV_ITEMS, QUOTE_STATUSES } from "@/lib/constants"; 
import { AddEditQuoteDialog } from "@/components/quotes/add-edit-quote-dialog";
import { QuoteListItem } from "@/components/quotes/quote-list-item";
import { Button } from "@/components/ui/button";
import { PlusCircle, Search, Filter } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAuth } from "@/contexts/auth-context";
import { useToast } from "@/hooks/use-toast"; 
import { Skeleton } from "@/components/ui/skeleton";
import { db } from "@/lib/firebase";
import { collection, getDocs, doc, setDoc, updateDoc, deleteDoc, query, orderBy, Timestamp } from "firebase/firestore";
import { useRouter } from "next/navigation"; 
import { getAllUsers } from "@/lib/userUtils";

export default function QuotesPage() {
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [leads, setLeads] = useState<Lead[]>([]); 
  const [users, setUsers] = useState<User[]>([]); 

  const [isLoadingQuotes, setIsLoadingQuotes] = useState(true);
  const [isLoadingLeads, setIsLoadingLeads] = useState(true);
  const [isLoadingUsers, setIsLoadingUsers] = useState(true);
  const [isSubmittingQuote, setIsSubmittingQuote] = useState(false);

  const [editingQuote, setEditingQuote] = useState<Quote | null>(null);
  const [isQuoteDialogOpen, setIsQuoteDialogOpen] = useState(false);

  const [searchTerm, setSearchTerm] = useState("");
  const [filterStatus, setFilterStatus] = useState<"Todos" | Quote['status']>("Todos");

  const quotesNavItem = NAV_ITEMS.find(item => item.href === '/quotes');
  const { currentUser, loading: authLoading, hasPermission } = useAuth();
  const { toast } = useToast();
  const router = useRouter();

  useEffect(() => {
    if (!authLoading) {
      if (!currentUser || !hasPermission('ver-cotizaciones')) {
        router.push('/access-denied');
      }
    }
  }, [currentUser, authLoading, hasPermission, router]);

  const fetchQuotes = useCallback(async () => {
    if (!currentUser) {
      setIsLoadingQuotes(false);
      return;
    }
    setIsLoadingQuotes(true);
    try {
      const quotesCollectionRef = collection(db, "quotes");
      const q = query(quotesCollectionRef, orderBy("createdAt", "desc"));
      const querySnapshot = await getDocs(q);
      const fetchedQuotes = querySnapshot.docs.map(docSnap => {
        const data = docSnap.data();
        return {
          id: docSnap.id,
          ...data,
          createdAt: (data.createdAt as Timestamp)?.toDate().toISOString() || new Date().toISOString(),
          updatedAt: (data.updatedAt as Timestamp)?.toDate().toISOString() || undefined,
          validUntil: (data.validUntil as Timestamp)?.toDate().toISOString() || undefined,
        } as Quote;
      });
      setQuotes(fetchedQuotes);
    } catch (error) {
      console.error("Error al obtener cotizaciones:", error);
      toast({
        title: "Error al Cargar Cotizaciones",
        description: "No se pudieron cargar las cotizaciones desde la base de datos.",
        variant: "destructive",
      });
    } finally {
      setIsLoadingQuotes(false);
    }
  }, [currentUser, toast]);

  const fetchLeads = useCallback(async () => {
    setIsLoadingLeads(true);
    try {
      const leadsCollectionRef = collection(db, "leads");
      const querySnapshot = await getDocs(leadsCollectionRef);
      const fetchedLeads = querySnapshot.docs.map(docSnap => ({
        id: docSnap.id,
        ...docSnap.data()
      } as Lead));
      setLeads(fetchedLeads);
    } catch (error) {
      console.error("Error al obtener leads:", error);
      toast({
        title: "Error al Cargar Leads",
        description: "No se pudieron cargar los datos de los leads para las cotizaciones.",
        variant: "destructive",
      });
    } finally {
      setIsLoadingLeads(false);
    }
  }, [toast]);

  const fetchUsers = useCallback(async () => {
    setIsLoadingUsers(true);
    try {
      const fetchedUsers = await getAllUsers(); 
      setUsers(fetchedUsers);
    } catch (error) {
      console.error("Error al obtener usuarios para cotizaciones:", error);
      toast({ title: "Error al Cargar Usuarios", description: "No se pudieron obtener los datos de los usuarios.", variant: "destructive" });
    } finally {
      setIsLoadingUsers(false);
    }
  }, [toast]); 

  useEffect(() => {
    if (!authLoading) {
      if (currentUser && hasPermission('ver-cotizaciones')) { 
        fetchLeads();
        fetchUsers();
        fetchQuotes();
      } else if (!currentUser) { 
        setQuotes([]);
        setIsLoadingQuotes(false);
        setLeads([]);
        setIsLoadingLeads(false);
        setUsers([]);
        setIsLoadingUsers(false);
      }
    }
  }, [authLoading, currentUser, fetchQuotes, fetchLeads, fetchUsers, hasPermission]);

  const handleSaveQuote = async (quoteData: Quote) => {
    if (!currentUser) {
      toast({ title: "Error", description: "Usuario no autenticado.", variant: "destructive" });
      return;
    }
    setIsSubmittingQuote(true);
    const isEditing = quotes.some(q => q.id === quoteData.id);

    const firestoreSafeQuote = {
        ...quoteData,
        createdAt: Timestamp.fromDate(new Date(quoteData.createdAt)),
        updatedAt: Timestamp.now(),
        validUntil: quoteData.validUntil ? Timestamp.fromDate(new Date(quoteData.validUntil)) : null,
        preparedByUserId: quoteData.preparedByUserId || currentUser.id,
    };

    try {
      const quoteDocRef = doc(db, "quotes", quoteData.id);
      await setDoc(quoteDocRef, firestoreSafeQuote, { merge: true }); 
      
      fetchQuotes(); 
      toast({
        title: isEditing ? "Cotización Actualizada" : "Cotización Creada",
        description: `La cotización "${quoteData.quoteNumber}" ha sido ${isEditing ? 'actualizada' : 'creada'} exitosamente.`,
      });
      setIsQuoteDialogOpen(false);
      setEditingQuote(null);
    } catch (error) {
      console.error("Error al guardar cotización:", error);
      toast({
        title: "Error al Guardar Cotización",
        description: "Ocurrió un error al guardar la cotización.",
        variant: "destructive",
      });
    } finally {
      setIsSubmittingQuote(false);
    }
  };

  const handleDeleteQuote = async (quoteId: string) => {
    if (!currentUser) {
      toast({ title: "Error", description: "Usuario no autenticado.", variant: "destructive" });
      return;
    }
    const quoteToDelete = quotes.find(q => q.id === quoteId);
    if (!quoteToDelete) return;

    if (window.confirm(`¿Estás seguro de que quieres eliminar la cotización "${quoteToDelete.quoteNumber}"?`)) {
      try {
        const quoteDocRef = doc(db, "quotes", quoteId);
        await deleteDoc(quoteDocRef);
        fetchQuotes(); 
        toast({
          title: "Cotización Eliminada",
          description: `La cotización "${quoteToDelete.quoteNumber}" ha sido eliminada.`,
          variant: "default", 
        });
      } catch (error) {
        console.error("Error al eliminar cotización:", error);
        toast({
          title: "Error al Eliminar Cotización",
          description: "Ocurrió un error al eliminar la cotización.",
          variant: "destructive",
        });
      }
    }
  };

  const openNewQuoteDialog = () => {
    setEditingQuote(null);
    setIsQuoteDialogOpen(true);
  };

  const openEditQuoteDialog = (quote: Quote) => {
    setEditingQuote(quote);
    setIsQuoteDialogOpen(true);
  };

  const filteredQuotes = useMemo(() => quotes
    .filter(quote => filterStatus === "Todos" || quote.status === filterStatus)
    .filter(quote => 
      quote.quoteNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (leads.find(l => l.id === quote.leadId)?.name.toLowerCase().includes(searchTerm.toLowerCase()))
    ), [quotes, filterStatus, searchTerm, leads]);

  const pageIsLoading = authLoading || isLoadingQuotes || isLoadingLeads || isLoadingUsers;
  
  if (authLoading) {
    return <div className="flex justify-center items-center h-screen w-full"><p>Cargando autenticación...</p></div>;
  }

  if (!currentUser || !hasPermission('ver-cotizaciones')) {
    return <div className="flex justify-center items-center h-screen w-full"><p>Verificando permisos...</p></div>;
  }

  return (
    <div className="flex flex-col gap-8 w-full"> {/* Asegurado w-full */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
        <h2 className="text-2xl font-semibold">{quotesNavItem?.label || "Cotizaciones"}</h2>
        <AddEditQuoteDialog
          trigger={
            <Button onClick={openNewQuoteDialog} disabled={pageIsLoading || isSubmittingQuote || !hasPermission('crear-cotizacion')}>
              <PlusCircle className="mr-2 h-5 w-5" /> Añadir Cotización
            </Button>
          }
          isOpen={isQuoteDialogOpen}
          onOpenChange={setIsQuoteDialogOpen}
          quoteToEdit={editingQuote}
          leads={leads}
          users={users}
          currentUser={currentUser}
          onSave={handleSaveQuote}
          key={editingQuote ? `edit-${editingQuote.id}` : 'new-quote-dialog'}
        />
      </div>

      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-grow">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            type="search"
            placeholder="Buscar por número o lead..."
            className="pl-8 w-full"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            disabled={pageIsLoading}
          />
        </div>
        <Select value={filterStatus} onValueChange={(value) => setFilterStatus(value as "Todos" | Quote['status'])} disabled={pageIsLoading}>
          <SelectTrigger className="w-full sm:w-[200px]">
            <Filter className="h-4 w-4 mr-2" />
            <SelectValue placeholder="Filtrar por estado" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="Todos">Todos los Estados</SelectItem>
            {QUOTE_STATUSES.map(status => (
              <SelectItem key={status} value={status}>{status}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {pageIsLoading && quotes.length === 0 ? (
        <div className="space-y-4 w-full">
          {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-24 w-full" />)}
        </div>
      ) : filteredQuotes.length > 0 ? (
        <div className="space-y-4 w-full">
          {filteredQuotes.map(quote => (
            <QuoteListItem
              key={quote.id}
              quote={quote}
              lead={leads.find(l => l.id === quote.leadId)}
              preparedBy={users.find(u => u.id === quote.preparedByUserId)}
              onEdit={() => openEditQuoteDialog(quote)}
              onDelete={() => handleDeleteQuote(quote.id)}
              canEdit={hasPermission('editar-cotizacion')}
              canDelete={hasPermission('eliminar-cotizacion')}
            />
          ))}
        </div>
      ) : (
        <div className="text-center py-10 text-muted-foreground w-full">
          <p className="text-lg">No se encontraron cotizaciones.</p>
          <p>Intenta ajustar tus filtros o añade una nueva cotización.</p>
        </div>
      )}
    </div>
  );
}

