
import type { Lead, PipelineStage, Task, User, TicketStatus, TicketPriority, UserRole, QuoteStatus, OrderStatus, InvoiceStatus, EmailCampaignStatus, PredefinedEmailTemplate, CommonEmailVariable, MeetingStatus, ActivityLogUserActivityType, ActivityLogSystemAuditActionType, Resource, SLA, SupportQueue, EscalationRule, EscalationConditionType, EscalationActionType, SurveyType, SurveyQuestionType, KnowledgeBaseArticle, EmailMessage, UserEmailAccountSettings } from './types';
import { LayoutDashboard, BarChartBig, ListChecks, Sparkles, Briefcase, ClipboardList, Users as UsersIcon, FileText, ShoppingCart, Receipt, Send, Zap, LayoutTemplate, Share2, Settings, DollarSign, Target, LifeBuoy, SlidersHorizontal, type LucideIcon, ChevronDown, UsersRound, CalendarDays, FileClock, FolderKanban, Library, HistoryIcon, Brain, MessagesSquare, Smile, MessageCircle, ShieldCheck, LayersIcon, ClockIcon, HelpCircleIcon, AlertTriangle, ListFilter, KeyRound, Mail as MailIcon, UserCircle as UserCircleIconLucide } from 'lucide-react';

export const APP_NAME = "ClaveCRM";

export type NavItem = {
  href?: string;
  label: string;
  icon: LucideIcon;
  subItems?: NavItem[];
  disabled?: boolean;
  parentActiveIf?: (pathname: string) => boolean;
  requiredPermission?: string;
};

