
"use client";

import { useState, useEffect, useCallback } from "react";
import type { ActivityLog, User } from "@/lib/types";
import { NAV_ITEMS } from "@/lib/constants";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { HistoryIcon, UserCircle, CalendarDays, ShieldAlert, Settings, FileText, Users, ShoppingCart, Receipt, Send, Users2, Ticket, Zap, LayoutDashboardIcon, type LucideIcon } from "lucide-react";
import { useAuth } from "@/contexts/auth-context";
import { useToast } from "@/hooks/use-toast";
import { Skeleton } from "@/components/ui/skeleton";
import { db } from "@/lib/firebase";
import { collection, getDocs, query, where, orderBy, Timestamp } from "firebase/firestore";
import { format, parseISO, isValid } from 'date-fns';
import { es } from 'date-fns/locale';
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import { Search } from "lucide-react";
import { useRouter } from "next/navigation"; // Import useRouter
import { getAllUsers } from "@/lib/userUtils"; // <-- AÑADIDO: Importar la nueva función

const ENTITY_TYPE_ICONS: Record<string, LucideIcon> = {
    Lead: Users,
    Task: FileText, 
    Ticket: Ticket,
    User: UserCircle,
    Document: FileText,
    EmailSettings: Settings,
    EmailCampaign: Send,
    Quote: FileText,
    Order: ShoppingCart,
    Invoice: Receipt,
    Meeting: CalendarDays,
    ContactList: Users2,
    EmailTemplate: FileText,
    Default: HistoryIcon,
};

const ACTION_TYPE_BADGES: Record<string, string> = {
    create: "bg-green-500 hover:bg-green-600",
    update: "bg-blue-500 hover:bg-blue-600",
    delete: "bg-red-500 hover:bg-red-600",
    login: "bg-sky-500 hover:bg-sky-600",
    logout: "bg-slate-500 hover:bg-slate-600",
    config_change: "bg-purple-500 hover:bg-purple-600",
    access_change: "bg-yellow-500 hover:bg-yellow-600 text-black",
    file_upload: "bg-teal-500 hover:bg-teal-600",
    file_download: "bg-indigo-500 hover:bg-indigo-600",
};

