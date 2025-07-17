
"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import type { Order, Lead, User, Quote } from "@/lib/types";
import { NAV_ITEMS, ORDER_STATUSES } from "@/lib/constants";
import { AddEditOrderDialog } from "@/components/orders/add-edit-order-dialog";
import { OrderListItem } from "@/components/orders/order-list-item";
import { Button } from "@/components/ui/button";
import { PlusCircle, Search, Filter } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAuth } from "@/contexts/auth-context";
import { useToast } from "@/hooks/use-toast";
import { Skeleton } from "@/components/ui/skeleton";
import { useRouter } from "next/navigation";
import { db } from "@/lib/firebase";
import { collection, getDocs, doc, setDoc, updateDoc, deleteDoc, query, orderBy, Timestamp } from "firebase/firestore";
import { getAllUsers } from "@/lib/userUtils"; // <-- AÑADIDO: Importar la nueva función

export default function OrdersPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [leads, setLeads] = useState<Lead[]>([]); 
  const [users, setUsers] = useState<User[]>([]); 
  const [quotes, setQuotes] = useState<Quote[]>([]);

  const [isLoadingOrders, setIsLoadingOrders] = useState(true);
  const [isLoadingLeads, setIsLoadingLeads] = useState(true);
  const [isLoadingUsers, setIsLoadingUsers] = useState(true);
  const [isLoadingQuotes, setIsLoadingQuotes] = useState(true);
  const [isSubmittingOrder, setIsSubmittingOrder] = useState(false);
  
  const [editingOrder, setEditingOrder] = useState<Order | null>(null);
  const [isOrderDialogOpen, setIsOrderDialogOpen] = useState(false);

  const [searchTerm, setSearchTerm] = useState("");
  const [filterStatus, setFilterStatus] = useState<"Todos" | Order['status']>("Todos");

  const ordersNavItem = NAV_ITEMS.find(item => item.href === '/orders');
  const { currentUser, loading: authLoading, hasPermission } = useAuth(); // <-- CAMBIO: getAllUsers eliminado
  const router = useRouter();
  const { toast } = useToast();

  const fetchOrders = useCallback(async () => {
    if (!currentUser) {
      setIsLoadingOrders(false);
      return;
    }
    setIsLoadingOrders(true);
    try {
      const ordersCollectionRef = collection(db, "orders");
      const q = query(ordersCollectionRef, orderBy("createdAt", "desc"));
      const querySnapshot = await getDocs(q);
      const fetchedOrders = querySnapshot.docs.map(docSnap => {
        const data = docSnap.data();
        return {
          id: docSnap.id,
          ...data,
          createdAt: (data.createdAt as Timestamp)?.toDate().toISOString() || new Date().toISOString(),
          updatedAt: (data.updatedAt as Timestamp)?.toDate().toISOString() || undefined,
        } as Order;
      });
      setOrders(fetchedOrders);
    } catch (error) {
      console.error("Error al obtener pedidos:", error);
      toast({
        title: "Error al Cargar Pedidos",
        description: "No se pudieron cargar los pedidos desde la base de datos.",
        variant: "destructive",
      });
    } finally {
      setIsLoadingOrders(false);
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
        description: "No se pudieron cargar los datos de los leads para los pedidos.",
        variant: "destructive",
      });
    } finally {
      setIsLoadingLeads(false);
    }
  }, [toast]);

  const fetchUsers = useCallback(async () => {
    setIsLoadingUsers(true);
    try {
      const fetchedUsers = await getAllUsers(); // <-- CAMBIO: Ahora usa la función importada
      setUsers(fetchedUsers);
    } catch (error) {
      console.error("Error al obtener usuarios para pedidos:", error);
      toast({ title: "Error al Cargar Usuarios", description: "No se pudieron obtener los datos de los usuarios.", variant: "destructive" });
    } finally {
      setIsLoadingUsers(false);
    }
  }, [toast]); // <-- CAMBIO: getAllUsers ya no es una dependencia si se importa directamente

  const fetchQuotes = useCallback(async () => {
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
        description: "No se pudieron cargar las cotizaciones para los pedidos.",
        variant: "destructive",
      });
    } finally {
      setIsLoadingQuotes(false);
    }
  }, [toast]);


  useEffect(() => {
    if (!authLoading && (!currentUser || !hasPermission('ver-pedidos'))) {
      router.push('/access-denied');
      return;
    }
    if (!authLoading) { 
      if (currentUser) {
        fetchOrders(); 
      } else {
        setOrders([]); 
        setIsLoadingOrders(false);
      }
      fetchLeads();
      fetchUsers(); 
      fetchQuotes();
    }
  }, [authLoading, currentUser, hasPermission, router, fetchOrders, fetchLeads, fetchUsers, fetchQuotes]);


  const handleSaveOrder = async (orderData: Order) => {
    if (!currentUser) {
      toast({ title: "Error", description: "Usuario no autenticado.", variant: "destructive" });
      return;
    }
    setIsSubmittingOrder(true);
    const isEditing = orders.some(o => o.id === orderData.id);

    const firestoreSafeOrder = {
        ...orderData,
        createdAt: Timestamp.fromDate(new Date(orderData.createdAt)),
        updatedAt: Timestamp.now(),
        placedByUserId: orderData.placedByUserId || currentUser.id,
        quoteId: orderData.quoteId || null, 
    };

    try {
      const orderDocRef = doc(db, "orders", orderData.id);
      await setDoc(orderDocRef, firestoreSafeOrder, { merge: true });
      
      fetchOrders(); 
      toast({
        title: isEditing ? "Pedido Actualizado" : "Pedido Creado",
        description: `El pedido "${orderData.orderNumber}" ha sido ${isEditing ? 'actualizado' : 'creado'} exitosamente.`,
      });
      setEditingOrder(null);
      setIsOrderDialogOpen(false);
    } catch (error) {
      console.error("Error al guardar pedido:", error);
      toast({
        title: "Error al Guardar Pedido",
        description: "Ocurrió un error al guardar el pedido.",
        variant: "destructive",
      });
    } finally {
      setIsSubmittingOrder(false);
    }
  };

  const handleDeleteOrder = async (orderId: string) => {
    if (!currentUser) return;
    const orderToDelete = orders.find(o => o.id === orderId);
    if (!orderToDelete) return;

     if (window.confirm(`¿Estás seguro de que quieres eliminar el pedido "${orderToDelete.orderNumber}"?`)) {
        try {
            const orderDocRef = doc(db, "orders", orderId);
            await deleteDoc(orderDocRef);
            fetchOrders();
            toast({ title: "Pedido Eliminado", description: `El pedido "${orderToDelete.orderNumber}" ha sido eliminado.`, variant: "default" });
        } catch (error) {
            console.error("Error al eliminar pedido:", error);
            toast({ title: "Error al Eliminar Pedido", variant: "destructive" });
        }
    }
  };
  
  const openNewOrderDialog = () => {
    setEditingOrder(null);
    setIsOrderDialogOpen(true);
  };

  const openEditOrderDialog = (order: Order) => {
    setEditingOrder(order);
    setIsOrderDialogOpen(true);
  };

  const filteredOrders = useMemo(() => orders
    .filter(order => filterStatus === "Todos" || order.status === filterStatus)
    .filter(order => 
      order.orderNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (leads.find(l => l.id === order.leadId)?.name.toLowerCase().includes(searchTerm.toLowerCase()))
    ), [orders, filterStatus, searchTerm, leads]);

  const pageIsLoading = authLoading || isLoadingOrders || isLoadingLeads || isLoadingUsers || isLoadingQuotes;

  return (
    <div className="flex flex-col gap-6 w-full"> {/* <-- AÑADIDO: w-full */} 
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
        <h2 className="text-2xl font-semibold">{ordersNavItem?.label || "Pedidos"}</h2>
         <AddEditOrderDialog
          trigger={
            <Button onClick={openNewOrderDialog} disabled={pageIsLoading || isSubmittingOrder}>
              <PlusCircle className="mr-2 h-5 w-5" /> Añadir Pedido
            </Button>
          }
          isOpen={isOrderDialogOpen}
          onOpenChange={setIsOrderDialogOpen}
          orderToEdit={editingOrder}
          leads={leads}
          users={users}
          quotes={quotes}
          currentUser={currentUser}
          onSave={handleSaveOrder}
          key={editingOrder ? `edit-${editingOrder.id}` : 'new-order-dialog'}
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
        <Select value={filterStatus} onValueChange={(value) => setFilterStatus(value as "Todos" | Order['status'])} disabled={pageIsLoading}>
          <SelectTrigger className="w-full sm:w-[200px]">
            <Filter className="h-4 w-4 mr-2" />
            <SelectValue placeholder="Filtrar por estado" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="Todos">Todos los Estados</SelectItem>
            {ORDER_STATUSES.map(status => (
              <SelectItem key={status} value={status}>{status}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {pageIsLoading && orders.length === 0 ? (
        <div className="space-y-4">
          {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-24 w-full" />)}
        </div>
      ) : filteredOrders.length > 0 ? (
        <div className="space-y-4">
          {filteredOrders.map(order => (
            <OrderListItem
              key={order.id}
              order={order}
              lead={leads.find(l => l.id === order.leadId)}
              quote={quotes.find(q => q.id === order.quoteId)}
              placedBy={users.find(u => u.id === order.placedByUserId)}
              onEdit={() => openEditOrderDialog(order)}
              onDelete={() => handleDeleteOrder(order.id)}
            />
          ))}
        </div>
      ) : (
        <div className="text-center py-10 text-muted-foreground">
          <p className="text-lg">No se encontraron pedidos.</p>
          <p>Intenta ajustar tus filtros o añade un nuevo pedido.</p>
        </div>
      )}
    </div>
  );
}