export const NAV_ITEMS: NavItem[] = [
  { href: '/dashboard', label: 'Panel de Control', icon: LayoutDashboard, requiredPermission: 'ver-dashboard' },
  {
    label: 'Ventas',
    icon: DollarSign,
    requiredPermission: 'ver-ventas',
    subItems: [
      { href: '/pipeline', label: 'Embudo de Ventas', icon: BarChartBig, requiredPermission: 'ver-pipeline' },
      { href: '/leads', label: 'Gestión de Leads', icon: UsersIcon, requiredPermission: 'ver-leads' },
      { href: '/quotes', label: 'Cotizaciones', icon: FileText, requiredPermission: 'ver-cotizaciones' },
      { href: '/orders', label: 'Pedidos', icon: ShoppingCart, requiredPermission: 'ver-pedidos' },
      { href: '/invoices', label: 'Facturas', icon: Receipt, requiredPermission: 'ver-facturas' },
    ],
    parentActiveIf: (pathname) => ['/pipeline', '/leads', '/quotes', '/orders', '/invoices'].some(p => pathname.startsWith(p)),
  },
  {
    label: 'Marketing',
    icon: Target,
    requiredPermission: 'ver-marketing',
    subItems: [
      { href: '/ai-email-assistant', label: 'Asistente IA de Correo', icon: Sparkles, requiredPermission: 'usar-ai-email' },
      { href: '/email-campaigns', label: 'Campañas de Email', icon: Send, requiredPermission: 'ver-campanas-email' },
      { href: '/marketing-automation', label: 'Automatización Marketing', icon: Zap, disabled: true, requiredPermission: 'ver-automatizaciones' },
      { href: '/landing-pages', label: 'Landing Pages y Formularios', icon: LayoutTemplate, disabled: true, requiredPermission: 'ver-paginas-aterrizaje' },
      { href: '/social-crm', label: 'Social CRM', icon: Share2, disabled: true, requiredPermission: 'ver-social-crm' },
    ],
    parentActiveIf: (pathname) => ['/ai-email-assistant', '/email-campaigns', '/marketing-automation', '/landing-pages', '/social-crm'].some(p => pathname.startsWith(p)),
  },
  { href: '/email', label: 'Correo Electrónico', icon: MailIcon, requiredPermission: 'ver-correos' },
  {
    label: 'Colaboración y Productividad',
    icon: UsersRound,
    requiredPermission: 'ver-colaboracion',
    subItems: [
      { href: '/calendar', label: 'Calendario y Reuniones', icon: CalendarDays, requiredPermission: 'ver-calendario' },
      { href: '/activity-log', label: 'Registro de Actividades', icon: FileClock, requiredPermission: 'ver-registro-actividades' },
      { href: '/documents', label: 'Gestión de Documentos', icon: FolderKanban, requiredPermission: 'ver-documentos' },
      { href: '/tasks', label: 'Tareas', icon: ListChecks, requiredPermission: 'ver-tareas' },
    ],
    parentActiveIf: (pathname) => ['/calendar', '/activity-log', '/documents', '/tasks'].some(p => pathname.startsWith(p)),
  },
  {
    label: 'Soporte al Cliente',
    icon: LifeBuoy,
    requiredPermission: 'ver-soporte',
    subItems: [
      { href: '/tickets', label: 'Gestión de Tickets', icon: ClipboardList, requiredPermission: 'ver-tickets' },
      { href: '/knowledge-base', label: 'Base de Conocimiento', icon: Brain, requiredPermission: 'ver-base-conocimiento' },
      { href: '/live-chat', label: 'Chat en Vivo / Chatbots', icon: MessagesSquare, requiredPermission: 'ver-chat-vivo' },
      { href: '/satisfaction-surveys', label: 'Encuestas de Satisfacción', icon: Smile, requiredPermission: 'ver-encuestas' },
    ],
    parentActiveIf: (pathname) => ['/tickets', '/knowledge-base', '/live-chat', '/satisfaction-surveys'].some(p => pathname.startsWith(p)),
  },
  {
    label: 'Configuración',
    icon: Settings,
    requiredPermission: 'acceder-configuracion', // General permission for settings section
    subItems: [
      { href: '/settings', label: 'General', icon: Settings, requiredPermission: 'acceder-configuracion-general' },
      { href: '/settings/my-email-account', label: 'Mi Cuenta de Correo', icon: UserCircleIconLucide, requiredPermission: 'gestionar-cuenta-correo' },
      { href: '/settings/live-chat-widget', label: 'Config. Chat en Vivo', icon: MessageCircle, requiredPermission: 'gestionar-configuracion-chat' },
      { href: '/settings/slas', label: 'Gestión de SLAs', icon: ShieldCheck, requiredPermission: 'gestionar-slas' },
      { href: '/settings/support-queues', label: 'Colas de Soporte', icon: LayersIcon, requiredPermission: 'gestionar-colas-soporte' },
      { href: '/settings/escalation-rules', label: 'Reglas de Escalado', icon: ClockIcon, requiredPermission: 'gestionar-reglas-escalamiento' },
    ],
    parentActiveIf: (pathname) => pathname.startsWith('/settings') && 
                                 !pathname.startsWith('/settings/license') &&
                                 !pathname.startsWith('/settings/escalation-logs'), // Exclude admin-only settings
  },
  {
    label: 'Administración',
    icon: SlidersHorizontal,
    requiredPermission: 'ver-administracion',
    subItems: [
      { href: '/user-management', label: 'Gestión de Usuarios', icon: UsersIcon, requiredPermission: 'ver-usuarios' },
      { href: '/roles-and-permissions', label: 'Gestión de Roles y Permisos', icon: KeyRound, requiredPermission: 'ver-roles-permisos' }, // Changed icon
      { href: '/settings/license', label: 'Licencia de Aplicación', icon: KeyRound, requiredPermission: 'ver-licencia' },
      { href: '/settings/escalation-logs', label: 'Historial de Escalados', icon: AlertTriangle, requiredPermission: 'ver-logs-escalamiento' },
      { href: '/audit-log', label: 'Historial de Auditoría', icon: HistoryIcon, requiredPermission: 'ver-registro-auditoria' },
    ],
    parentActiveIf: (pathname) => ['/user-management', '/roles-and-permissions', '/settings/license', '/settings/escalation-logs', '/audit-log'].some(p => pathname.startsWith(p)),
  },
];

