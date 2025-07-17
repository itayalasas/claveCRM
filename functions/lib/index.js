"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.sendSatisfactionSurvey = exports.evaluateEscalationRules = exports.sendMeetingInvitation = exports.sendEmailCampaign = void 0;
const functions = __importStar(require("firebase-functions"));
const admin = __importStar(require("firebase-admin"));
const nodemailer = __importStar(require("nodemailer"));
const ics_1 = require("ics");
const date_fns_1 = require("date-fns");
// Initialize Firebase Admin SDK
if (admin.apps.length === 0) {
    admin.initializeApp();
}
const db = admin.firestore();
let mailTransport = null;
let defaultSenderEmail = "noreply@example.com";
let defaultSenderName = "MiniCRM Express";
async function getMailTransport(forceRefresh = false) {
    if (mailTransport && !forceRefresh) {
        return mailTransport;
    }
    try {
        const settingsDoc = await db.collection("settings").doc("emailConfiguration").get();
        if (!settingsDoc.exists) {
            functions.logger.error("Configuración de correo electrónico no encontrada en Firestore.");
            throw new Error("Email settings not found.");
        }
        const settings = settingsDoc.data();
        if (!settings || !settings.smtpHost || !settings.smtpPort || !settings.smtpUser || !settings.smtpPass) {
            functions.logger.error("Configuración SMTP incompleta en Firestore.", settings);
            throw new Error("Incomplete SMTP settings.");
        }
        defaultSenderEmail = settings.defaultSenderEmail || "noreply@example.com";
        defaultSenderName = settings.defaultSenderName || "MiniCRM Express";
        mailTransport = nodemailer.createTransport(Object.assign({ host: settings.smtpHost, port: parseInt(settings.smtpPort || "587"), secure: settings.smtpSecurity === "SSL" || settings.smtpSecurity === "TLS", auth: {
                user: settings.smtpUser,
                pass: settings.smtpPass,
            } }, (settings.smtpSecurity === "TLS" && {
            tls: {
                rejectUnauthorized: process.env.NODE_ENV === "production",
            },
        })));
        functions.logger.info("Mail transporter configurado exitosamente desde Firestore.");
        return mailTransport;
    }
    catch (error) {
        functions.logger.error("Error al configurar el mail transporter desde Firestore:", error);
        mailTransport = null;
        throw error;
    }
}
function personalizeContent(content, contact, campaignFromName) {
    let personalized = content;
    personalized = personalized.replace(/{{nombre_contacto}}/g, `${contact.firstName || ""} ${contact.lastName || ""}`.trim() || contact.email);
    personalized = personalized.replace(/{{email_contacto}}/g, contact.email);
    personalized = personalized.replace(/{{nombre_empresa_remitente}}/g, campaignFromName || defaultSenderName);
    return personalized;
}
exports.sendEmailCampaign = functions.region('southamerica-west1').firestore
    .document("emailCampaigns/{campaignId}")
    .onUpdate(async (change, context) => {
    var _a, _b, _c;
    const campaignId = context.params.campaignId;
    const newData = change.after.data();
    const oldData = change.before.data();
    if (newData.status !== "Enviando") {
        functions.logger.info(`Campaign ${campaignId}: Status is not 'Enviando'. Current status: ${newData.status}. Skipping.`);
        return null;
    }
    if (oldData.status === "Enviando" && newData.updatedAt === oldData.updatedAt && (((_a = newData.analytics) === null || _a === void 0 ? void 0 : _a.emailsSent) || 0) > 0) {
        functions.logger.info(`Campaign ${campaignId}: Already processed or no relevant update. Skipping.`);
        return null;
    }
    functions.logger.info(`Campaign ${campaignId}: Processing campaign in 'Enviando' state.`);
    try {
        const transporter = await getMailTransport(true);
        const contactListDoc = await db.collection("contactLists").doc(newData.contactListId).get();
        if (!contactListDoc.exists)
            throw new Error(`Contact list ${newData.contactListId} not found.`);
        const contactsSnapshot = await db.collection("contacts").where("listIds", "array-contains", newData.contactListId).get();
        const contactsData = contactsSnapshot.docs
            .map((doc) => (Object.assign({ id: doc.id }, doc.data())))
            .filter(contact => contact.subscribed !== false);
        const totalRecipients = contactsData.length;
        await db.collection("emailCampaigns").doc(campaignId).set({
            analytics: Object.assign(Object.assign({}, newData.analytics), { totalRecipients: totalRecipients, emailsSent: 0 })
        }, { merge: true });
        if (totalRecipients === 0) {
            functions.logger.info(`Campaign ${campaignId}: No subscribed contacts. Marking as sent.`);
            await db.collection("emailCampaigns").doc(campaignId).update({
                status: "Enviada",
                sentAt: admin.firestore.FieldValue.serverTimestamp(),
                "analytics.totalRecipients": 0,
                "analytics.emailsSent": 0,
            });
            return null;
        }
        const templateDoc = await db.collection("emailTemplates").doc(newData.emailTemplateId).get();
        if (!templateDoc.exists)
            throw new Error(`Email template ${newData.emailTemplateId} not found.`);
        const template = templateDoc.data();
        let emailsSuccessfullySent = 0;
        const emailPromises = contactsData.map(async (contact) => {
            if (!contact.email) {
                functions.logger.warn(`Campaign ${campaignId}: Skipping contact ${contact.id} (missing email).`);
                return;
            }
            const personalizedHtml = personalizeContent(template.contentHtml || "", contact, newData.fromName);
            const mailOptions = {
                from: `"${newData.fromName || defaultSenderName}" <${newData.fromEmail || defaultSenderEmail}>`,
                to: contact.email,
                subject: newData.subject,
                html: personalizedHtml,
            };
            try {
                await transporter.sendMail(mailOptions);
                emailsSuccessfullySent++;
                functions.logger.info(`Campaign ${campaignId}: Email sent to ${contact.email}`);
            }
            catch (error) {
                functions.logger.error(`Campaign ${campaignId}: Failed to send to ${contact.email}`, error);
            }
        });
        await Promise.all(emailPromises);
        functions.logger.info(`Campaign ${campaignId}: Finished sending. ${emailsSuccessfullySent}/${totalRecipients} emails sent successfully.`);
        const finalStatus = emailsSuccessfullySent > 0 || totalRecipients === 0 ? "Enviada" : "Fallida";
        await db.collection("emailCampaigns").doc(campaignId).update({
            status: finalStatus,
            sentAt: admin.firestore.FieldValue.serverTimestamp(),
            "analytics.emailsSent": emailsSuccessfullySent,
        });
        return null;
    }
    catch (error) {
        functions.logger.error(`Campaign ${campaignId}: Error processing campaign:`, error);
        try {
            await db.collection("emailCampaigns").doc(campaignId).update({
                status: "Fallida",
                "analytics.totalRecipients": ((_b = newData.analytics) === null || _b === void 0 ? void 0 : _b.totalRecipients) || 0,
                "analytics.emailsSent": ((_c = newData.analytics) === null || _c === void 0 ? void 0 : _c.emailsSent) || 0,
            });
        }
        catch (updateError) {
            functions.logger.error(`Campaign ${campaignId}: Error updating campaign to Fallida status:`, updateError);
        }
        return null;
    }
});
exports.sendMeetingInvitation = functions.region('southamerica-west1').firestore
    .document('meetings/{meetingId}')
    .onWrite(async (change, context) => {
    const meetingId = context.params.meetingId;
    const meetingData = change.after.exists ? change.after.data() : null;
    const oldMeetingData = change.before.exists ? change.before.data() : null;
    if (!meetingData) {
        functions.logger.info(`Meeting ${meetingId} deleted. No action taken.`);
        return null;
    }
    const isNewMeeting = !change.before.exists;
    const attendeesChanged = oldMeetingData ? JSON.stringify(oldMeetingData.attendees.map(a => ({ email: a.email, status: a.status })).sort()) !== JSON.stringify(meetingData.attendees.map(a => ({ email: a.email, status: a.status })).sort()) : false;
    const timeChanged = oldMeetingData ? (oldMeetingData.startTime !== meetingData.startTime || oldMeetingData.endTime !== meetingData.endTime) : false;
    const statusChanged = oldMeetingData ? oldMeetingData.status !== meetingData.status : false;
    let shouldSend = isNewMeeting || attendeesChanged || timeChanged || (statusChanged && meetingData.status === 'Confirmada');
    if (meetingData.status === 'Cancelada' || meetingData.status === 'Realizada') {
        if (isNewMeeting || (statusChanged && (oldMeetingData === null || oldMeetingData === void 0 ? void 0 : oldMeetingData.status) !== meetingData.status)) {
            functions.logger.info(`Meeting ${meetingId} status is ${meetingData.status}. Sending update/cancellation.`);
        }
        else {
            functions.logger.info(`Meeting ${meetingId} status is ${meetingData.status}. No critical changes for resend.`);
            shouldSend = false;
        }
    }
    if (!shouldSend) {
        functions.logger.info(`Meeting ${meetingId}: No conditions met for sending/resending invitations. Skipping.`);
        return null;
    }
    functions.logger.info(`Processing meeting ${meetingId} for invitations. Status: ${meetingData.status}`);
    try {
        const transporter = await getMailTransport(true);
        const creatorUserDoc = await db.collection('users').doc(meetingData.createdByUserId).get();
        const creatorUser = creatorUserDoc.exists ? creatorUserDoc.data() : null;
        const organizerName = (creatorUser === null || creatorUser === void 0 ? void 0 : creatorUser.name) || defaultSenderName;
        const organizerEmail = (creatorUser === null || creatorUser === void 0 ? void 0 : creatorUser.email) || defaultSenderEmail;
        const start = new Date(meetingData.startTime);
        const end = new Date(meetingData.endTime);
        const durationMillis = end.getTime() - start.getTime();
        const durationHours = Math.floor(durationMillis / (1000 * 60 * 60));
        const durationMinutes = Math.floor((durationMillis % (1000 * 60 * 60)) / (1000 * 60));
        const event = {
            start: [start.getUTCFullYear(), start.getUTCMonth() + 1, start.getUTCDate(), start.getUTCHours(), start.getUTCMinutes()],
            duration: { hours: durationHours, minutes: durationMinutes },
            title: meetingData.title,
            description: meetingData.description || '',
            location: meetingData.location || '',
            url: meetingData.conferenceLink || '',
            status: meetingData.status === 'Cancelada' ? 'CANCELLED' : (meetingData.status === 'Confirmada' || meetingData.status === 'Realizada' ? 'CONFIRMED' : 'TENTATIVE'),
            organizer: { name: organizerName, email: organizerEmail },
            attendees: meetingData.attendees.map(att => ({
                name: att.name,
                email: att.email,
                rsvp: att.status === 'Aceptada',
                partstat: att.status === 'Aceptada' ? 'ACCEPTED' : att.status === 'Rechazada' ? 'DECLINED' : att.status === 'Tentativa' ? 'TENTATIVE' : 'NEEDS-ACTION',
                role: 'REQ-PARTICIPANT'
            }))
        };
        const { error: icsError, value: icsFileContent } = (0, ics_1.createEvents)([event]);
        if (icsError || !icsFileContent) {
            functions.logger.error(`Error creating .ics file for meeting ${meetingId}:`, icsError);
            throw new Error("Could not generate .ics file.");
        }
        const emailPromises = meetingData.attendees.map(async (attendee) => {
            const oldAttendeeData = oldMeetingData === null || oldMeetingData === void 0 ? void 0 : oldMeetingData.attendees.find(a => a.email === attendee.email);
            const attendeeStatusChanged = oldAttendeeData ? oldAttendeeData.status !== attendee.status : false;
            if (isNewMeeting || timeChanged || statusChanged || !oldAttendeeData || attendeeStatusChanged) {
                const subjectPrefix = meetingData.status === 'Cancelada' ? 'Cancelación: ' : (isNewMeeting || !oldMeetingData ? 'Invitación: ' : 'Actualización: ');
                const mailOptions = {
                    from: `"${organizerName}" <${organizerEmail}>`,
                    to: attendee.email,
                    subject: `${subjectPrefix}${meetingData.title}`,
                    html: `
                <p>Hola ${attendee.name},</p>
                <p>Estás ${meetingData.status === 'Cancelada' ? 'notificado/a de la cancelación de' : 'invitado/a a'} la reunión: <strong>${meetingData.title}</strong>.</p>
                ${meetingData.description ? `<p>Detalles: ${meetingData.description}</p>` : ''}
                <p><strong>Cuándo:</strong> ${start.toLocaleString('es-ES', { timeZone: 'UTC' })} - ${end.toLocaleString('es-ES', { timeZone: 'UTC' })} (UTC)</p>
                ${meetingData.location ? `<p><strong>Dónde:</strong> ${meetingData.location}</p>` : ''}
                ${meetingData.conferenceLink ? `<p><strong>Enlace:</strong> <a href="${meetingData.conferenceLink}">${meetingData.conferenceLink}</a></p>` : ''}
                <p>Por favor, añade este evento a tu calendario.</p>
                <p>Saludos,<br/>${organizerName}</p>
            `,
                    icalEvent: {
                        filename: 'invite.ics',
                        method: meetingData.status === 'Cancelada' ? 'CANCEL' : 'REQUEST',
                        content: icsFileContent
                    }
                };
                try {
                    await transporter.sendMail(mailOptions);
                    functions.logger.info(`Meeting ${meetingId}: Invitation/Update sent to ${attendee.email}`);
                }
                catch (sendError) {
                    functions.logger.error(`Meeting ${meetingId}: Failed to send invitation/update to ${attendee.email}`, sendError);
                }
            }
            else {
                functions.logger.info(`Meeting ${meetingId}: No change requiring re-invite for attendee ${attendee.email}`);
            }
        });
        await Promise.all(emailPromises);
        functions.logger.info(`Meeting ${meetingId}: Finished sending invitations/updates.`);
        return null;
    }
    catch (error) {
        functions.logger.error(`Meeting ${meetingId}: Error processing invitations:`, error);
        return null;
    }
});
// --- Escalation Rule Functions ---
async function sendNotificationEmail(recipientEmail, subject, htmlBody) {
    if (!recipientEmail) {
        functions.logger.warn("No recipient email provided for notification.");
        return;
    }
    try {
        const transporter = await getMailTransport();
        const mailOptions = {
            from: `"${defaultSenderName} - Alertas CRM" <${defaultSenderEmail}>`,
            to: recipientEmail,
            subject: subject,
            html: htmlBody,
        };
        await transporter.sendMail(mailOptions);
        functions.logger.info(`Notification email sent to ${recipientEmail} with subject: ${subject}`);
    }
    catch (error) {
        functions.logger.error(`Failed to send notification email to ${recipientEmail}:`, error);
    }
}
async function logEscalationEvent(ticketId, ruleId, ruleName, conditionMet, actionTaken, details) {
    try {
        await db.collection("escalationLogs").add({
            ticketId,
            ruleId,
            ruleName,
            conditionMet,
            actionTaken,
            timestamp: admin.firestore.FieldValue.serverTimestamp(),
            details: details || "",
        });
        functions.logger.info(`Escalation logged for ticket ${ticketId}, rule ${ruleName}.`);
    }
    catch (error) {
        functions.logger.error("Error logging escalation event:", error);
    }
}
exports.evaluateEscalationRules = functions.region('southamerica-west1')
    .pubsub.schedule("every 10 minutes")
    .onRun(async (context) => {
    var _a;
    functions.logger.info("Starting escalation rule evaluation...");
    try {
        const rulesSnapshot = await db.collection("escalationRules")
            .where("isEnabled", "==", true)
            .orderBy("order", "asc")
            .get();
        if (rulesSnapshot.empty) {
            functions.logger.info("No active escalation rules found.");
            return null;
        }
        const rules = rulesSnapshot.docs.map(doc => (Object.assign({ id: doc.id }, doc.data())));
        const activeTicketStatuses = ["Abierto", "En Progreso"];
        const ticketsSnapshot = await db.collection("tickets")
            .where("status", "in", activeTicketStatuses)
            .get();
        if (ticketsSnapshot.empty) {
            functions.logger.info("No active tickets found to evaluate.");
            return null;
        }
        const tickets = ticketsSnapshot.docs.map(doc => (Object.assign({ id: doc.id }, doc.data())));
        const now = new Date();
        for (const ticket of tickets) {
            functions.logger.info(`Evaluating ticket ${ticket.id} (${ticket.title})`);
            const ticketRef = db.collection("tickets").doc(ticket.id);
            let ticketSLA = null;
            if (ticket.slaId) {
                const slaDoc = await db.collection("slas").doc(ticket.slaId).get();
                if (slaDoc.exists)
                    ticketSLA = slaDoc.data();
            }
            for (const rule of rules) {
                if ((_a = ticket.appliedEscalationRuleIds) === null || _a === void 0 ? void 0 : _a.includes(rule.id)) {
                    continue;
                }
                let conditionMet = false;
                let conditionDescription = "";
                switch (rule.conditionType) {
                    case "sla_response_breached":
                        if (ticketSLA && ticket.status === "Abierto" && !ticket.firstResponseAt) {
                            const createdAtDate = ticket.createdAt.toDate();
                            const expectedResponseTime = new Date(createdAtDate.getTime() + ticketSLA.responseTimeTargetMinutes * 60000);
                            if ((0, date_fns_1.isAfter)(now, expectedResponseTime)) {
                                conditionMet = true;
                                conditionDescription = `SLA de respuesta (${ticketSLA.responseTimeTargetMinutes} min) incumplido.`;
                            }
                        }
                        break;
                    case "sla_resolution_breached":
                        if (ticketSLA && ticket.status !== "Resuelto" && ticket.status !== "Cerrado") {
                            const createdAtDate = ticket.createdAt.toDate();
                            const expectedResolutionTime = new Date(createdAtDate.getTime() + ticketSLA.resolutionTimeTargetHours * 60 * 60000);
                            if ((0, date_fns_1.isAfter)(now, expectedResolutionTime)) {
                                conditionMet = true;
                                conditionDescription = `SLA de resolución (${ticketSLA.resolutionTimeTargetHours} hrs) incumplido.`;
                            }
                        }
                        break;
                    case "ticket_idle_for_x_hours":
                        const idleHours = typeof rule.conditionValue === 'number' ? rule.conditionValue : parseInt(String(rule.conditionValue), 10);
                        if (!isNaN(idleHours) && ticket.updatedAt) {
                            const updatedAtDate = ticket.updatedAt.toDate();
                            if ((0, date_fns_1.differenceInHours)(now, updatedAtDate) > idleHours) {
                                conditionMet = true;
                                conditionDescription = `Ticket inactivo por más de ${idleHours} horas.`;
                            }
                        }
                        else if (!isNaN(idleHours) && !ticket.updatedAt) {
                            const createdAtDate = ticket.createdAt.toDate();
                            if ((0, date_fns_1.differenceInHours)(now, createdAtDate) > idleHours) {
                                conditionMet = true;
                                conditionDescription = `Ticket inactivo (basado en creación) por más de ${idleHours} horas.`;
                            }
                        }
                        break;
                    case "ticket_priority_is":
                        if (ticket.priority === rule.conditionValue) {
                            conditionMet = true;
                            conditionDescription = `Prioridad del ticket es '${rule.conditionValue}'.`;
                        }
                        break;
                    case "ticket_in_queue":
                        if (ticket.queueId === rule.conditionValue) {
                            conditionMet = true;
                            conditionDescription = `Ticket está en la cola ID '${rule.conditionValue}'.`;
                        }
                        break;
                }
                if (conditionMet) {
                    functions.logger.info(`Rule '${rule.name}' condition met for ticket ${ticket.id}: ${conditionDescription}`);
                    let actionDescription = "";
                    const updateData = { updatedAt: admin.firestore.FieldValue.serverTimestamp() };
                    switch (rule.actionType) {
                        case "notify_user":
                            if (rule.actionTargetUserId) {
                                const userDoc = await db.collection("users").doc(rule.actionTargetUserId).get();
                                if (userDoc.exists) {
                                    const userToNotify = userDoc.data();
                                    const subject = `Alerta de Escalado CRM: Ticket #${ticket.id} - ${ticket.title}`;
                                    const body = `
                      <p>Hola ${userToNotify.name},</p>
                      <p>El ticket <strong>#${ticket.id} (${ticket.title})</strong> ha sido escalado debido a la regla: "${rule.name}".</p>
                      <p>Condición cumplida: ${conditionDescription}</p>
                      <p>Por favor, revisa el ticket en el CRM.</p>
                      <p>Gracias,<br/>Sistema CRM Rápido</p>
                    `;
                                    await sendNotificationEmail(userToNotify.email, subject, body);
                                    actionDescription = `Notificado al usuario: ${userToNotify.name} (${userToNotify.email})`;
                                }
                                else {
                                    actionDescription = `Usuario objetivo ${rule.actionTargetUserId} para notificación no encontrado.`;
                                    functions.logger.warn(actionDescription);
                                }
                            }
                            break;
                        case "change_priority":
                            if (rule.actionTargetPriority) {
                                updateData.priority = rule.actionTargetPriority;
                                actionDescription = `Prioridad cambiada a: ${rule.actionTargetPriority}`;
                            }
                            break;
                        case "assign_to_user":
                            if (rule.actionTargetUserId) {
                                updateData.assigneeUserId = rule.actionTargetUserId;
                                const userDoc = await db.collection("users").doc(rule.actionTargetUserId).get();
                                const userName = userDoc.exists ? userDoc.data().name : rule.actionTargetUserId;
                                actionDescription = `Asignado al usuario: ${userName}`;
                            }
                            break;
                        case "assign_to_queue":
                            if (rule.actionTargetQueueId) {
                                updateData.queueId = rule.actionTargetQueueId;
                                actionDescription = `Movido a la cola ID: ${rule.actionTargetQueueId}`;
                            }
                            break;
                    }
                    updateData.appliedEscalationRuleIds = admin.firestore.FieldValue.arrayUnion(rule.id);
                    if (Object.keys(updateData).length > 1) {
                        await ticketRef.update(updateData);
                        functions.logger.info(`Ticket ${ticket.id} actualizado por regla ${rule.name}. Acción: ${actionDescription}`);
                    }
                    else {
                        functions.logger.info(`Solo se ejecutó una notificación para la regla ${rule.name} en el ticket ${ticket.id}, no se requieren cambios en el ticket más allá de marcar la regla como aplicada.`);
                        await ticketRef.update({ appliedEscalationRuleIds: admin.firestore.FieldValue.arrayUnion(rule.id) });
                    }
                    await logEscalationEvent(ticket.id, rule.id, rule.name, conditionDescription, actionDescription);
                    break;
                }
            }
        }
        functions.logger.info("Escalation rule evaluation finished.");
        return null;
    }
    catch (error) {
        functions.logger.error("Error evaluating escalation rules:", error);
        return null;
    }
});
// --- Satisfaction Survey Function ---
exports.sendSatisfactionSurvey = functions.region('southamerica-west1').firestore
    .document("tickets/{ticketId}")
    .onUpdate(async (change, context) => {
    var _a, _b, _c, _d;
    const ticketId = context.params.ticketId;
    const newData = change.after.data();
    const oldData = change.before.data();
    const shouldSendSurvey = (newData.status === 'Resuelto' || newData.status === 'Cerrado') &&
        (oldData.status !== 'Resuelto' && oldData.status !== 'Cerrado') &&
        !newData.satisfactionSurveySentAt;
    if (!shouldSendSurvey) {
        functions.logger.info(`Ticket ${ticketId}: Conditions not met for sending survey. Status: ${newData.status}, Already sent: ${!!newData.satisfactionSurveySentAt}`);
        return null;
    }
    functions.logger.info(`Ticket ${ticketId}: Conditions met. Preparing to send satisfaction survey.`);
    try {
        // 1. Get Reporter's Email
        const reporterUserDoc = await db.collection("users").doc(newData.reporterUserId).get();
        if (!reporterUserDoc.exists || !((_a = reporterUserDoc.data()) === null || _a === void 0 ? void 0 : _a.email)) {
            functions.logger.error(`Ticket ${ticketId}: Reporter user ${newData.reporterUserId} or their email not found.`);
            // Optionally update ticket to indicate survey could not be sent
            await db.collection("tickets").doc(ticketId).update({ satisfactionSurveySentAt: admin.firestore.FieldValue.serverTimestamp(), satisfactionComment: "Error: Email de destinatario no encontrado." });
            return null;
        }
        const reporterEmail = (_b = reporterUserDoc.data()) === null || _b === void 0 ? void 0 : _b.email;
        const reporterName = ((_c = reporterUserDoc.data()) === null || _c === void 0 ? void 0 : _c.name) || "Cliente";
        // 2. Get a CSAT Survey Template
        const templateQuery = await db.collection("surveyTemplates")
            .where("type", "==", "CSAT")
            .where("isEnabled", "==", true)
            .limit(1)
            .get();
        if (templateQuery.empty) {
            functions.logger.error(`Ticket ${ticketId}: No active CSAT survey template found.`);
            await db.collection("tickets").doc(ticketId).update({ satisfactionSurveySentAt: admin.firestore.FieldValue.serverTimestamp(), satisfactionComment: "Error: Plantilla de encuesta no encontrada." });
            return null;
        }
        const surveyTemplate = templateQuery.docs[0].data();
        const surveyTemplateId = templateQuery.docs[0].id;
        // 3. Create a Survey Response Document
        const surveyResponseRef = db.collection("surveyResponses").doc(); // Auto-generate ID
        const newSurveyResponse = {
            surveyTemplateId: surveyTemplateId,
            ticketId: ticketId,
            reporterUserId: newData.reporterUserId,
            status: 'pending',
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
        };
        await surveyResponseRef.set(newSurveyResponse);
        const surveyResponseId = surveyResponseRef.id;
        // 4. Construct Survey Link
        const appPublicUrl = ((_d = functions.config().app) === null || _d === void 0 ? void 0 : _d.public_url) || "https://your-app-domain.com"; // Fallback if not set
        if (appPublicUrl === "https://your-app-domain.com") {
            functions.logger.warn("La variable de entorno app.public_url no está configurada. Usando URL de placeholder.");
        }
        const surveyLink = `${appPublicUrl}/survey/${surveyResponseId}`;
        // 5. Compose Email
        const emailSubject = `Valoramos tu opinión sobre el ticket: ${newData.title}`;
        const emailBody = `
        <p>Hola ${reporterName},</p>
        <p>Hemos resuelto tu ticket de soporte: "${newData.title}".</p>
        <p>Nos gustaría conocer tu opinión sobre la atención recibida. Por favor, tómate un momento para completar nuestra breve encuesta de satisfacción:</p>
        <p><a href="${surveyLink}" style="padding: 10px 15px; background-color: #29ABE2; color: white; text-decoration: none; border-radius: 5px;">Completar Encuesta</a></p>
        <p>Tu feedback es muy importante para nosotros.</p>
        <p>Gracias,<br/>El equipo de ${defaultSenderName}</p>
      `;
        // 6. Send Email
        const transporter = await getMailTransport();
        await transporter.sendMail({
            from: `"${defaultSenderName}" <${defaultSenderEmail}>`,
            to: reporterEmail,
            subject: emailSubject,
            html: emailBody,
        });
        functions.logger.info(`Ticket ${ticketId}: Satisfaction survey email sent to ${reporterEmail}. Response ID: ${surveyResponseId}`);
        // 7. Update Ticket
        await db.collection("tickets").doc(ticketId).update({
            satisfactionSurveySentAt: admin.firestore.FieldValue.serverTimestamp(),
        });
        return null;
    }
    catch (error) {
        functions.logger.error(`Ticket ${ticketId}: Error sending satisfaction survey:`, error);
        try {
            // Attempt to mark that sending failed to prevent retries for this specific error
            await db.collection("tickets").doc(ticketId).update({
                satisfactionSurveySentAt: admin.firestore.FieldValue.serverTimestamp(),
                satisfactionComment: `Error al enviar encuesta: ${String(error).substring(0, 100)}`
            });
        }
        catch (updateError) {
            functions.logger.error(`Ticket ${ticketId}: Error updating ticket after survey send failure:`, updateError);
        }
        return null;
    }
});
//# sourceMappingURL=index.js.map