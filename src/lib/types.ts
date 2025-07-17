
export type UserRole = 'admin' | 'supervisor' | 'empleado' | 'analista' | 'desarrollador' | 'vendedor' | 'user';

export interface Role {
  id: string;
  name: string;
  permissions: string[]; // O el tipo correcto para tus permisos
  // Añade cualquier otra propiedad que tengan tus documentos de rol en Firestore
}


export type FolderType = 'inbox' | 'sent' | 'pending' | 'drafts' | 'trash';




export interface Lead {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  company?: string;
  stageId: string;
  createdAt: string; // Store as ISO string for easier serialization
  details?: string;
  value?: number; // Potential deal value
  score?: number; // For lead scoring
  probability?: number; // 0-100 for sales forecast
  expectedCloseDate?: string; // ISO string for sales forecast
  tenantId?: string;
}

export interface PipelineStage {
  id:string;
  name: string;
  order: number;
  color?: string; // Optional color for the stage
}

export interface Task {
  id: string;
  title: string;
  description?: string;
  dueDate?: string; // Store as ISO string
  completed: boolean;
  relatedLeadId?: string;
  createdAt: string; // Store as ISO string
  priority?: 'Alta' | 'Media' | 'Baja';
  assigneeUserId?: string; // ID of the user assigned to the task
  reporterUserId: string; // ID of the user who reported or created the task
  solutionDescription?: string; // Description of the solution
  attachments?: { name: string, url: string }[]; // Array of attachment objects
  isMonthlyRecurring?: boolean; // For tasks that recur monthly on the first day
  tenantId?: string;
}

export type TicketStatus = 'Abierto' | 'En Progreso' | 'Resuelto' | 'Cerrado';
export type TicketPriority = 'Alta' | 'Media' | 'Baja';

// Modificar el tipo User para que 'role' sea string (el ID del rol)
export interface User {
  id: string;
  name: string;
  email: string;
  avatarUrl?: string | null; // Made nullable for consistency
  role: string; // <-- Cambiado a string (ID del rol)
  groups?: string[]; // IDs of groups the user belongs to
  createdAt?: string; // ISO string
  password?: string; // Only for initial creation, not stored in Firestore
  tenantId?: string; // ID del tenant al que pertenece el usuario primariamente
  allowedTenantIds?: string[]; // Si un usuario puede acceder a múltiples tenants
}

export interface Comment {
  id: string;
  userId: string;
  userName: string; // Denormalized for easier display
  userAvatarUrl?: string | null; // Denormalized for easier display, can be null
  text: string;
  createdAt: string; // ISO string
  attachments?: { name: string, url: string }[];
}

export interface Ticket {
  id: string;
  title: string;
  description: string;
  status: TicketStatus;
  priority: TicketPriority;
  createdAt: string; // ISO string
  updatedAt?: string; // ISO string
  reporterUserId: string; // ID of the user who created the ticket
  assigneeUserId?: string; // ID of the user assigned to the ticket
  relatedLeadId?: string | null; // Optional: link ticket to a lead
  attachments?: { name: string, url: string }[]; // Attachments for the ticket itself
  solutionDescription?: string | null; // Description of the solution provided by assignee
  solutionAttachments?: { name: string, url: string }[]; // Attachments for the solution
  slaId?: string | null; // Optional: ID of the applied SLA
  queueId?: string | null; // Optional: ID of the support queue it belongs to
  resolvedAt?: string; // ISO string, when status changed to 'Resuelto'
  closedAt?: string; // ISO string, when status changed to 'Cerrado'
  firstResponseAt?: string; // ISO string, when first comment by an agent (not reporter) was made
  satisfactionSurveySentAt?: string; // ISO string
  satisfactionRating?: number; // e.g., 1-5
  satisfactionComment?: string;
  appliedEscalationRuleIds?: string[]; // IDs of escalation rules already applied to this ticket
  comments?: Comment[]; // Embedded or fetched separately
  tenantId?: string;
}

// Sales Management Types
export type QuoteStatus = 'Borrador' | 'Enviada' | 'Aceptada' | 'Rechazada' | 'Expirada';
export type OrderStatus = 'Pendiente' | 'Procesando' | 'Enviado' | 'Entregado' | 'Cancelado';
export type InvoiceStatus = 'Borrador' | 'Enviada' | 'Pagada' | 'Vencida' | 'Cancelada';

export interface QuoteItem {
  id: string;
  description: string;
  quantity: number;
  unitPrice: number;
  total: number;
}