export const allPermissions = [
  { module: "Panel de Control", permissions: ["ver-dashboard"] },
  { module: "Ventas", permissions: ["ver-ventas"] },
  { module: "Embudo de Ventas", permissions: ["ver-pipeline"] },
  { module: "Gestión de Leads", permissions: ["ver-leads", "crear-lead", "editar-lead", "eliminar-lead", "cambiar-etapa-lead"] },
  { module: "Cotizaciones", permissions: ["ver-cotizaciones", "crear-cotizacion", "editar-cotizacion", "eliminar-cotizacion", "enviar-cotizacion"] },
  { module: "Pedidos", permissions: ["ver-pedidos", "crear-pedido", "editar-pedido", "eliminar-pedido", "cambiar-estado-pedido"] },
  { module: "Facturas", permissions: ["ver-facturas", "crear-factura", "editar-factura", "eliminar-factura", "enviar-factura"] },
  { module: "Marketing", permissions: ["ver-marketing"] },
  { module: "Asistente IA de Correo", permissions: ["usar-ai-email"] },
  { module: "Campañas de Email", permissions: ["ver-campanas-email", "crear-campana-correo", "editar-campana-correo", "eliminar-campana-correo", "enviar-campana-correo", "ver-listas-contacto", "crear-lista-contacto", "editar-lista-contacto", "eliminar-lista-contacto", "gestionar-contactos-lista", "ver-plantillas-correo", "crear-plantilla-correo", "editar-plantilla-correo", "eliminar-plantilla-correo"] },
  { module: "Automatización Marketing", permissions: ["ver-automatizaciones", "crear-automatizacion", "editar-automatizacion", "eliminar-automatizacion", "activar-automatizacion", "desactivar-automatizacion"] },
  { module: "Páginas de Aterrizaje", permissions: ["ver-paginas-aterrizaje", "crear-pagina-aterrizaje", "editar-pagina-aterrizaje", "eliminar-pagina-aterrizaje", "publicar-pagina-aterrizaje"] },
  { module: "Social CRM", permissions: ["ver-social-crm", "publicar-redes-sociales", "interactuar-publicaciones-sociales"] },
  { module: "Correo Electrónico", permissions: ["ver-correos", "enviar-correo", "redactar-correo"] },
  { module: "Colaboración y Productividad", permissions: ["ver-colaboracion"] },
  { module: "Calendario y Reuniones", permissions: ["ver-calendario", "crear-reunion", "editar-reunion", "eliminar-reunion"] },
  { module: "Registro de Actividades", permissions: ["ver-registro-actividades", "crear-actividad", "editar-actividad", "eliminar-actividad"] },
  { module: "Gestión de Documentos", permissions: ["ver-documentos", "subir-documento", "editar-documento", "eliminar-documento", "compartir-documento", "ver-plantillas-documento", "crear-plantilla-documento", "editar-plantilla-documento", "eliminar-plantilla-documento"] },
  { module: "Tareas", permissions: ["ver-tareas", "crear-tarea", "editar-tarea", "eliminar-tarea", "completar-tarea", "asignar-tarea"] },
  { module: "Soporte al Cliente", permissions: ["ver-soporte"] },
  { module: "Gestión de Tickets", permissions: ["ver-tickets", "crear-ticket", "editar-ticket", "eliminar-ticket", "asignar-ticket", "cambiar-estado-ticket", "agregar-comentario-ticket", "sugerir-articulo-kb"] },
  { module: "Base de Conocimiento", permissions: ["ver-base-conocimiento", "crear-articulo-kb", "editar-articulo-kb", "eliminar-articulo-kb"] },
  { module: "Chat en Vivo / Chatbots", permissions: ["ver-chat-vivo", "enviar-mensajes-chat", "cerrar-chat", "transferir-chat", "usar-respuestas-predefinidas"] },
  { module: "Encuestas de Satisfacción", permissions: ["ver-encuestas", "crear-encuesta", "editar-encuesta", "eliminar-encuesta", "enviar-encuesta", "ver-respuestas-encuestas"] },
  { module: "Configuración", permissions: ["acceder-configuracion"] }, // General permission for settings
  { module: "Configuración General", permissions: ["acceder-configuracion-general"] },
  { module: "Mi Cuenta de Correo", permissions: ["gestionar-cuenta-correo"] },
  { module: "Configuración Chat en Vivo", permissions: ["gestionar-configuracion-chat"] },
  { module: "Gestión de SLAs", permissions: ["gestionar-slas"] },
  { module: "Colas de Soporte", permissions: ["gestionar-colas-soporte"] },
  { module: "Reglas de Escalado", permissions: ["gestionar-reglas-escalamiento"] },
  { module: "Administración", permissions: ["ver-administracion"] },
  { module: "Gestión de Usuarios", permissions: ["ver-usuarios", "crear-usuario", "editar-usuario", "eliminar-usuario", "asignar-rol"] },
  { module: "Gestión de Roles y Permisos", permissions: ["ver-roles-permisos", "crear-rol", "editar-rol", "eliminar-rol", "asignar-permisos-rol"] }, // Adjusted
  { module: "Licencia de Aplicación", permissions: ["ver-licencia","gestionar-licencia"] },
  { module: "Historial de Escalados", permissions: ["ver-logs-escalamiento"] },
  { module: "Historial de Auditoría", permissions: ["ver-registro-auditoria"] },
];

