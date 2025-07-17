
"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import type { EscalationLog, User } from "@/lib/types";
import { NAV_ITEMS } from "@/lib/constants";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { AlertTriangle, Search, CalendarDays, Ticket, Info, ShieldAlert } from "lucide-react";
import { useAuth } from "@/contexts/auth-context";
import { useToast } from "@/hooks/use-toast";
import { Skeleton } from "@/components/ui/skeleton";
import { db } from "@/lib/firebase";
import { collection, getDocs, query, orderBy, Timestamp } from "firebase/firestore";
import { format, parseISO, isValid } from 'date-fns';
import { es } from 'date-fns/locale';
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";

export default function EscalationLogsPage() {
  const navItem = NAV_ITEMS.flatMap(item => item.subItems || []).find(item => item.href === '/settings/escalation-logs');
  const PageIcon = navItem?.icon || AlertTriangle;

  const [logs, setLogs] = useState<EscalationLog[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");

  const { currentUser } = useAuth();
  const { toast } = useToast();

  const parseTimestampField = (fieldValue: any): string => {
    if (fieldValue && typeof fieldValue.toDate === 'function') { // Firestore Timestamp
      return (fieldValue as Timestamp).toDate().toISOString();
    }
    if (typeof fieldValue === 'string' && isValid(parseISO(fieldValue))) { // ISO String
      return fieldValue;
    }
    return new Date(0).toISOString(); // Fallback to epoch if invalid
  };

  const fetchLogs = useCallback(async () => {
    if (!currentUser) {
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    try {
      const q = query(collection(db, "escalationLogs"), orderBy("timestamp", "desc"));
      const querySnapshot = await getDocs(q);
      const fetchedLogs = querySnapshot.docs.map(docSnap => {
        const data = docSnap.data();
        return {
          id: docSnap.id,
          ticketId: data.ticketId,
          ruleId: data.ruleId,
          ruleName: data.ruleName,
          conditionMet: data.conditionMet,
          actionTaken: data.actionTaken,
          timestamp: parseTimestampField(data.timestamp),
          details: data.details || "",
          loggedBySystem: data.loggedBySystem === undefined ? true : data.loggedBySystem, // Default to true
        } as EscalationLog;
      });
      setLogs(fetchedLogs);
    } catch (error) {
      console.error("Error al obtener historial de escalados:", error);
      toast({ title: "Error al Cargar Historial", description: String(error), variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  }, [currentUser, toast]);

  useEffect(() => {
    if (currentUser?.role === 'admin' || currentUser?.role === 'supervisor') {
        fetchLogs();
    } else {
        setIsLoading(false);
        setLogs([]); 
    }
  }, [fetchLogs, currentUser]);

  if (currentUser?.role !== 'admin' && currentUser?.role !== 'supervisor') {
    return (
        <Card className="m-auto mt-10 max-w-md">
            <CardHeader>
                <CardTitle className="flex items-center gap-2"><ShieldAlert className="h-6 w-6 text-destructive"/>Acceso Denegado</CardTitle>
                <CardDescription>No tienes permisos para ver el historial de escalados.</CardDescription>
            </CardHeader>
            <CardContent>
                <p>Esta sección es solo para administradores y supervisores.</p>
            </CardContent>
        </Card>
    );
  }

  const filteredLogs = useMemo(() => logs.filter(log =>
    log.ticketId.toLowerCase().includes(searchTerm.toLowerCase()) ||
    log.ruleName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    log.conditionMet.toLowerCase().includes(searchTerm.toLowerCase()) ||
    log.actionTaken.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (log.details && log.details.toLowerCase().includes(searchTerm.toLowerCase()))
  ), [logs, searchTerm]);

  return (
    <div className="flex flex-col gap-6">
      <Card className="shadow-lg">
        <CardHeader>
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
            <div>
                <CardTitle className="flex items-center gap-2 text-2xl">
                <PageIcon className="h-6 w-6 text-primary" />
                {navItem?.label || "Historial de Escalados de Tickets"}
                </CardTitle>
                <CardDescription>
                Registro de todas las acciones de escalado automático realizadas por el sistema.
                </CardDescription>
            </div>
          </div>
           <div className="relative mt-4">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                    type="search"
                    placeholder="Buscar por ID de ticket, regla, condición, acción o detalles..."
                    className="pl-8 w-full"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    disabled={isLoading}
                />
            </div>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-[calc(100vh-var(--header-height,4rem)-18rem)]">
            {isLoading ? (
              <div className="space-y-4">
                {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-24 w-full" />)}
              </div>
            ) : filteredLogs.length > 0 ? (
              <div className="space-y-3">
                {filteredLogs.map(log => (
                    <Card key={log.id} className="shadow-sm">
                        <CardHeader className="p-3 pb-2">
                            <div className="flex items-center justify-between">
                                <CardTitle className="text-sm font-medium flex items-center gap-2">
                                    <Ticket className="h-4 w-4 text-primary" />
                                    Escalado en Ticket: <span className="font-mono text-primary/80 text-xs">{log.ticketId}</span>
                                </CardTitle>
                                <Badge variant="secondary" className="text-xs">
                                    <CalendarDays className="mr-1.5 h-3 w-3" />
                                    {isValid(parseISO(log.timestamp)) ? format(parseISO(log.timestamp), "PPpp", { locale: es }) : 'Fecha inválida'}
                                </Badge>
                            </div>
                        </CardHeader>
                        <CardContent className="p-3 pt-0 text-xs space-y-1">
                            <p><strong className="font-medium">Regla Aplicada:</strong> {log.ruleName} (ID: {log.ruleId})</p>
                            <p><strong className="font-medium">Condición Cumplida:</strong> <span className="text-amber-700">{log.conditionMet}</span></p>
                            <p><strong className="font-medium">Acción Realizada:</strong> <span className="text-blue-700">{log.actionTaken}</span></p>
                            {log.details && <p className="text-muted-foreground"><strong className="font-medium">Detalles Adicionales:</strong> {log.details}</p>}
                        </CardContent>
                    </Card>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                 <Info className="mx-auto h-12 w-12 text-gray-400 mb-4" />
                 <p className="text-lg">
                    {searchTerm ? "No se encontraron registros con ese criterio." : "No hay registros de escalados disponibles."}
                 </p>
                 {!searchTerm && <p className="text-sm">Cuando las reglas de escalado se activen, los eventos aparecerán aquí.</p>}
              </div>
            )}
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  );
}