export interface Quote {
  id: string;
  leadId: string;
  createdAt: string;
  updatedAt?: string;
  quoteNumber: string;
  items: QuoteItem[];
  subtotal: number;
  discount?: number; // Percentage or fixed amount
  taxRate?: number; // e.g., 0.21 for 21%
  taxAmount: number;
  total: number;
  status: QuoteStatus;
  notes?: string;
  validUntil?: string; // ISO string
  preparedByUserId: string;
  tenantId?: string;
}

export interface OrderItem {
  id: string;
  description: string;
  quantity: number;
  unitPrice: number;
  total: number;
}

export interface Order {
  id: string;
  leadId: string;
  quoteId?: string | null; // Associated quote ID
  orderNumber: string;
  createdAt: string;
  updatedAt?: string;
  items: OrderItem[];
  subtotal: number;
  discount?: number;
  taxAmount: number; // Typically orders don't have taxAmount directly, it's on invoice. But can be stored if needed.
  total: number;
  status: OrderStatus;
  shippingAddress?: string;
  billingAddress?: string;
  placedByUserId: string;
  tenantId?: string;
}

export interface InvoiceItem {
  id: string;
  description: string;
  quantity: number;
  unitPrice: number;
  total: number;
}

export interface Invoice {
  id: string;
  orderId: string;
  leadId: string;
  invoiceNumber: string;
  createdAt: string; // Issue date
  updatedAt?: string;
  dueDate: string;
  items: InvoiceItem[];
  subtotal: number;
  discount?: number;
  taxRate?: number;
  taxAmount: number;
  total: number;
  status: InvoiceStatus;
  paymentMethod?: string;
  paymentDate?: string; // ISO string
  notes?: string;
  issuedByUserId: string;
  tenantId?: string;
}

// Email Campaign Types
export interface Contact {
  id: string;
  email: string;
  firstName?: string;
  lastName?: string;
  tags?: string[];
  subscribed?: boolean; // Made optional as it might not always be present
  createdAt: string; // ISO string
  listIds?: string[]; // IDs of ContactList this contact belongs to
  customFields?: Record<string, any>; // For custom data
  tenantId?: string;
}

export interface ContactList {
  id: string;
  name: string;
  description?: string;
  createdAt: string; // ISO string
  contactCount?: number; // Denormalized, can be updated via triggers
  tenantId?: string;
}

export interface EmailTemplate {
  id: string;
  name: string;
  subject: string;
  contentHtml?: string;
  contentText?: string;
  variables?: string[]; // e.g. ["{{firstName}}", "{{companyName}}"]
  createdAt: string; // ISO string
  updatedAt?: string; // ISO string
  previewImageUrl?: string; // Optional
  tenantId?: string;
}

export type EmailCampaignStatus = 'Borrador' | 'Programada' | 'Enviando' | 'Enviada' | 'Archivada' | 'Fallida';

export interface EmailCampaignAnalytics {
  totalRecipients: number;
  emailsSent: number;
  emailsDelivered?: number;
  emailsOpened?: number; // Total opens
  uniqueOpens?: number | string[];
  emailsClicked?: number; // Total clicks
  uniqueClicks?: number | string[];
  bounceCount?: number;
  unsubscribeCount?: number;
  spamReports?: number;
  deliveryRate?: number;
  openRate?: number;
  clickThroughRate?: number;
  clickToOpenRate?: number;
  unsubscribeRate?: number;
  bounceRate?: number;
}

export type ABTestWinnerCriteria = 'open_rate' | 'click_rate';

export interface ABTestConfig {
  isEnabled: boolean;
  variantBSubject?: string;
  variantBEmailTemplateId?: string;
  splitPercentage?: number; // e.g., 50 for 50/50 split
  winnerCriteria?: ABTestWinnerCriteria;
  testDurationHours?: number; // How long to run the test before deciding winner
  winningVariant?: 'A' | 'B'; // Once determined
  status?: 'running' | 'completed';
}


export interface EmailCampaign {
  id: string;
  name: string;
  subject: string; // This will be subject for Variant A if A/B test is enabled
  fromName: string;
  fromEmail: string;
  contactListId: string;
  emailTemplateId: string; // This will be template for Variant A if A/B test is enabled
  status: EmailCampaignStatus;
  scheduledAt?: string; // ISO string
  sentAt?: string | null; // ISO string
  createdAt: string; // ISO string
  updatedAt?: string; // ISO string
  analytics: EmailCampaignAnalytics;
  abTest?: ABTestConfig | null; // A/B Test configuration
  tenantId?: string;
}

