// EmailGeneration.ts
'use server';
/**
 * @fileOverview This file defines a Genkit flow for generating personalized email drafts for leads.
 *
 * - generateEmailDraft - A function that takes lead information and generates an email draft.
 * - EmailDraftInput - The input type for the generateEmailDraft function.
 * - EmailDraftOutput - The return type for the generateEmailDraft function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const EmailDraftInputSchema = z.object({
  leadName: z.string().describe('El nombre del cliente potencial.'),
  leadDetails: z.string().describe('Detalles sobre el cliente potencial y su empresa.'),
  salesAgentName: z.string().describe('El nombre del agente de ventas.'),
  companyName: z.string().describe('El nombre de la empresa del agente.'),
  companyDescription: z.string().describe('Breve descripción de la empresa del agente.'),
  emailPurpose: z.string().describe('El propósito del correo electrónico.'),
});
export type EmailDraftInput = z.infer<typeof EmailDraftInputSchema>;

const EmailDraftOutputSchema = z.object({
  emailDraft: z.string().describe('El borrador de correo electrónico generado.'),
});
export type EmailDraftOutput = z.infer<typeof EmailDraftOutputSchema>;

export async function generateEmailDraft(input: EmailDraftInput): Promise<EmailDraftOutput> {
  return generateEmailDraftFlow(input);
}

const generateEmailPrompt = ai.definePrompt({
  name: 'generateEmailPrompt',
  input: {schema: EmailDraftInputSchema},
  output: {schema: EmailDraftOutputSchema},
  prompt: `Eres un asistente de correo electrónico IA diseñado para generar borradores de correos personalizados para agentes de ventas.

  Basándote en la información proporcionada, crea un borrador de correo electrónico que el agente de ventas pueda usar para comunicarse con el cliente potencial.

  Nombre del Cliente Potencial: {{{leadName}}}
  Detalles del Cliente Potencial: {{{leadDetails}}}
  Nombre del Agente de Ventas: {{{salesAgentName}}}
  Nombre de la Empresa: {{{companyName}}}
  Descripción de la Empresa: {{{companyDescription}}}
  Propósito del Correo: {{{emailPurpose}}}
  
  Borrador del Correo:`,
});

const generateEmailDraftFlow = ai.defineFlow(
  {
    name: 'generateEmailDraftFlow',
    inputSchema: EmailDraftInputSchema,
    outputSchema: EmailDraftOutputSchema,
  },
  async input => {
    const {output} = await generateEmailPrompt(input);
    return output!;
  }
);
