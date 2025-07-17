
"use client";

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { NAV_ITEMS } from "@/lib/constants";
import { useAuth } from "@/contexts/auth-context";
import { Share2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

export default function SocialCrmPage() {
  const navItem = NAV_ITEMS.find(item => item.href === '/social-crm');
  const PageIcon = navItem?.icon || Share2;

  const { currentUser, loading, hasPermission } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading) {
      if (!currentUser || !hasPermission('ver-social-crm')) {
        router.push('/access-denied');
      }
    }
  }, [currentUser, loading, hasPermission, router]);

  if (loading) {
    return (
      <div className="flex justify-center items-center h-full">
        <p>Cargando...</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <Card className="shadow-lg">
        <CardHeader>
        <CardTitle className="flex items-center gap-2 text-2xl">
          <PageIcon className="h-6 w-6 text-primary" />
          {navItem?.label || "Social CRM"}
        </CardTitle>
        <CardDescription>
          Monitoriza e interactúa con tus clientes y prospectos en redes sociales (Facebook, Instagram, LinkedIn) directamente desde el CRM.
        </CardDescription>
      </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div>
              <h3 className="text-lg font-semibold">Próximas Funcionalidades:</h3>
              <ul className="list-disc list-inside text-muted-foreground space-y-1 mt-2">
                <li>Integración con APIs de Facebook, Instagram y LinkedIn.</li>
                <li>Monitorización de menciones de marca y palabras clave.</li>
                <li>Programación y publicación de contenido en redes sociales.</li>
                <li>Gestión de mensajes directos y comentarios desde el CRM.</li>
                <li>Creación de leads a partir de interacciones sociales.</li>
                <li>Análisis del rendimiento social.</li>
              </ul>
            </div>
            <p className="mt-6 text-sm text-muted-foreground">
              Esta sección está actualmente en desarrollo. Vuelve pronto para ver las actualizaciones.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