// Types for new email template features
export interface PredefinedEmailTemplate {
  id: string;
  name: string;
  description: string;
  contentHtml: string;
}

export interface CommonEmailVariable {
  variable: string;
  description: string;
}

// System Settings Types
export type SMTPSecurity = 'None' | 'SSL' | 'TLS';

export interface EmailSettings {
  smtpHost: string;
  smtpPort: number;
  smtpUser?: string;
  smtpPass?: string;
  smtpSecurity: SMTPSecurity;
  defaultSenderEmail: string;
  defaultSenderName: string;
  sendRateLimit?: number; // e.g., emails per hour
}

export interface LiveChatWidgetSettings {
  widgetEnabled: boolean;
  primaryColor: string; // Hex color
  welcomeMessage: string;
  chatHeaderText?: string;
  widgetPosition: 'bottom-right' | 'bottom-left';
  // companyLogoUrl?: string; // Future
  // agentAvatarUrl?: string; // Future
}


// Collaboration and Productivity Types
export type MeetingStatus = 'Programada' | 'Confirmada' | 'Cancelada' | 'Realizada' | 'Pospuesta';

// Use a more specific type for ActivityType based on constants
export type ActivityLogUserActivityType = 'Llamada' | 'Reunión' | 'Correo Enviado' | 'Correo Recibido' | 'Nota' | 'Visita';
export type ActivityLogSystemAuditActionType = 'create' | 'update' | 'delete' | 'login' | 'logout' | 'config_change' | 'access_change' | 'file_upload' | 'file_download';

export type ActivityLogCategory = 'user_activity' | 'system_audit';

export interface ActivityLog {
  id: string;
  category: ActivityLogCategory; // Distinguishes between user-driven activities and system audit events
  type: ActivityLogUserActivityType | ActivityLogSystemAuditActionType; // Union of possible types
  subject?: string | null; // For user activities: 'Llamada de seguimiento'. For system audits: 'Lead Creado' or 'Configuración de Email Actualizada'
  details: string; // Detailed description of the activity or audit event
  timestamp: string; // ISO string - when the event occurred
  loggedByUserId: string; // User who performed the action or for whom the system performed it
  loggedByUserName?: string; // Denormalized user name

  // Fields for user_activity
  relatedLeadId?: string | null;
  relatedContactId?: string | null;
  relatedOpportunityId?: string | null;
  relatedTicketId?: string | null;
  relatedOrderId?: string | null;
  durationMinutes?: number | null; // For calls/meetings
  outcome?: string | null;

  // Fields for system_audit
  entityType?: string; // e.g., 'Lead', 'User', 'EmailSettings', 'Document'
  entityId?: string;   // ID of the affected entity
  // actionDetails?: string; // Specific details of the system action, (details field can be used)

  createdAt: string; // ISO string - when the log entry was created in Firestore
  tenantId?: string;
}


export interface Opportunity { // Added Opportunity type for relatedOpportunityId
    id: string;
    name: string;
    // Add other relevant fields for Opportunity
    tenantId?: string;
}


export interface DocumentVersion {
  version: number;
  fileURL: string;
  fileNameInStorage: string;
  uploadedAt: string; // ISO string
  uploadedByUserId: string;
  uploadedByUserName: string; // Denormalized for display
  notes?: string; // Optional notes for this specific version (general description of changes)
  fileSize: number;
  fileType: string;
  versionNotes?: string; // Specific notes for the upload event of this version
}

export type DocumentPermissionLevel = 'view' | 'edit';

export interface DocumentUserPermission {
  userId: string;
  userName: string; // Name of the user
  email: string;    // Email of the user, for avatar or contact
  avatarUrl?: string | null; // Optional avatar URL
  level: DocumentPermissionLevel;
}

export interface DocumentGroupPermission {
  groupId: string;
  groupName: string; // Name of the group
  level: DocumentPermissionLevel;
}

export interface DocumentFile {
  id: string;
  name: string; // Original file name presented to user
  fileNameInStorage: string; // Name used in Firebase Storage (e.g., with UUID/timestamp)
  fileURL: string; // Download URL from Firebase Storage for the current version
  fileType: string; // MIME type of the current version
  fileSize: number; // in bytes of the current version
  description?: string;
  tags?: string[];

