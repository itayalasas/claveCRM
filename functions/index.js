
"use strict";

const functions = require("firebase-functions");
const admin = require("firebase-admin");
const nodemailer = require("nodemailer");
const { createEvents } = require("ics"); // For EventAttributes, it's a type, not needed in JS
const { differenceInHours, isAfter } = require("date-fns"); // format and parseISO are not used in the JS version from previous TS
// const { es } = require('date-fns/locale'); // Not used in the JS version

// Initialize Firebase Admin SDK
if (admin.apps.length === 0) {
  admin.initializeApp();
}
const db = admin.firestore();

// --- Email Settings ---
let mailTransport = null;
let defaultSenderEmail = "noreply@example.com"; // Default fallback
let defaultSenderName = "MiniCRM Express"; // Default fallback

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

    mailTransport = nodemailer.createTransport({
      host: settings.smtpHost,
      port: parseInt(settings.smtpPort || "587"),
      secure: settings.smtpSecurity === "SSL" || settings.smtpSecurity === "TLS", // secure for SSL/TLS, false for others
      auth: {
        user: settings.smtpUser,
        pass: settings.smtpPass,
      },
      ...(settings.smtpSecurity === "TLS" && {
          tls: {
              // Necessary for some environments, especially local or self-signed certs
              // For production, usually should be true or omitted if cert is valid
              rejectUnauthorized: process.env.NODE_ENV === "production",
          },
      }),
    });
    functions.logger.info("Mail transporter configurado exitosamente desde Firestore.");
    return mailTransport;
  } catch (error) {
    functions.logger.error("Error al configurar el mail transporter desde Firestore:", error);
    mailTransport = null; // Reset on error
    throw error; // Re-throw to be caught by calling function
  }
}

function personalizeContent(content, contact, campaignFromName) {
  let personalized = content;
  personalized = personalized.replace(/{{nombre_contacto}}/g, `${contact.firstName || ""} ${contact.lastName || ""}`.trim() || contact.email);
  personalized = personalized.replace(/{{email_contacto}}/g, contact.email);
  personalized = personalized.replace(/{{nombre_empresa_remitente}}/g, campaignFromName || defaultSenderName);
  // Add more common placeholders as needed
  // personalized = personalized.replace(/{{fecha_fin_oferta}}/g, campaignData.fecha_fin_oferta || "pronto");
  return personalized;
}