export default function AuditLogPage() {
  const navItem = NAV_ITEMS.flatMap(item => item.subItems || item).find(item => item.href === '/audit-log');
  const PageIcon = navItem?.icon || HistoryIcon;

  const [auditLogs, setAuditLogs] = useState<ActivityLog[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [usersMap, setUsersMap] = useState<Record<string, string>>({});

  // CAMBIO: getAllUsers eliminado de useAuth()
  const { currentUser, loading: authLoading, hasPermission } = useAuth(); 
  const { toast } = useToast();
  const router = useRouter(); // Initialize router

  const parseTimestampField = (fieldValue: any): string => {
    if (fieldValue && typeof fieldValue.toDate === 'function') { 
      return (fieldValue as Timestamp).toDate().toISOString();
    }
    if (typeof fieldValue === 'string' && isValid(parseISO(fieldValue))) { 
      return fieldValue;
    }
    if (fieldValue && typeof fieldValue === 'object' && fieldValue.hasOwnProperty('_methodName') && fieldValue._methodName === 'serverTimestamp') {
        return new Date().toISOString(); 
    }
    return new Date().toISOString(); 
  };

  const fetchAuditLogsAndUsers = useCallback(async () => {
    if (!currentUser) {
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    try {
      // CAMBIO: Llamar a getAllUsers importada
      const [auditLogsSnapshot, allUsersData] = await Promise.all([
        getDocs(query(
          collection(db, "activityLogs"),
          where("category", "==", "system_audit"),
          orderBy("timestamp", "desc")
        )),
        getAllUsers() 
      ]);

      const fetchedLogs = auditLogsSnapshot.docs.map(docSnap => {
        const data = docSnap.data();
        return {
          id: docSnap.id,
          ...data,
          timestamp: parseTimestampField(data.timestamp),
          createdAt: parseTimestampField(data.createdAt),
        } as ActivityLog;
      });
      setAuditLogs(fetchedLogs);

      const map: Record<string, string> = {};
      allUsersData.forEach(user => {
        if(user.name) map[user.id] = user.name;
      });
      setUsersMap(map);

    } catch (error) {
      console.error("Error al obtener historial de auditoría o usuarios:", error);
      toast({ title: "Error al Cargar Datos", description: String(error), variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  // CAMBIO: dependencias ajustadas
  }, [currentUser, toast]);

  useEffect(() => {
    if(!authLoading){
      if (!currentUser || !hasPermission('ver-registro-auditoria')) {
        router.push('/access-denied');
        return;
      }
      fetchAuditLogsAndUsers();
    } else if (!authLoading && !currentUser) {
        setAuditLogs([]);
        setUsersMap({});
        setIsLoading(false);
    }
  // CAMBIO: fetchAuditLogsAndUsers es ahora estable
  }, [authLoading, currentUser, hasPermission, router, fetchAuditLogsAndUsers]);
 
 if (authLoading) { // Mostrar loader si la autenticación está en curso
    return (
      <div className="flex flex-col gap-6 w-full p-6 items-center justify-center h-screen">
        <Skeleton className="h-12 w-12 rounded-full" />
        <div className="space-y-2">
          <Skeleton className="h-4 w-[250px]" />
          <Skeleton className="h-4 w-[200px]" />
        </div>
      </div>
   );
  }

  // Si después de cargar auth, no hay currentUser o no tiene permiso, el useEffect ya redirigió.
  // Este es un fallback para el estado inicial antes de que el efecto se ejecute.
  if (!currentUser || !hasPermission('ver-registro-auditoria')) {
    return (
        <div className="flex flex-col items-center justify-center h-screen w-full p-6 text-center">
            <ShieldAlert size={48} className="text-destructive mb-4" />
            <h2 className="text-xl font-semibold">Acceso Denegado</h2>
            <p className="text-muted-foreground">No tienes permisos para ver el historial de auditoría.</p>
        </div>
    );
  }

  const filteredAuditLogs = auditLogs.filter(log =>
    (log.subject && log.subject.toLowerCase().includes(searchTerm.toLowerCase())) ||
    (log.details && log.details.toLowerCase().includes(searchTerm.toLowerCase())) ||
    (usersMap[log.loggedByUserId] && usersMap[log.loggedByUserId].toLowerCase().includes(searchTerm.toLowerCase())) ||
    (log.entityType && log.entityType.toLowerCase().includes(searchTerm.toLowerCase())) ||
    (log.entityId && log.entityId.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  return (
    // CAMBIO: Añadido w-full
    <div className="flex flex-col gap-6 w-full">
      <Card className="shadow-lg w-full"> {/* Card principal ocupa todo el ancho */} 
        <CardHeader>
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
            <div>
                <CardTitle className="flex items-center gap-2 text-2xl">
                <PageIcon className="h-6 w-6 text-primary" />
                {navItem?.label || "Historial de Auditoría del Sistema"}
                </CardTitle>
                <CardDescription>
                Registro de acciones importantes realizadas en el sistema CRM.
                </CardDescription>
            </div>
          </div>
           <div className="relative mt-4">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                    type="search"
                    placeholder="Buscar por acción, detalle, usuario, entidad..."
                    className="pl-8 w-full"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    disabled={isLoading} // Deshabilitar si está cargando inicialmente
                />
            </div>
        </CardHeader>
        <CardContent>
          {/* Ajustar altura de ScrollArea dinámicamente o un valor fijo alto */} 
          <ScrollArea className="h-[calc(100vh-var(--header-height,4rem)-19rem)] xl:h-[calc(100vh-var(--header-height,4rem)-16rem)]"> 
            {isLoading && auditLogs.length === 0 ? (
              <div className="space-y-4">
                {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-20 w-full" />)}
              </div>
            ) : filteredAuditLogs.length > 0 ? (
              <div className="space-y-3">
                {filteredAuditLogs.map(log => {
                    const EntityIcon = ENTITY_TYPE_ICONS[log.entityType || 'Default'] || HistoryIcon;
                    const actionBadgeClass = ACTION_TYPE_BADGES[log.type] || "bg-gray-500 hover:bg-gray-600";
                    return (
                        <Card key={log.id} className="shadow-sm">
                            <CardHeader className="p-3">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        <EntityIcon className="h-5 w-5 text-primary" />
                                        <CardTitle className="text-sm font-medium truncate" title={log.subject || log.type}>
                                            {log.subject || log.type.toUpperCase()}
                                        </CardTitle>
                                    </div>
                                    <Badge className={`text-xs text-white ${actionBadgeClass}`}>{log.type}</Badge>
                                </div>
                            </CardHeader>
                            <CardContent className="p-3 pt-0 text-xs">
                                <p className="text-muted-foreground mb-1">{log.details}</p>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-3 gap-y-1">
                                    <div className="flex items-center gap-1" title="Fecha y Hora">
                                        <CalendarDays className="h-3 w-3 shrink-0" />
                                        {isValid(parseISO(log.timestamp)) ? format(parseISO(log.timestamp), "PPpp", { locale: es }) : 'Fecha inválida'}
                                    </div>
                                    <div className="flex items-center gap-1 truncate" title={`Realizado por: ${usersMap[log.loggedByUserId] || log.loggedByUserId}`}>
                                        <UserCircle className="h-3 w-3 shrink-0" />
                                        {usersMap[log.loggedByUserId] || log.loggedByUserId}
                                    </div>
                                    {log.entityType && (
                                        <div className="flex items-center gap-1 truncate" title={`Entidad: ${log.entityType}`}>
                                            <LayoutDashboardIcon className="h-3 w-3 shrink-0" />
                                            Entidad: {log.entityType}
                                        </div>
                                    )}
                                    {log.entityId && (
                                        <div className="flex items-center gap-1 truncate" title={`ID Entidad: ${log.entityId}`}>
                                            <span className="font-mono text-xs">ID: {log.entityId}</span>
                                        </div>
                                    )}
                                </div>
                            </CardContent>
                        </Card>
                    );
                })}
              </div>
            ) : (
              <p className="text-center text-muted-foreground py-8">
                {searchTerm ? "No se encontraron registros con ese criterio." : "No hay registros de auditoría disponibles."}
              </p>
            )}
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  );
}