  uploadedAt: string; // ISO string - upload date of the *first* version
  uploadedByUserId: string; // User who uploaded the *first* version
  uploadedByUserName: string; // Denormalized for display - user who uploaded *first* version

  lastVersionUploadedAt?: string; // ISO string - upload date of the *current* version
  lastVersionUploadedByUserId?: string; // User who uploaded the *current* version
  lastVersionUploadedByUserName?: string; // Denormalized - user who uploaded *current* version

  relatedLeadId?: string | null; // Allow null for Firestore
  relatedContactId?: string | null; // Allow null for Firestore
  relatedOpportunityId?: string | null;
  relatedOrderId?: string | null;
  relatedQuoteId?: string | null;
  relatedTicketId?: string | null;
  relatedProjectId?: string | null;

  currentVersion: number;
  versionHistory?: DocumentVersion[];

  isPublic?: boolean; // If true, fileURL can be considered a public share link
  accessKey?: string; // A unique key for more controlled sharing (future)

  permissions?: {
    users?: DocumentUserPermission[];
    groups?: DocumentGroupPermission[];
  } | null;

  basedOnTemplateId?: string | null; // ID of the DocumentTemplate used to generate this document
  templateVariablesFilled?: Record<string, string> | null; // Values used for template variables during generation
  tenantId?: string;
}

export interface DocumentTemplate {
  id: string;
  name: string;
  description?: string;
  category?: string; // e.g., "Contratos", "Propuestas de Venta", "Informes"
  content?: string; // For simple text/markdown templates. For complex, might be a link or reference to a file in storage.
  variables?: string[]; // e.g. {{lead_name}}, {{company_name}}
  createdAt: string; // ISO string
  createdByUserId: string;
  updatedAt?: string; // ISO string
  fileNameInStorage?: string | null; // If the template is a file
  fileURL?: string | null; // If the template is a file
  fileType?: string | null; // MIME type if template is a file
  tenantId?: string;
}

// LucideIcon type definition, using the renamed import
import type { LucideIcon as LucideIconType } from 'lucide-react';
export type LucideIcon = LucideIconType;

// User Group (placeholder, to be defined properly if group management is implemented)
export interface UserGroup {
    id: string;
    name: string;
    description?: string;
    memberIds?: string[]; // Array of User IDs
    tenantId?: string;
}

export interface Resource {
  id: string;
  name: string;
  type: 'Sala de Reuniones' | 'Proyector' | 'Pizarra Digital' | 'Otro';
  description?: string;
  location?: string;
  capacity?: number;
  isAvailable?: boolean; // Basic availability flag
  tenantId?: string;
}

export interface Meeting {
  id: string;
  title: string;
  description?: string;
  startTime: string; // ISO string
  endTime: string; // ISO string
  attendees: MeetingAttendee[];
  location?: string; // Can be a physical address or "Videollamada"
  conferenceLink?: string; // For online meetings
  relatedLeadId?: string | null;
  relatedTicketId?: string;
  createdByUserId: string;
  createdAt: string; // ISO string
  updatedAt?: string; // ISO string
  status: MeetingStatus;
  reminderSent?: boolean;
  resourceId?: string | null; // ID of the selected resource
  tenantId?: string;
}

export interface MeetingAttendee {
  id: string; // Can be userId or contactId or a unique ID for an external guest
  type: 'user' | 'contact' | 'external';
  name: string; // Denormalized name
  email: string; // Denormalized email
  status: 'Aceptada' | 'Rechazada' | 'Pendiente' | 'Tentativa';
}

// Live Chat Types
export interface ChatSession {
  id: string;
  visitorId: string; // Unique identifier for the visitor (e.g., cookie-based, or generated)
  visitorName?: string; // Optional: if visitor provides their name
  agentId: string | null; // User.id of the agent handling the chat
  status: 'pending' | 'active' | 'closed' | 'transferred';
  createdAt: string; // ISO string: When the chat session was initiated
  lastMessageAt: string; // ISO string: Timestamp of the last message, for sorting/activity
  initialMessage?: string; // The first message from the visitor
  currentPageUrl?: string; // The URL the visitor was on when they initiated chat
  relatedLeadId?: string | null;
  relatedContactId?: string | null;
  relatedTicketId?: string | null;
  channel?: 'web' | 'whatsapp'; // Added channel property
  tenantId?: string;
}

