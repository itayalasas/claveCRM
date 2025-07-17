"use client";

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Lock, ShieldOff } from "lucide-react";
import { useRouter } from "next/navigation";

export default function AccessDeniedPage() {
  const router = useRouter();

  return (
    <div className="flex min-h-[calc(100vh-theme(spacing.16))] items-center justify-center px-4 py-12">
      <Card className="w-full max-w-md text-center shadow-lg">
        <CardHeader className="flex flex-col items-center">
          {/* Choose one icon, e.g., Lock */}
          <Lock className="h-12 w-12 text-red-500 mb-4" /> 
          {/* Or use ShieldOff: <ShieldOff className="h-12 w-12 text-red-500 mb-4" /> */}
          
          <CardTitle className="text-2xl font-bold text-red-600">Acceso Denegado</CardTitle>
          <CardDescription>No tienes los permisos necesarios para ver esta página.</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground mb-6">
            Si crees que esto es un error, por favor contacta a tu administrador del sistema.
          </p>
          <Button onClick={() => router.push('/dashboard')}>
            Ir al Panel de Control
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}