export const USER_ROLES: UserRole[] = ['admin', 'supervisor', 'empleado', 'analista', 'desarrollador', 'vendedor', 'user'];
export const DEFAULT_USER_ROLE: UserRole = 'user';


export const INITIAL_PIPELINE_STAGES: PipelineStage[] = [
  { id: 'stage-1', name: 'Nuevo Lead', order: 1, color: 'bg-sky-500' },
  { id: 'stage-2', name: 'Contactado', order: 2, color: 'bg-blue-500' },
  { id: 'stage-3', name: 'Propuesta Enviada', order: 3, color: 'bg-amber-500' },
  { id: 'stage-4', name: 'Negociación', order: 4, color: 'bg-purple-500' },
  { id: 'stage-5', name: 'Cerrado Ganado', order: 5, color: 'bg-green-500' },
  { id: 'stage-6', name: 'Cerrado Perdido', order: 6, color: 'bg-red-500' },
];

const today = new Date();
const addDays = (date: Date, days: number) => {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result.toISOString();
};

export const INITIAL_LEADS: Lead[] = [
  {
    id: 'lead-1', name: 'Acme Corp', email: 'contact@acme.com', stageId: 'stage-1',
    createdAt: new Date().toISOString(),
    details: 'Interesado en las funciones de automatización de marketing del Producto X.', value: 5000,
    score: 75, probability: 60, expectedCloseDate: addDays(today, 30)
  },
  {
    id: 'lead-2', name: 'Beta Solutions', email: 'info@beta.inc', stageId: 'stage-2',
    createdAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
    details: 'Seguimiento del presupuesto Q2. Necesita integración personalizada.', value: 12000,
    score: 90, probability: 75, expectedCloseDate: addDays(today, 45)
  },
  {
    id: 'lead-3', name: 'Gamma Innovations LLC', email: 'sales@gamma.llc', stageId: 'stage-3',
    createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
    details: 'Propuesta enviada, esperando comentarios. Contacto clave: Jane Doe.', value: 7500,
    score: 60, probability: 50, expectedCloseDate: addDays(today, 60)
  },
  {
    id: 'lead-4', name: 'Delta Services', email: 'support@delta.com', stageId: 'stage-1',
    createdAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
    details: 'Buscando CRM para 10 usuarios.', value: 3000,
    score: 50, probability: 30, expectedCloseDate: addDays(today, 15)
  },
  {
    id: 'lead-5', name: 'Epsilon Retail', email: 'shop@epsilon.store', stageId: 'stage-4',
    createdAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
    details: 'Negociando términos para el plan empresarial.', value: 25000,
    score: 85, probability: 80, expectedCloseDate: addDays(today, 10)
  },
];

export const INITIAL_USERS: User[] = [
  { id: 'user-1', name: 'Juan Pérez', email: 'juan.perez@example.com', avatarUrl: 'https://placehold.co/100x100.png', role: 'user', createdAt: new Date().toISOString() },
  { id: 'user-2', name: 'Maria García', email: 'maria.garcia@example.com', avatarUrl: 'https://placehold.co/100x100.png', role: 'supervisor', createdAt: new Date().toISOString() },
  { id: 'user-3', name: 'Carlos Rodríguez', email: 'carlos.rodriguez@example.com', avatarUrl: 'https://placehold.co/100x100.png', role: 'admin', createdAt: new Date().toISOString() },
];

export const INITIAL_TASKS: Task[] = [
  { id: 'task-1', title: 'Llamada de seguimiento con Acme Corp', dueDate: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString(), completed: false, relatedLeadId: 'lead-1', createdAt: new Date().toISOString(), priority: 'Alta', reporterUserId: 'user-1', assigneeUserId: 'user-2' },
  { id: 'task-2', title: 'Preparar demo para Beta Solutions', dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(), completed: false, relatedLeadId: 'lead-2', createdAt: new Date().toISOString(), priority: 'Media', reporterUserId: 'user-1', assigneeUserId: 'user-1' },
  { id: 'task-3', title: 'Enviar borrador del informe Q1 a los interesados', completed: true, createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(), priority: 'Baja', dueDate: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(), reporterUserId: 'user-2' },
  { id: 'task-4', title: 'Investigar competidores de Delta Services', dueDate: new Date(Date.now() + 1 * 24 * 60 * 60 * 1000).toISOString(), completed: false, relatedLeadId: 'lead-4', createdAt: new Date().toISOString(), priority: 'Media', reporterUserId: 'user-1', assigneeUserId: 'user-1' },
];


