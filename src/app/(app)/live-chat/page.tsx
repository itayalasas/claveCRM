// src/app/(app)/live-chat/page.tsx
'use client';

import { useAuth } from '@/contexts/auth-context';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { NAV_ITEMS } from '@/lib/constants';
import {
  MessagesSquare,
  Settings2,
  MessageCircle,
  Bot,
  Users,
  History,
  PlusCircle,
  Zap,
  LayoutGrid,
  Smartphone,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import Link from 'next/link';

export default function LiveChatPage() {
  const { currentUser, loading: authLoading, hasPermission } = useAuth(); // Corrected to authLoading
  const router = useRouter();

  useEffect(() => {
    if (!authLoading) { // Corrected to authLoading
      if (!currentUser || !hasPermission('ver-chat-vivo')) {
        router.push('/access-denied');
      }
    }
  }, [currentUser, authLoading, hasPermission, router]); // Corrected to authLoading

  const navItem = NAV_ITEMS
    .flatMap(item => item.subItems || item)  
    .find(item => item.href === '/live-chat');
  const PageIcon = navItem?.icon || MessagesSquare;

  if (authLoading) { // Corrected to authLoading
    return <div className="flex justify-center items-center h-screen w-full"><p>Cargando...</p></div>;
  }

  if (!currentUser || !hasPermission('ver-chat-vivo')) {
    return <div className="flex justify-center items-center h-screen w-full"><p>Verificando permisos...</p></div>; 
  }

  const renderFeatureCard = (
    title: string,
    Icon: React.ElementType,
    description: string,
    features: string[],
    status: 'planeado' | 'desarrollo' | 'parcial' | 'implementado'
  ) => {
    let badgeVariant: 'default' | 'outline' = 'outline';
    let badgeText = 'Planeado';
    let badgeClass = 'border-gray-500 text-gray-600';
    let cardClass = 'bg-muted/30';
    let titleClass = 'text-amber-500';

    if (status === 'implementado') {
      badgeVariant = 'default';
      badgeText = 'Implementado';
      badgeClass = 'bg-green-500 hover:bg-green-600 text-white';
      cardClass = 'bg-green-50 border-green-200';
      titleClass = 'text-green-700';
    } else if (status === 'parcial') {
      badgeVariant = 'default';
      badgeText = 'Parcial';
      badgeClass = 'bg-yellow-500 hover:bg-yellow-600 text-black';
      cardClass = 'bg-yellow-50 border-yellow-200';
      titleClass = 'text-yellow-700';
    } else if (status === 'desarrollo') {
      badgeVariant = 'outline';
      badgeText = 'En Desarrollo';
      badgeClass = 'border-blue-500 text-blue-600';
      cardClass = 'bg-yellow-50 border-yellow-200'; // Consider changing this if it clashes with 'parcial'
      titleClass = 'text-yellow-700'; // Consider changing this if it clashes
    }

    return (
      <Card className={`${cardClass} w-full`} key={title}> {/* Added w-full here */}
        <CardHeader>
          <CardTitle className={`flex items-center gap-2 text-lg ${titleClass}`}>
            <Icon className="h-5 w-5" />
            {title}
            <Badge variant={badgeVariant} className={`ml-2 text-xs ${badgeClass}`}>
              {badgeText}
            </Badge>
          </CardTitle>
          <CardDescription>{description}</CardDescription>
        </CardHeader>
        <CardContent>
          <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground">
            {features.map(f => (
              <li key={f}>{f}</li>
            ))}
          </ul>
        </CardContent>
      </Card>
    );
  };

  return (
    <div className="flex flex-col gap-6 w-full"> {/* Added w-full */}
      <Card className="shadow-lg w-full"> {/* Added w-full */}
        <CardHeader>
          <div className="flex flex-col sm:flex-row justify-between items-center gap-2">
            <div>
              <CardTitle className="flex items-center gap-2 text-2xl">
                <PageIcon className="h-6 w-6 text-primary" />
                {navItem?.label || 'Chat en Vivo y Chatbots'}
              </CardTitle>
              <CardDescription>
                Integra un widget de chat en vivo en tu sitio web y/o configura
                chatbots para respuestas rápidas y captura de leads. La
                integración con WhatsApp Business API también se gestiona aquí.
              </CardDescription>
            </div>
            {hasPermission('acceder-panel-agente') && (
              <Button asChild>
                <Link href="/live-chat/agent-panel" className="flex items-center">
                  <LayoutGrid className="mr-2 h-4 w-4" />
                  Ir al Panel de Agente
                </Link>
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground py-4">
            Utiliza la sección de{' '}
            <Link
              href="/settings/live-chat-widget"
              className="text-primary hover:underline"
            >
              Configuración del Widget de Chat en Vivo
            </Link>{' '}
            para personalizar y obtener el script de incrustación para tu sitio
            web. La configuración de{' '}
            <Link href="/settings" className="text-primary hover:underline">
              WhatsApp Business API
            </Link>{' '}
            se encuentra en los Ajustes Generales. El panel de agente te permite
            gestionar las conversaciones.
          </p>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-4 w-full"> {/* Added w-full */}
        {renderFeatureCard(
          'Widget de Chat en Vivo',
          MessageCircle,
          'Configura e integra un widget de chat personalizable en tu sitio web.',
          [
            'Personalización básica del widget (colores, mensaje de bienvenida, posición) - Implementado.',
            'Script de incrustación para sitios web (generado, funcionalidad real del chat en desarrollo).',
            'Notificaciones para agentes cuando un usuario inicia un chat (Planeado, requiere backend).',
          ],
          'parcial'
        )}
        {renderFeatureCard(
          'Panel de Agente',
          Users,
          'Interfaz para que los agentes atiendan las conversaciones de chat en tiempo real.',
          [
            'Visualización de chats entrantes y en curso (Implementado).',
            'Asignación de chats pendientes (Implementado).',
            'Envío y recepción de mensajes en tiempo real (Implementado).',
            'Cierre de chats (Implementado).',
            'Indicador de canal (Web/WhatsApp) (Placeholder).',
            'Respuestas predefinidas (canned responses) (En desarrollo).',
            'Información básica del visitante (si está disponible) (En desarrollo).',
            'Transferencia de chat entre agentes (Planeado).',
          ],
          'parcial'
        )}
        {renderFeatureCard(
          'Historial de Conversaciones',
          History,
          'Almacena y revisa todas las conversaciones de chat.',
          [
            'Listado de conversaciones pasadas (Implementado).',
            'Visualización de mensajes de chats cerrados (Implementado).',
            'Búsqueda y filtrado de historial (En desarrollo).',
          ],
          'parcial'
        )}
        {renderFeatureCard(
          'Integración CRM',
          PlusCircle,
          'Conecta las conversaciones de chat con tu CRM.',
          [
            'Creación de leads desde una conversación de chat (Implementado).',
            'Creación de tickets de soporte desde un chat (Implementado).',
            'Vinculación de chats a perfiles de clientes existentes (Implementado).',
          ],
          'implementado'
        )}
        {renderFeatureCard(
          'Integración con WhatsApp Business API',
          Smartphone,
          'Conecta con la API de WhatsApp Business para gestionar mensajes desde el CRM.',
          [
            'Configuración de credenciales API (Placeholder en Ajustes).',
            'Recepción de mensajes de WhatsApp en el Panel de Agente (Planeado, requiere backend).',
            'Envío de mensajes de WhatsApp desde el Panel de Agente (Planeado, requiere backend).',
            'Limitado por las políticas y costos de la API de Meta.',
          ],
          'planeado'
        )}
        {renderFeatureCard(
          'Constructor de Chatbot Básico',
          Bot,
          'Crea flujos simples de chatbot para preguntas frecuentes o calificación de leads.',
          [
            'Interfaz para definir preguntas y respuestas.',
            'Opciones de ramificación simple.',
            'Captura de información básica (nombre, email).',
          ],
          'desarrollo'
        )}
        {renderFeatureCard(
          'Transferencia Bot a Humano',
          Zap,
          'Permite que los chatbots transfieran la conversación a un agente humano cuando sea necesario.',
          [
            'Definir disparadores para la transferencia (ej. palabras clave, opción de usuario).',
            'Notificar a agentes disponibles sobre la transferencia.',
            'Interfaz para configurar reglas de transferencia.',
          ],
          'desarrollo'
        )}
      </div>
    </div>
  );
}
