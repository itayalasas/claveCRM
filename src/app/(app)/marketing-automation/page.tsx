
"use client";

import { useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { NAV_ITEMS } from "@/lib/constants";
import { Zap } from "lucide-react";
import { useAuth } from '@/contexts/auth-context';
import { useRouter } from 'next/navigation';

export default function MarketingAutomationPage() {
  const { currentUser, loading, hasPermission } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading) {
      if (!currentUser || !hasPermission('ver-automatizaciones')) {
        router.push('/access-denied');
      }
    }
  }, [currentUser, loading, hasPermission, router]);

  const navItem = NAV_ITEMS.find(item => item.href === '/marketing-automation');
  const PageIcon = navItem?.icon || Zap;

  return (
    <div className="flex flex-col gap-6">
      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-2xl">
            <PageIcon className="h-6 w-6 text-primary" />
            {navItem?.label || "Automatización de Marketing"}
          </CardTitle>
          <CardDescription>
            Crea workflows y automatizaciones basadas en disparadores para optimizar tus procesos de marketing y ventas.
          </CardDescription>
        </CardHeader>
        <CardContent>
           {loading && <div>Cargando...</div>}
           {!loading && currentUser && hasPermission('ver-automatizaciones') && (
           <div className="space-y-4">
            <div>
              <h3 className="text-lg font-semibold">Próximas Funcionalidades:</h3>
              <ul className="list-disc list-inside text-muted-foreground space-y-1 mt-2">
                <li>Constructor visual de workflows.</li>
                <li>Definición de disparadores (ej. apertura de email, envío de formulario, actualización de lead).</li>
                <li>Configuración de acciones automáticas (ej. crear tarea, enviar email, cambiar etapa del lead).</li>
                <li>Gestión de flujos de nutrición de leads (lead nurturing).</li>
                <li>Monitorización y estadísticas de workflows.</li>
              </ul>
            </div>
            <p className="mt-6 text-sm text-muted-foreground">
              Esta sección está actualmente en desarrollo. Vuelve pronto para ver las actualizaciones.
            </p>
          </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