export const TICKET_STATUSES: TicketStatus[] = ['Abierto', 'En Progreso', 'Resuelto', 'Cerrado'];
export const TICKET_PRIORITIES: TicketPriority[] = ['Alta', 'Media', 'Baja'];

export const QUOTE_STATUSES: QuoteStatus[] = ['Borrador', 'Enviada', 'Aceptada', 'Rechazada', 'Expirada'];
export const ORDER_STATUSES: OrderStatus[] = ['Pendiente', 'Procesando', 'Enviado', 'Entregado', 'Cancelado'];
export const INVOICE_STATUSES: InvoiceStatus[] = ['Borrador', 'Enviada', 'Pagada', 'Vencida', 'Cancelada'];
export const EMAIL_CAMPAIGN_STATUSES: EmailCampaignStatus[] = ['Borrador', 'Programada', 'Enviando', 'Enviada', 'Archivada', 'Fallida'];

export const PREDEFINED_EMAIL_TEMPLATES: PredefinedEmailTemplate[] = [
  {
    id: 'basic-welcome',
    name: 'Bienvenida Básica',
    description: 'Un correo simple de bienvenida para nuevos suscriptores.',
    contentHtml: `
      <div style="font-family: Arial, sans-serif; line-height: 1.6;">
        <h1>¡Bienvenido/a, {{nombre_contacto}}!</h1>
        <p>Gracias por unirte a nuestra comunidad. Estamos emocionados de tenerte con nosotros.</p>
        <p>Pronto recibirás más información y novedades.</p>
        <p>Saludos,<br/>El Equipo de {{nombre_empresa_remitente}}</p>
      </div>
    `,
  },
  {
    id: 'simple-promo',
    name: 'Promoción Simple',
    description: 'Plantilla básica para anunciar una promoción o descuento.',
    contentHtml: `
      <div style="font-family: Arial, sans-serif; line-height: 1.6; text-align: center;">
        <h1 style="color: #29ABE2;">¡Oferta Especial para Ti, {{nombre_contacto}}!</h1>
        <p>No te pierdas nuestro descuento exclusivo del <strong>20%</strong> en todos nuestros productos.</p>
        <p>Usa el código: <strong>PROMO20</strong></p>
        <p><a href="#" style="background-color: #29ABE2; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">Comprar Ahora</a></p>
        <p style="font-size: 0.9em; color: #777;">Oferta válida hasta {{fecha_fin_oferta}}.</p>
      </div>
    `,
  },
  {
    id: 'newsletter-update',
    name: 'Actualización de Newsletter',
    description: 'Estructura para un boletín informativo con un artículo principal.',
    contentHtml: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto; border: 1px solid #ddd; padding: 20px;">
        <header style="text-align: center; margin-bottom: 20px;">
          <h1 style="color: #1976D2;">{{nombre_empresa_remitente}} | Newsletter</h1>
        </header>
        <section>
          <h2>Hola {{nombre_contacto}},</h2>
          <p>Aquí tienes las últimas novedades:</p>
          <h3>{{titulo_articulo_principal}}</h3>
          <p>{{resumen_articulo_principal}}</p>
          <p><a href="{{enlace_articulo_principal}}" style="color: #1976D2;">Leer más...</a></p>
        </section>
        <footer style="text-align: center; margin-top: 30px; font-size: 0.9em; color: #777;">
          <p>&copy; ${new Date().getFullYear()} {{nombre_empresa_remitente}}. Todos los derechos reservados.</p>
          <p><a href="{{enlace_desuscripcion}}" style="color: #777;">Darse de baja</a></p>
        </footer>
      </div>
    `,
  },
];

export const COMMON_EMAIL_VARIABLES: CommonEmailVariable[] = [
  { variable: "{{nombre_contacto}}", description: "Nombre completo del contacto." },
  { variable: "{{email_contacto}}", description: "Dirección de correo electrónico del contacto." },
  { variable: "{{nombre_empresa_remitente}}", description: "Nombre de tu empresa (remitente)." },
  { variable: "{{enlace_desuscripcion}}", description: "Enlace para que el contacto se dé de baja (requiere implementación)." },
  { variable: "{{nombre_campana}}", description: "Nombre de la campaña actual." },
  { variable: "{{fecha_actual}}", description: "Fecha actual del envío." },
];

export const MEETING_STATUSES: MeetingStatus[] = ['Programada', 'Confirmada', 'Cancelada', 'Realizada', 'Pospuesta'];

export const ACTIVITY_LOG_USER_ACTIVITY_TYPES: readonly ActivityLogUserActivityType[] = ['Llamada', 'Reunión', 'Correo Enviado', 'Correo Recibido', 'Nota', 'Visita'] as const;

export const AUDIT_ACTION_TYPES: readonly ActivityLogSystemAuditActionType[] = ['create', 'update', 'delete', 'login', 'logout', 'config_change', 'access_change', 'file_upload' , 'file_download'] as const;


export const INITIAL_RESOURCES: Resource[] = [
  { id: 'room-1', name: 'Sala de Conferencias A', type: 'Sala de Reuniones', location: 'Edificio Principal, Planta 1', capacity: 10, isAvailable: true },
  { id: 'room-2', name: 'Sala de Reuniones Pequeña B', type: 'Sala de Reuniones', location: 'Edificio Anexo, Planta Baja', capacity: 4, isAvailable: true },
  { id: 'projector-1', name: 'Proyector HD (P1)', type: 'Proyector', location: 'Almacén Equipos', isAvailable: true },
  { id: 'whiteboard-1', name: 'Pizarra Digital Interactiva', type: 'Pizarra Digital', location: 'Sala de Colaboración', isAvailable: false },
  { id: 'other-1', name: 'Catering Café Mañana', type: 'Otro', description: 'Servicio de café y bollería para reuniones matutinas.', isAvailable: true },
];

export const DOCUMENT_TEMPLATE_CATEGORIES: string[] = [
  "Propuestas de Venta",
  "Contratos de Servicio",
  "Acuerdos de Confidencialidad (NDA)",
  "Facturas Proforma",
  "Cartas de Presentación",
  "Informes de Progreso",
  "Otros",
];

export const INITIAL_SLAS: SLA[] = [
    { id: 'sla-1', name: 'Estándar (8 Horas Resolución)', responseTimeTargetMinutes: 60, resolutionTimeTargetHours: 8, appliesToPriority: ['Media', 'Baja'], isEnabled: true, createdAt: new Date().toISOString(), businessHoursOnly: false },
    { id: 'sla-2', name: 'Urgente (4 Horas Resolución)', responseTimeTargetMinutes: 30, resolutionTimeTargetHours: 4, appliesToPriority: ['Alta'], businessHoursOnly: false, isEnabled: true, createdAt: new Date().toISOString() },
    { id: 'sla-3', name: 'VIP (2 Horas Respuesta)', responseTimeTargetMinutes: 120, resolutionTimeTargetHours: 24, appliesToQueues: ['q-vip'], isEnabled: true, createdAt: new Date().toISOString(), businessHoursOnly: true},
];

export const INITIAL_SUPPORT_QUEUES: SupportQueue[] = [
    { id: 'q-general', name: 'Soporte General', description: 'Cola por defecto para nuevos tickets.', memberUserIds:[], createdAt: new Date().toISOString() },
    { id: 'q-tech', name: 'Soporte Técnico', description: 'Para problemas técnicos y de producto.', defaultSlaId: 'sla-2', memberUserIds:[], createdAt: new Date().toISOString() },
    { id: 'q-billing', name: 'Consultas de Facturación', description: 'Para temas relacionados con pagos y facturas.', memberUserIds:[], createdAt: new Date().toISOString() },
    { id: 'q-vip', name: 'Soporte VIP', description: 'Atención prioritaria para clientes VIP.', defaultSlaId: 'sla-3', memberUserIds:[], createdAt: new Date().toISOString() },
];

export const ESCALATION_CONDITION_TYPES: { value: EscalationConditionType, label: string, requiresValue?: 'number' | 'priority' | 'queue' | 'string' }[] = [
  { value: 'sla_response_breached', label: 'SLA de Respuesta Incumplido' },
  { value: 'sla_resolution_breached', label: 'SLA de Resolución Incumplido' },
  { value: 'ticket_idle_for_x_hours', label: 'Ticket Inactivo por X Horas', requiresValue: 'number' },
  { value: 'ticket_priority_is', label: 'Prioridad del Ticket Es', requiresValue: 'priority'},
  { value: 'ticket_in_queue', label: 'Ticket está en Cola', requiresValue: 'queue'},
  { value: 'ticket_sentiment_is_negative', label: 'Sentimiento del Ticket es Negativo (IA - Futuro)' },
  { value: 'customer_response_pending_for_x_hours', label: 'Respuesta Cliente Pendiente por X Horas (Futuro)', requiresValue: 'number' },
];

export const ESCALATION_ACTION_TYPES: { value: EscalationActionType, label: string, targetType?: 'user' | 'group' | 'queue' | 'priority', requiresValue?: 'string' }[] = [
  { value: 'notify_user', label: 'Notificar a Usuario', targetType: 'user' },
  { value: 'notify_group', label: 'Notificar a Grupo (Futuro)', targetType: 'group' },
  { value: 'change_priority', label: 'Cambiar Prioridad del Ticket', targetType: 'priority' },
  { value: 'assign_to_user', label: 'Asignar a Usuario', targetType: 'user' },
  { value: 'assign_to_queue', label: 'Mover a Cola', targetType: 'queue' },
  { value: 'trigger_webhook', label: 'Disparar Webhook (Avanzado - Futuro)', requiresValue: 'string'},
  { value: 'create_follow_up_task', label: 'Crear Tarea de Seguimiento (Futuro)', targetType: 'user'},
];

export const INITIAL_ESCALATION_RULES: EscalationRule[] = [
  { id: 'rule-1', name: 'Escalar si ticket Alta prioridad no respondido en 1h', conditionType: 'sla_response_breached', actionType: 'notify_user', actionTargetUserId: 'user-2', order: 1, isEnabled: true, createdAt: new Date().toISOString(), description: 'Notifica al supervisor M. García si un ticket de Alta prioridad no tiene primera respuesta en 1 hora.' },
  { id: 'rule-2', name: 'Reasignar ticket inactivo > 24h', conditionType: 'ticket_idle_for_x_hours', conditionValue: 24, actionType: 'assign_to_queue', actionTargetQueueId: 'q-general', order: 2, isEnabled: true, createdAt: new Date().toISOString(), description: 'Mueve a cola General si no hay actividad en 24h.'},
];


export const SURVEY_TYPES: { value: SurveyType; label: string }[] = [
  { value: 'CSAT', label: 'Satisfacción del Cliente (CSAT)' },
  { value: 'NPS', label: 'Net Promoter Score (NPS)' },
  { value: 'Custom', label: 'Personalizada' },
];

export const SURVEY_QUESTION_TYPES: { value: SurveyQuestionType; label: string }[] = [
  { value: 'RatingScale', label: 'Escala de Calificación (ej. 1-5 estrellas)' },
  { value: 'OpenText', label: 'Pregunta Abierta (Texto)' },
  { value: 'MultipleChoice', label: 'Opción Múltiple' },
  { value: 'SingleChoice', label: 'Opción Única' },
];

export const INITIAL_KB_ARTICLES: KnowledgeBaseArticle[] = [
  {
    id: 'kb-1',
    title: '¿Cómo restablecer mi contraseña?',
    content: 'Para restablecer tu contraseña, ve a la página de inicio de sesión y haz clic en "Olvidé mi contraseña". Sigue las instrucciones...',
    category: 'Cuentas',
    tags: ['contraseña', 'resetear', 'acceso'],
    createdAt: new Date().toISOString(),
    authorId: 'system',
    visibility: 'public',
    slug: 'como-restablecer-contrasena'
  },
  {
    id: 'kb-2',
    title: 'Configuración inicial del sistema',
    content: 'Guía paso a paso para configurar el CRM por primera vez. Cubre usuarios, roles, y configuraciones básicas...',
    category: 'Configuración',
    tags: ['guía', 'inicio', 'setup'],
    createdAt: new Date().toISOString(),
    authorId: 'system',
    visibility: 'internal',
    slug: 'configuracion-inicial'
  },
  {
    id: 'kb-3',
    title: 'Solución de problemas comunes de tickets',
    content: 'Si un ticket no se actualiza, verifica que el asignado tenga los permisos correctos y que no haya reglas de escalado bloqueándolo...',
    category: 'Tickets',
    tags: ['solución', 'problemas', 'soporte'],
    createdAt: new Date().toISOString(),
    authorId: 'system',
    visibility: 'internal',
    slug: 'solucion-problemas-tickets'
  }
];
