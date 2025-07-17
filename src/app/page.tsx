
import Link from 'next/link';
import Image from 'next/image';
import { Globe, LogIn, ChevronDown, Zap, FileText, Users, Cpu, Building, Rocket, GraduationCap } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { APP_NAME } from '@/lib/constants';

// Placeholder data for feature cards
const featureCards = [
  {
    title: "Complemento Smart Docs",
    description: "Cierra tratos más rápido con nuestra gestión de documentos.",
    icon: "/smart-doc.png", // Changed from FileText
    dataAiHint: "document management",
  },
  {
    title: "Campaigns ClaveCRM",
    description: "Crea campañas de correo electrónico en segundos.",
    icon: Zap,
    dataAiHint: "email marketing",
  },
  {
    title: "Industrias",
    description: "Descubre cómo ClaveCRM se adapta a tu sector.",
    icon: Building,
    dataAiHint: "industry solutions",
  },
];

export default function HomePage() {
  const logoSrc = "/clave-crm-logo.png";

  return (
    <div className="flex flex-col min-h-screen bg-background text-foreground">
      {/* Header */}
      <header className="sticky top-0 z-40 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container flex h-16 items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <Image src={logoSrc} alt={`${APP_NAME} Logo`} width={32} height={32} className="h-8 w-8" data-ai-hint="logo key" />
            <span className="text-xl font-semibold text-primary">{APP_NAME}</span>
          </Link>
          <nav className="flex items-center gap-4">
            <Button variant="ghost" size="sm" className="text-sm">
              <Globe className="mr-1.5 h-4 w-4" />
              Español
              <ChevronDown className="ml-1 h-4 w-4 opacity-50" />
            </Button>
            <Button variant="ghost" size="sm" asChild className="text-sm">
              <Link href="/login">
                <LogIn className="mr-1.5 h-4 w-4" />
                Entrar
              </Link>
            </Button>
            <Button size="sm" className="bg-purple-600 hover:bg-purple-700 text-white">
              Pruébalo gratis
            </Button>
          </nav>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-grow">
        {/* Hero Section */}
        <section className="py-16 md:py-24 lg:py-32 text-center bg-gradient-to-b from-background to-muted/30">
          <div className="container">
            <h1 className="text-4xl font-bold tracking-tight sm:text-5xl md:text-6xl text-primary">
              Comienza a cerrar más tratos con {APP_NAME}
            </h1>
            <p className="mt-6 max-w-2xl mx-auto text-lg text-muted-foreground">
              Gestiona tus contactos, ventas y actividades en un solo lugar.
            </p>
            <div className="mt-10">
              <Button size="lg" className="bg-accent text-accent-foreground hover:bg-accent/90">
                Pruébalo gratis
              </Button>
            </div>
          </div>
        </section>

        {/* Features Section */}
        <section className="py-16 md:py-24 bg-background">
          <div className="container">
            <div className="grid gap-8 md:grid-cols-3">
              {featureCards.map((feature) => (
                <Card key={feature.title} className="shadow-lg hover:shadow-xl transition-shadow duration-300">
                  <CardHeader>
                    <div className="flex items-center justify-center mb-4">
                       <Image 
                        src={typeof feature.icon === 'string' ? feature.icon : `https://placehold.co/80x80.png?text=${feature.icon.displayName || 'Icon'}`} 
                        alt={`${feature.title} icon`} 
                        width={64} 
                        height={64} 
                        className="h-16 w-16 rounded-md"
                        data-ai-hint={feature.dataAiHint}
                        />
                    </div>
                    <CardTitle className="text-xl text-center text-primary">{feature.title}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <CardDescription className="text-center text-muted-foreground">{feature.description}</CardDescription>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </section>

        {/* Secondary CTA Section */}
        <section className="py-16 md:py-24 text-center bg-muted/30">
          <div className="container">
            <h2 className="text-3xl font-semibold tracking-tight text-primary">
              ¿Qué te gustaría hacer ahora?
            </h2>
            <div className="mt-8 flex flex-col sm:flex-row justify-center gap-4">
              <Button size="lg" className="bg-accent text-accent-foreground hover:bg-accent/90">
                Visitar la página de inicio
              </Button>
              <Button variant="outline" size="lg">
                Ver tutoriales
              </Button>
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="py-8 border-t bg-background">
        <div className="container text-center text-sm text-muted-foreground">
          © {new Date().getFullYear()} {APP_NAME}. Todos los derechos reservados.
        </div>
      </footer>
    </div>
  );
}