// --- Email Campaign Function ---
exports.sendEmailCampaign = functions.region('southamerica-west1').firestore
  .document("emailCampaigns/{campaignId}")
  .onUpdate(async (change, context) => {
    const campaignId = context.params.campaignId;
    const newData = change.after.data();
    const oldData = change.before.data();

    // Only proceed if the status is "Enviando" and it wasn't already "Enviando" (unless analytics are missing)
    if (newData.status !== "Enviando") {
      functions.logger.info(`Campaign ${campaignId}: Status is not 'Enviando'. Current status: ${newData.status}. Skipping.`);
      return null;
    }
    // Avoid re-processing if already sent or if no relevant update
    if (oldData.status === "Enviando" && newData.updatedAt.isEqual(oldData.updatedAt) && (newData.analytics?.emailsSent || 0) > 0) {
        functions.logger.info(`Campaign ${campaignId}: Already processed or no relevant update. Skipping.`);
        return null;
    }

    functions.logger.info(`Campaign ${campaignId}: Processing campaign in 'Enviando' state.`);

    try {
      const transporter = await getMailTransport(true); // Force refresh SMTP settings
      const contactListDoc = await db.collection("contactLists").doc(newData.contactListId).get();
      if (!contactListDoc.exists) throw new Error(`Contact list ${newData.contactListId} not found.`);
      
      const contactsSnapshot = await db.collection("contacts").where("listIds", "array-contains", newData.contactListId).get();
      const contactsData = contactsSnapshot.docs
        .map((doc) => ({id: doc.id, ...doc.data()}))
        .filter(contact => contact.subscribed !== false); // Filter out unsubscribed

      const totalRecipients = contactsData.length;

      // Initialize or update analytics before sending
      await db.collection("emailCampaigns").doc(campaignId).set({
        analytics: { ...newData.analytics, totalRecipients: totalRecipients, emailsSent: 0 } // Reset emailsSent for this run
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
      if (!templateDoc.exists) throw new Error(`Email template ${newData.emailTemplateId} not found.`);
      const template = templateDoc.data();

      let emailsSuccessfullySent = 0;
      const emailPromises = contactsData.map(async (contact) => {
        if (!contact.email) {
          functions.logger.warn(`Campaign ${campaignId}: Skipping contact ${contact.id} (missing email).`);
          return; // Skip if no email
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
        } catch (error) {
          functions.logger.error(`Campaign ${campaignId}: Failed to send to ${contact.email}`, error);
          // Optionally, log individual failures more robustly
        }
      });

      await Promise.all(emailPromises);

      functions.logger.info(`Campaign ${campaignId}: Finished sending. ${emailsSuccessfullySent}/${totalRecipients} emails sent successfully.`);
      const finalStatus = emailsSuccessfullySent > 0 || totalRecipients === 0 ? "Enviada" : "Fallida"; // Consider if all failed, should it be Fallida
      await db.collection("emailCampaigns").doc(campaignId).update({
        status: finalStatus,
        sentAt: admin.firestore.FieldValue.serverTimestamp(),
        "analytics.emailsSent": emailsSuccessfullySent,
        // Here you could also update delivered if your ESP gives immediate feedback, otherwise use webhooks
      });

      return null;
    } catch (error) {
      functions.logger.error(`Campaign ${campaignId}: Error processing campaign:`, error);
      try {
        await db.collection("emailCampaigns").doc(campaignId).update({
            status: "Fallida",
            "analytics.totalRecipients": newData.analytics?.totalRecipients || 0, // Preserve if available
            "analytics.emailsSent": newData.analytics?.emailsSent || 0, // Preserve if available
        });
      } catch (updateError) {
          functions.logger.error(`Campaign ${campaignId}: Error updating campaign to Fallida status:`, updateError);
      }
      return null;
    }
  });


// --- Meeting Invitation Function ---
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

    // Determine if an email should be sent
    const isNewMeeting = !change.before.exists;
    const attendeesChanged = oldMeetingData ? JSON.stringify(oldMeetingData.attendees.map(a => ({email:a.email, status:a.status})).sort()) !== JSON.stringify(meetingData.attendees.map(a => ({email:a.email, status:a.status})).sort()) : false;
    const timeChanged = oldMeetingData ? (new Date(oldMeetingData.startTime).getTime() !== new Date(meetingData.startTime).getTime() || new Date(oldMeetingData.endTime).getTime() !== new Date(meetingData.endTime).getTime()) : false;
    const statusChanged = oldMeetingData ? oldMeetingData.status !== meetingData.status : false;
    
    let shouldSend = isNewMeeting || attendeesChanged || timeChanged || (statusChanged && meetingData.status === 'Confirmada');
    
    // Specific logic for cancellations
    if (meetingData.status === 'Cancelada') {
        if (isNewMeeting || (statusChanged && oldMeetingData?.status !== meetingData.status)){
            functions.logger.info(`Meeting ${meetingId} status is ${meetingData.status}. Sending update/cancellation.`);
            // shouldSend is already true if isNewMeeting or statusChanged to confirmed.
            // If it's just a status change to Cancelada, we need to ensure it sends.
             if (statusChanged && oldMeetingData?.status !== 'Cancelada') shouldSend = true;
        } else {
             functions.logger.info(`Meeting ${meetingId} status is ${meetingData.status}. No critical changes for resend of cancellation (already cancelled or no relevant change).`);
             shouldSend = false; // Don't resend if it was already cancelled and no other critical fields changed.
        }
    } else if (meetingData.status === 'Realizada') {
        functions.logger.info(`Meeting ${meetingId} status is ${meetingData.status}. No invitation needed.`);
        shouldSend = false;
    }
    
    if (!shouldSend) {
      functions.logger.info(`Meeting ${meetingId}: No conditions met for sending/resending invitations. Skipping.`);
      return null;
    }

    functions.logger.info(`Processing meeting ${meetingId} for invitations. Status: ${meetingData.status}`);

    try {
      const transporter = await getMailTransport(true); // Force refresh SMTP
      const creatorUserDoc = await db.collection('users').doc(meetingData.createdByUserId).get();
      const creatorUser = creatorUserDoc.exists ? creatorUserDoc.data() : null;

      const organizerName = creatorUser?.name || defaultSenderName;
      const organizerEmail = creatorUser?.email || defaultSenderEmail;

      const start = new Date(meetingData.startTime); // Assume startTime is ISO string
      const end = new Date(meetingData.endTime);     // Assume endTime is ISO string
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

      const { error: icsError, value: icsFileContent } = createEvents([event]);
      if (icsError || !icsFileContent) {
        functions.logger.error(`Error creating .ics file for meeting ${meetingId}:`, icsError);
        throw new Error("Could not generate .ics file.");
      }

      const emailPromises = meetingData.attendees.map(async (attendee) => {
        const oldAttendeeData = oldMeetingData?.attendees.find(a => a.email === attendee.email);
        const attendeeStatusChanged = oldAttendeeData ? oldAttendeeData.status !== attendee.status : false;
        
        // Send if new meeting, time changed, overall status changed, or if this specific attendee wasn't there before or their status changed
        if (isNewMeeting || timeChanged || statusChanged || !oldAttendeeData || attendeeStatusChanged) {
            const subjectPrefix = meetingData.status === 'Cancelada' ? 'Cancelación: ' : (isNewMeeting || !oldAttendeeData ? 'Invitación: ' : 'Actualización: ');
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
            } catch (sendError) {
            functions.logger.error(`Meeting ${meetingId}: Failed to send invitation/update to ${attendee.email}`, sendError);
            }
        } else {
             functions.logger.info(`Meeting ${meetingId}: No change requiring re-invite for attendee ${attendee.email}`);
        }
      });

      await Promise.all(emailPromises);
      functions.logger.info(`Meeting ${meetingId}: Finished sending invitations/updates.`);
      return null;
    } catch (error) {
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
    const transporter = await getMailTransport(); // Uses potentially cached transporter
    const mailOptions = {
      from: `"${defaultSenderName} - Alertas CRM" <${defaultSenderEmail}>`,
      to: recipientEmail,
      subject: subject,
      html: htmlBody,
    };
    await transporter.sendMail(mailOptions);
    functions.logger.info(`Notification email sent to ${recipientEmail} with subject: ${subject}`);
  } catch (error) {
    functions.logger.error(`Failed to send notification email to ${recipientEmail}:`, error);
  }
}