export interface ChatMessage {
  id: string; // Firestore auto-ID
  sessionId: string; // ID of the ChatSession this message belongs to
  senderId: string; // visitorId or User.id (for agent)
  senderName?: string; // Denormalized sender name
  senderType: 'visitor' | 'agent';
  text: string; // Message content
  timestamp: string; // ISO string (serverTimestamp on write, converted on read)
  tenantId?: string;
}

export interface CannedResponse {
  id: string;
  shortcut: string; // e.g., "/saludo"
  text: string; // The full response text
  agentId?: string; // Optional: if this response is specific to an agent
  isGlobal?: boolean; // If true, available to all agents
  tenantId?: string;
}

// Advanced Ticket Management Types
export interface SLA {
  id: string;
  name: string;
  description?: string;
  responseTimeTargetMinutes: number; // e.g., 60 minutes for first response
  resolutionTimeTargetHours: number; // e.g., 8 hours for resolution
  appliesToPriority?: TicketPriority[]; // e.g., only for 'Alta'
  appliesToQueues?: string[]; // Which queues this SLA applies to by default
  businessHoursOnly?: boolean; // Added optional for consistency
  isEnabled: boolean;
  createdAt: string; // ISO string
  updatedAt?: string; // ISO string
  tenantId?: string;
}

export interface SupportQueue {
  id: string;
  name: string;
  description?: string;
  defaultAssigneeUserId?: string | null; // Optional default agent for this queue
  defaultSlaId?: string | null; // Optional default SLA for this queue
  memberUserIds?: string[]; // Users part of this queue
  createdAt: string; // ISO string
  updatedAt?: string; // ISO string
  tenantId?: string;
}

export type EscalationConditionType =
  | 'sla_response_breached'
  | 'sla_resolution_breached'
  | 'ticket_idle_for_x_hours'
  | 'ticket_priority_is'
  | 'ticket_in_queue'
  | 'ticket_sentiment_is_negative' // Example advanced
  | 'customer_response_pending_for_x_hours'; // Example advanced

export type EscalationActionType =
  | 'notify_user'
  | 'notify_group' // Example advanced
  | 'change_priority'
  | 'assign_to_user'
  | 'assign_to_queue'
  | 'trigger_webhook' // Example advanced
  | 'create_follow_up_task'; // Example advanced


export interface EscalationRule {
  id: string;
  name: string;
  description?: string;
  conditionType: EscalationConditionType;
  conditionValue?: string | number | null;
  actionType: EscalationActionType;
  actionTargetUserId?: string | null;
  actionTargetGroupId?: string | null; // Placeholder for future group selection
  actionTargetQueueId?: string | null;
  actionTargetPriority?: TicketPriority | null;
  actionValue?: string | null; // For actions like trigger_webhook
  order: number;
  isEnabled: boolean;
  createdAt: string;
  updatedAt?: string;
  tenantId?: string;
}

export interface EscalationLog {
  id: string;
  ticketId: string;
  ruleId: string;
  ruleName: string;
  conditionMet: string;
  actionTaken: string;
  timestamp: string; // ISO string
  details?: string;
  loggedBySystem?: boolean; // Default to true if not specified
  tenantId?: string;
}


// Satisfaction Survey Types
export type SurveyType = 'CSAT' | 'NPS' | 'Custom';
export type SurveyQuestionType = 'RatingScale' | 'OpenText' | 'MultipleChoice' | 'SingleChoice';

export interface SurveyQuestion {
  id: string; // Unique within the survey template
  text: string;
  type: SurveyQuestionType;
  options?: { label: string; value: string | number }[];
  isRequired?: boolean;
  order: number;
}

export interface SurveyTemplate {
  id: string;
  name: string;
  description?: string;
  type: SurveyType;
  questions: SurveyQuestion[];
  thankYouMessage?: string;
  createdAt: string; // ISO string
  updatedAt?: string; // ISO string
  createdByUserId: string;
  isEnabled?: boolean;
  tenantId?: string;
}

export interface SurveyResponse {
  id: string; // Auto-generated by Firestore
  surveyTemplateId: string;
  ticketId?: string; // Optional if survey sent for other reasons
  // reporterUserId: string; // Or contactId/email if applicable // Use userId if internal, or store email directly for external
  userId?: string; // If linked to an internal user
  contactEmail?: string; // If for an external contact
  status: 'pending' | 'completed';
  createdAt: string; // ISO string, from serverTimestamp
  submittedAt?: string; // ISO string, when the user submits
  answers?: SurveyResponseAnswer[]; // Stored after submission
  csatScore?: number; // If CSAT survey
  npsScore?: number; // If NPS survey
  tenantId?: string;
}


