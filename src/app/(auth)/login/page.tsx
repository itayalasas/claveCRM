
"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/auth-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { APP_NAME } from "@/lib/constants";
import { Loader2 } from "lucide-react";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { login, currentUser, isUserDataLoaded, loading: authLoading } = useAuth();
  const router = useRouter();
  const { toast } = useToast();

  const logoSrc = "/clave-crm-logo.png";

  useEffect(() => {
    // This effect handles redirection AFTER the user data is confirmed to be loaded.
    if (isUserDataLoaded && currentUser) {
      const { subdomain } = currentUser;

      // Use NEXT_PUBLIC_BASE_URL as the single source of truth for the domain.
      const baseUrl = process.env.NEXT_PUBLIC_BASE_URL;

      if (!baseUrl) {
        console.error("LoginPage: NEXT_PUBLIC_BASE_URL no está configurado en las variables de entorno.");
        toast({
          title: "Error de Configuración",
          description: "El dominio base de la aplicación no está configurado. La redirección fallará.",
          variant: "destructive"
        });
        return; // Detener si la URL base no está configurada.
      }
      
      const protocol = baseUrl.startsWith('localhost') ? 'http://' : 'https://';
      const cleanBaseUrl = baseUrl.replace(/^https?:\/\//, '');

      if (subdomain) {
        // Redirigir al subdominio del tenant.
        const tenantUrl = `${protocol}${subdomain}.${cleanBaseUrl}/dashboard`;
        window.location.href = tenantUrl;
      } else {
        // Redirigir al dashboard en el dominio base.
        router.push("/dashboard");
      }
    }
  }, [currentUser, isUserDataLoaded, router, toast]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      await login(email, password);
      // The useEffect above will handle redirection upon successful state change.
    } catch (error: any) {
      console.error("Login Page: handleLogin caught an error:", error);
      setIsSubmitting(false); // Only set to false on error, so user can try again.
    }
  };

  const isLoading = authLoading || (isSubmitting && !isUserDataLoaded);

  return (
    <div className="flex flex-col items-center justify-center min-h-screen py-12">
      <div className="mx-auto grid w-[350px] gap-6">
         <div className="flex flex-col items-center gap-2 text-center">
            <Image src={logoSrc} alt={`${APP_NAME} Logo`} width={64} height={64} className="h-16 w-16" data-ai-hint="logo key"/>
            <h1 className="text-3xl font-bold" style={{ color: 'hsl(var(--primary))' }}>{APP_NAME}</h1>
            <p className="text-balance text-muted-foreground">
              Accede a tu cuenta
            </p>
          </div>

        <Card>
          <form onSubmit={handleLogin}>
            <CardHeader>
              <CardTitle>Iniciar Sesión</CardTitle>
              <CardDescription>Ingresa tu correo y contraseña para acceder.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="login-email">Correo Electrónico</Label>
                <Input
                  id="login-email"
                  type="email"
                  placeholder="tu@ejemplo.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  disabled={isLoading}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="login-password">Contraseña</Label>
                <Input
                  id="login-password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  disabled={isLoading}
                />
              </div>
            </CardContent>
            <CardFooter>
              <Button type="submit" className="w-full" disabled={isLoading}>
                {isLoading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin"/> Iniciando Sesión...</> : "Iniciar Sesión"}
              </Button>
            </CardFooter>
          </form>
        </Card>
      </div>
    </div>
  );
}
