
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
  const [isLoading, setIsLoading] = useState(false);
  const { login, currentUser, isUserDataLoaded } = useAuth();
  const router = useRouter();
  const { toast } = useToast();

  const logoSrc = "/clave-crm-logo.png";

  useEffect(() => {
    // This effect handles redirection *after* a user state change is detected by the context.
    if (isUserDataLoaded && currentUser) {
      console.log("Login Page: User is loaded and authenticated. Checking for tenantId for redirection.");
      const { tenantId } = currentUser;
      
      // Ensure NEXT_PUBLIC_BASE_URL is defined and does not include http protocol
      const baseUrl = (process.env.NEXT_PUBLIC_BASE_URL || window.location.host).replace(/^https?:\/\//, '');

      if (tenantId && baseUrl) {
        // Construct the full URL for the tenant's dashboard.
        const tenantUrl = `https://${tenantId}.${baseUrl}/dashboard`;
        console.log(`Login Page: Redirecting to tenant URL: ${tenantUrl}`);
        // Use window.location.href for a full page redirect to the new subdomain.
        window.location.href = tenantUrl;
      } else if (!tenantId) {
        // This case is for users without a tenantId (e.g., super-admins on the base domain).
        // They can be redirected normally using Next.js router.
        console.log("Login Page: User has no tenantId. Redirecting to /dashboard on main domain.");
        router.push("/dashboard");
      } else {
        // This error happens if tenantId exists but NEXT_PUBLIC_BASE_URL is missing.
        toast({ title: "Error de Configuración", description: "No se pudo determinar la URL de tu organización. Falta la variable de entorno NEXT_PUBLIC_BASE_URL.", variant: "destructive"});
        setIsLoading(false); // Stop loading on error.
      }
    } else if (isUserDataLoaded && !currentUser) {
        // If data is loaded but there's no user, just ensure the loading spinner is off.
        setIsLoading(false);
    }
  }, [currentUser, isUserDataLoaded, router, toast]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      // The login function now only handles auth. The useEffect above handles redirection.
      await login(email, password);
    } catch (error: any) {
      // Errors (like wrong password) are primarily handled within the login function with toasts.
      // We stop the loading spinner here if the login promise rejects.
      console.error("Login Page: handleLogin caught an error:", error);
      setIsLoading(false);
    }
    // Do not set isLoading(false) on success, as the useEffect will trigger a page redirect.
  };

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