export interface SurveyResponseAnswer {
  questionId: string;
  value: string | number | string[]; // string for OpenText/SingleChoice, number for Rating, string[] for MultipleChoice
}

// Knowledge Base
export interface KnowledgeBaseArticle {
  id: string;
  title: string;
  content: string; // Could be Markdown or HTML
  category?: string;
  tags?: string[];
  createdAt: string; // ISO string
  updatedAt?: string; // ISO string
  authorId: string;
  visibility: 'public' | 'internal'; // or more granular roles
  slug?: string; // For URL generation
  tenantId?: string;
}

// Application License
export interface LicenseDetailsApiResponse {
  isValid: boolean;
  productId: string; // ID of the product this license is for (should match your app's Firebase Project ID)
  productName: string;
  expiresAt?: string | null; // ISO date string
  maxUsers?: number | null; // Max concurrent users or total users, depending on your model
  terms?: string | null; // URL or text of license terms
  // Potentially other fields like featuresEnabled, customerId, etc.
}

export interface StoredLicenseInfo {
  licenseKey: string;
  lastValidatedAt: string; // ISO string of when it was last successfully validated
  status: 'Valid' | 'Invalid' | 'Expired' | 'NotChecked' | 'ApiError' | 'MismatchedProjectId';
  validationResponse?: LicenseDetailsApiResponse | null; // Store the last raw response from the validation endpoint
  projectId?: string; // Store the Firebase Project ID this license was validated against
}

// This type represents the *effective* status of the license considering all factors
// (API validation, expiry, user limits, project ID match)
export type EffectiveLicenseStatus =
  | 'pending' // Still loading or checking
  | 'valid'
  | 'invalid_key' // Key itself is reported as invalid by the server
  | 'mismatched_project_id' // Key is valid but for a different project
  | 'expired'
  | 'user_limit_exceeded'
  | 'api_error' // Error contacting license server OR error fetching user count
  | 'not_configured'; // No license info found in Firestore

// WhatsApp API Settings (Placeholder)
export interface WhatsAppApiSettings {
    phoneNumberId?: string;
    wabaId?: string; // WhatsApp Business Account ID
    accessToken?: string;
    webhookVerifyToken?: string; // Your custom verify token for the webhook
    // Potentially other provider-specific settings
}

// Email Module Types
export interface EmailMessage {
  id: string;
  threadId?: string; // For grouping conversations
  from: { name?: string; email: string };
  to: { name?: string; email: string }[];
  cc?: { name?: string; email: string }[];
  bcc?: { name?: string; email: string }[];
  subject: string;
  bodyHtml?: string;
  bodyText?: string;
  attachments?: { name: string; url: string; size?: number; type?: string }[];
  date: string; // ISO string for the original date of the email
  receivedAt?: string; // ISO string for when the email was received by the CRM system (for inbox)
  status: 'draft' | 'pending' | 'sent' | 'received' | 'archived' | 'deleted';
  isRead?: boolean;
  labels?: string[]; // e.g., "Inbox", "Sent", "Important", user-defined labels
  relatedLeadId?: string;
  relatedContactId?: string;
  relatedTicketId?: string;
  userId: string; // The CRM user this email is associated with (whose inbox/sent items it belongs to OR who sent it)
  collectionSource: 'incomingEmails' | 'outgoingEmails';
  tenantId?: string;
}

// For emails being queued for sending, before they become full EmailMessage after sending
export interface OutgoingEmail {
  id?: string; // Optional for creation, will be set by Firestore
  to: string;
  cc?: string | null; // Stored as string, parsed by function
  bcc?: string | null; // Stored as string, parsed by function
  subject: string;
  bodyHtml: string;
  status: 'pending' | 'sent' | 'failed' | 'draft'; // Added 'draft'
  createdAt: any; // Firestore FieldValue.serverTimestamp() on creation
  sentAt?: any; // Firestore FieldValue.serverTimestamp() on sent
  updatedAt?: any; // For drafts
  errorMessage?: string;
  fromName?: string;
  fromEmail?: string;
  userId: string; // ID of the CRM user initiating the send
  attachments?: { name: string; url: string; size?: number; type?: string }[]; // Added for drafts/pending
  tenantId?: string;
}

// General type for Firestore Timestamp conversion
export interface FirestoreTimestamp {
  seconds: number;
  nanoseconds: number;
  toDate: () => Date;
}