async function logEscalationEvent(
  ticketId,
  ruleId,
  ruleName,
  conditionMet,
  actionTaken,
  details
) {
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
  } catch (error) {
    functions.logger.error("Error logging escalation event:", error);
  }
}

exports.evaluateEscalationRules = functions.region('southamerica-west1')
  .pubsub.schedule("every 10 minutes") // You can adjust the schedule
  .onRun(async (context) => {
    functions.logger.info("Starting escalation rule evaluation...");

    try {
      // 1. Fetch active escalation rules, ordered by 'order'
      const rulesSnapshot = await db.collection("escalationRules")
        .where("isEnabled", "==", true)
        .orderBy("order", "asc")
        .get();
      
      if (rulesSnapshot.empty) {
        functions.logger.info("No active escalation rules found.");
        return null;
      }
      const rules = rulesSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

      // 2. Fetch active tickets that might need escalation
      const activeTicketStatuses = ["Abierto", "En Progreso"]; // Define which statuses are considered for escalation
      const ticketsSnapshot = await db.collection("tickets")
        .where("status", "in", activeTicketStatuses)
        .get();

      if (ticketsSnapshot.empty) {
        functions.logger.info("No active tickets found to evaluate.");
        return null;
      }
      const tickets = ticketsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      
      const now = new Date();

      for (const ticket of tickets) {
        functions.logger.info(`Evaluating ticket ${ticket.id} (${ticket.title})`);
        const ticketRef = db.collection("tickets").doc(ticket.id);
        let ticketSLA = null;
        if (ticket.slaId) {
            const slaDoc = await db.collection("slas").doc(ticket.slaId).get();
            if (slaDoc.exists) ticketSLA = slaDoc.data();
        }

        for (const rule of rules) {
          // Avoid re-applying the same rule if already applied (simple check)
          if (ticket.appliedEscalationRuleIds && ticket.appliedEscalationRuleIds.includes(rule.id)) {
            // functions.logger.info(`Rule ${rule.name} already applied to ticket ${ticket.id}. Skipping.`);
            continue;
          }

          let conditionMet = false;
          let conditionDescription = "";

          // Evaluate condition
          switch (rule.conditionType) {
            case "sla_response_breached":
              if (ticketSLA && ticket.status === "Abierto" && !ticket.firstResponseAt) {
                  // Convert Firestore Timestamp to Date for comparison
                  const createdAtDate = ticket.createdAt.toDate();
                  const expectedResponseTime = new Date(createdAtDate.getTime() + ticketSLA.responseTimeTargetMinutes * 60000);
                  if (isAfter(now, expectedResponseTime)) { // from date-fns
                      conditionMet = true;
                      conditionDescription = `SLA de respuesta (${ticketSLA.responseTimeTargetMinutes} min) incumplido.`;
                  }
              }
              break;
            case "sla_resolution_breached":
              if (ticketSLA && ticket.status !== "Resuelto" && ticket.status !== "Cerrado") {
                  const createdAtDate = ticket.createdAt.toDate();
                  const expectedResolutionTime = new Date(createdAtDate.getTime() + ticketSLA.resolutionTimeTargetHours * 60 * 60000);
                  if (isAfter(now, expectedResolutionTime)) {
                      conditionMet = true;
                      conditionDescription = `SLA de resolución (${ticketSLA.resolutionTimeTargetHours} hrs) incumplido.`;
                  }
              }
              break;
            case "ticket_idle_for_x_hours":
              const idleHours = typeof rule.conditionValue === 'number' ? rule.conditionValue : parseInt(String(rule.conditionValue), 10);
              if (!isNaN(idleHours)) {
                const lastActivityDate = ticket.updatedAt ? ticket.updatedAt.toDate() : ticket.createdAt.toDate();
                if (differenceInHours(now, lastActivityDate) > idleHours) { // from date-fns
                  conditionMet = true;
                  conditionDescription = `Ticket inactivo por más de ${idleHours} horas.`;
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
            // Add more conditions here: ticket_sentiment_is_negative, customer_response_pending_for_x_hours
          }

          if (conditionMet) {
            functions.logger.info(`Rule '${rule.name}' condition met for ticket ${ticket.id}: ${conditionDescription}`);
            let actionDescription = "";
            const updateData = { updatedAt: admin.firestore.FieldValue.serverTimestamp() };
            
            // Perform action
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
                  } else {
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
              // Add more actions here: trigger_webhook, create_follow_up_task
            }
            
            // Mark rule as applied for this ticket
            updateData.appliedEscalationRuleIds = admin.firestore.FieldValue.arrayUnion(rule.id);

            if (Object.keys(updateData).length > 1) { // More than just updatedAt and appliedEscalationRuleIds
                await ticketRef.update(updateData);
                functions.logger.info(`Ticket ${ticket.id} actualizado por regla ${rule.name}. Acción: ${actionDescription}`);
            } else {
                 functions.logger.info(`Solo se ejecutó una notificación para la regla ${rule.name} en el ticket ${ticket.id}, solo se marca la regla como aplicada.`);
                 await ticketRef.update({ appliedEscalationRuleIds: admin.firestore.FieldValue.arrayUnion(rule.id) });
            }

            await logEscalationEvent(ticket.id, rule.id, rule.name, conditionDescription, actionDescription);
            break; // Stop processing more rules for this ticket in this run
          }
        }
      }
      functions.logger.info("Escalation rule evaluation finished.");
      return null;
    } catch (error) {
      functions.logger.error("Error evaluating escalation rules:", error);
      return null;
    }
  });

// --- Satisfaction Survey Function ---
exports.sendSatisfactionSurvey = functions.region('southamerica-west1').firestore
  .document("tickets/{ticketId}")
  .onUpdate(async (change, context) => {
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
      if (!reporterUserDoc.exists || !reporterUserDoc.data()?.email) {
        functions.logger.error(`Ticket ${ticketId}: Reporter user ${newData.reporterUserId} or their email not found.`);
        await db.collection("tickets").doc(ticketId).update({ satisfactionSurveySentAt: admin.firestore.FieldValue.serverTimestamp(), satisfactionComment: "Error: Email de destinatario no encontrado." });
        return null;
      }
      const reporterEmail = reporterUserDoc.data()?.email;
      const reporterName = reporterUserDoc.data()?.name || "Cliente";

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
      // const surveyTemplate = templateQuery.docs[0].data(); // Variable not used
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
      // Ensure functions.config().app.public_url is set in your Firebase environment
      // firebase functions:config:set app.public_url="https://your-app-domain.com"
      const appPublicUrl = functions.config().app?.public_url || "https://your-app-domain.com"; // Fallback
      if (appPublicUrl === "https://your-app-domain.com") {
         functions.logger.warn("La variable de entorno app.public_url no está configurada. Usando URL de placeholder para enlace de encuesta.");
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
    } catch (error) {
      functions.logger.error(`Ticket ${ticketId}: Error sending satisfaction survey:`, error);
      try {
        await db.collection("tickets").doc(ticketId).update({
             satisfactionSurveySentAt: admin.firestore.FieldValue.serverTimestamp(),
             satisfactionComment: `Error al enviar encuesta: ${String(error).substring(0,100)}`
        });
      } catch (updateError) {
          functions.logger.error(`Ticket ${ticketId}: Error updating ticket after survey send failure:`, updateError);
      }
      return null;
    }
  });

// --- Single Email Sending Function ---
// Interface for OutgoingEmail (matching src/lib/types.ts definition, but without TS syntax)
// interface OutgoingEmail {
//   to: string;
//   cc?: string;
//   bcc?: string;
//   subject: string;
//   bodyHtml: string;
//   status: 'pending' | 'sent' | 'failed';
//   createdAt: admin.firestore.FieldValue; // For server timestamp
//   sentAt?: admin.firestore.FieldValue;
//   errorMessage?: string;
//   fromName?: string; // Optional: if different from default
//   fromEmail?: string; // Optional: if different from default
// }

exports.sendSingleEmail = functions.region('southamerica-west1').firestore
  .document("outgoingEmails/{emailId}")
  .onCreate(async (snap, context) => {
    const emailId = context.params.emailId;
    const emailData = snap.data();

    functions.logger.info(`Processing email ${emailId}:`, emailData);

    if (emailData.status !== "pending") {
      functions.logger.info(`Email ${emailId} is not in 'pending' status. Current status: ${emailData.status}. Skipping.`);
      return null;
    }

    try {
      const transporter = await getMailTransport(true); // Force refresh SMTP settings

      const mailOptions = {
        from: `"${emailData.fromName || defaultSenderName}" <${emailData.fromEmail || defaultSenderEmail}>`,
        to: emailData.to,
        cc: emailData.cc,
        bcc: emailData.bcc,
        subject: emailData.subject,
        html: emailData.bodyHtml,
      };

      await transporter.sendMail(mailOptions);
      functions.logger.info(`Email ${emailId} sent successfully to ${emailData.to}.`);

      await snap.ref.update({
        status: "sent",
        sentAt: admin.firestore.FieldValue.serverTimestamp(),
      });
      return null;
    } catch (error) {
      functions.logger.error(`Error sending email ${emailId}:`, error);
      await snap.ref.update({
        status: "failed",
        errorMessage: String(error.message || error),
      });
      return null;
    }
  });

// --- Twilio Click-to-Call Function ---
// Ensure you have the Twilio Node.js library installed: npm install twilio
const twilio = require('twilio');

exports.initiateTwilioCall = functions.region('southamerica-west1').https.onRequest(async (req, res) => {
  // Enable CORS - Adjust origin for production
  res.set('Access-Control-Allow-Origin', '*');
  res.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    // Pre-flight request. Reply successfully:
    res.status(204).send('');
    return;
  }

  // 1. Validate the shared secret
  const expectedSecret = functions.config().twilio?.call_fn_secret || process.env.CALL_FN_SECRET; // Access from Firebase config or direct env
  const authorizationHeader = req.get("Authorization");
  
  let incomingSecret = null;
  if (authorizationHeader && authorizationHeader.startsWith("Bearer ")) {
    incomingSecret = authorizationHeader.split("Bearer ")[1];
  }

  if (!expectedSecret) {
    functions.logger.error("CRÍTICO: CALL_FN_SECRET (o twilio.call_fn_secret) no está configurado en el entorno de la Cloud Function.");
    res.status(500).send({ success: false, error: "Error de configuración del servidor de llamadas." });
    return;
  }

  if (incomingSecret !== expectedSecret) {
    functions.logger.warn("Acceso denegado a initiateTwilioCall: secreto inválido o faltante.");
    res.status(403).send({ success: false, error: "Forbidden: invalid secret" });
    return;
  }

  // If the secret is valid, proceed
  const { toNumber } = req.body;
  if (!toNumber) {
    res.status(400).send({ success: false, error: "El parámetro 'toNumber' es requerido." });
    return;
  }

  const accountSid = functions.config().twilio?.account_sid || process.env.TWILIO_ACCOUNT_SID;
  const authToken = functions.config().twilio?.auth_token || process.env.TWILIO_AUTH_TOKEN;
  const twilioPhoneNumber = functions.config().twilio?.phone_number || process.env.TWILIO_PHONE_NUMBER;

  if (!accountSid || !authToken || !twilioPhoneNumber) {
    functions.logger.error("Twilio credentials (account_sid, auth_token, phone_number) are not configured.");
    res.status(500).send({ success: false, error: "Error de configuración del servicio de llamadas." });
    return;
  }

  const client = twilio(accountSid, authToken);

  try {
    const call = await client.calls.create({
      // Replace with your TwiML Bin URL or a URL to your server that provides TwiML
      // For testing, you can use a simple TwiML like:
      // <?xml version="1.0" encoding="UTF-8"?><Response><Say>Conectando tu llamada.</Say></Response>
      // Create a TwiML Bin here: https://www.twilio.com/console/runtime/twiml-bins
      url: 'YOUR_TWIML_BIN_URL_OR_WEBHOOK_HERE', // Example: http://demo.twilio.com/docs/voice.xml
      to: toNumber,
      from: twilioPhoneNumber,
      // You can add a StatusCallback URL here to receive call events
      // statusCallback: 'https://YOUR_CRM_DOMAIN/twilio/events',
      // statusCallbackEvent: ['initiated', 'ringing', 'answered', 'completed'],
    });
    functions.logger.info(`Twilio call initiated to ${toNumber}. Call SID: ${call.sid}`);
    res.status(200).json({ success: true, callSid: call.sid, message: "Llamada iniciada exitosamente." });
  } catch (error) {
    functions.logger.error("Error al crear llamada con Twilio:", error);
    res.status(500).json({ success: false, error: "Error al iniciar llamada con Twilio: " + error.message });
  }
});
