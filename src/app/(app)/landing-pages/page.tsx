
"use client";

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { NAV_ITEMS } from "@/lib/constants";
import { LayoutTemplate, MessageSquare } from "lucide-react"; // Added MessageSquare as a fallback
import { useAuth } from '@/contexts/auth-context';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { Button } from "@/components/ui/button";
import Link from "next/link";

export default function LandingPagesPage() {
  const { currentUser, loading: authLoading, hasPermission } = useAuth(); // Corrected to authLoading
  const router = useRouter();

  useEffect(() => {
    if (!authLoading) { // Corrected to authLoading
      if (!currentUser || !hasPermission('ver-paginas-aterrizaje')) {
        router.push('/access-denied');
      }
    }
  }, [currentUser, authLoading, hasPermission, router]); // Corrected to authLoading

  const navItem = NAV_ITEMS.find(item => item.href === '/landing-pages');
  // Use MessageSquare as a fallback if LayoutTemplate is specific and not found, or use navItem?.icon
  const PageIcon = navItem?.icon || LayoutTemplate; 

  if (authLoading) { // Corrected to authLoading
    return <div className="flex justify-center items-center h-screen w-full"><p>Cargando...</p></div>;
  }

  // No renderizar nada si no tiene permiso, el useEffect ya redirige.
  if (!currentUser || !hasPermission('ver-paginas-aterrizaje')) {
    return <div className="flex justify-center items-center h-screen w-full"><p>Verificando permisos...</p></div>; 
  }

  return (
    <div className="flex flex-col gap-6 w-full"> {/* Added w-full */}
      <Card className="shadow-lg w-full"> {/* Added w-full */}
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-2xl">
            <PageIcon className="h-6 w-6 text-primary" />
            {navItem?.label || "Landing Pages y Formularios"}
          </CardTitle>
          <CardDescription>
            Diseña landing pages y formularios web para capturar leads directamente en tu CRM.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div>
              <h3 className="text-lg font-semibold">Próximas Funcionalidades:</h3>
              <ul className="list-disc list-inside text-muted-foreground space-y-1 mt-2">
                <li>Constructor de landing pages (arrastrar y soltar).</li>
                <li>Plantillas personalizables para landing pages.</li>
                <li>Creador de formularios web integrados.</li>
                <li>Mapeo de campos de formulario a campos de lead en el CRM.</li>
                <li>Opciones de incrustación de formularios en sitios externos.</li>
                <li>Analíticas de conversión de landing pages y formularios.</li>
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
