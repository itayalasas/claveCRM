'use server';
/**
 * @fileOverview This file defines a Genkit flow for comparing two versions of a document.
 *
 * - compareDocumentVersions - A function that takes the content of two document versions and determines if they are different.
 * - DocumentComparisonInput - The input type for the compareDocumentVersions function.
 * - DocumentComparisonOutput - The return type for the compareDocumentVersions function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const DocumentComparisonInputSchema = z.object({
  currentDocumentText: z.string().describe('El contenido textual de la versión actual del documento.'),
  newDocumentText: z.string().describe('El contenido textual de la nueva versión del documento que se está subiendo.'),
});
export type DocumentComparisonInput = z.infer<typeof DocumentComparisonInputSchema>;

const DocumentComparisonOutputSchema = z.object({
  areDifferent: z.boolean().describe('Verdadero si la nueva versión del documento es sustancialmente diferente de la versión actual, falso en caso contrario.'),
  differenceSummary: z.string().describe('Un breve resumen de las diferencias clave si las hay. Vacío si no se encuentran diferencias sustanciales o si la comparación no es concluyente para contenido no textual.'),
});
export type DocumentComparisonOutput = z.infer<typeof DocumentComparisonOutputSchema>;

export async function compareDocumentVersions(input: DocumentComparisonInput): Promise<DocumentComparisonOutput> {
  return compareDocumentVersionsFlow(input);
}

const comparisonPrompt = ai.definePrompt({
  name: 'compareDocumentVersionsPrompt',
  input: {schema: DocumentComparisonInputSchema},
  output: {schema: DocumentComparisonOutputSchema},
  prompt: `Eres un asistente de IA que compara dos versiones de un documento de texto y determina si son sustancialmente diferentes.
Proporciona también un breve resumen de las diferencias clave encontradas.

Si los documentos son muy similares (por ejemplo, solo cambios menores de formato, corrección de erratas o unas pocas palabras cambiadas sin alterar el significado central), considéralos NO sustancialmente diferentes.
Si el mensaje central, la estructura o porciones significativas del contenido han cambiado, considéralos sustancialmente diferentes.

Contenido del Documento Actual:
\`\`\`
{{{currentDocumentText}}}
\`\`\`

Contenido del Nuevo Documento:
\`\`\`
{{{newDocumentText}}}
\`\`\`

Basándote en esta comparación, ¿son los documentos sustancialmente diferentes? Proporciona un resumen de las diferencias.
Si no puedes determinar con confianza las diferencias (por ejemplo, si el contenido no es principalmente texto o es demasiado corto), responde con 'areDifferent: false' y un resumen vacío.
`,
});

const compareDocumentVersionsFlow = ai.defineFlow(
  {
    name: 'compareDocumentVersionsFlow',
    inputSchema: DocumentComparisonInputSchema,
    outputSchema: DocumentComparisonOutputSchema,
  },
  async (input) => {
    // Comprobación básica: si los textos son idénticos, no es necesario llamar a la IA.
    if (input.currentDocumentText === input.newDocumentText) {
      return {
        areDifferent: false,
        differenceSummary: 'Los documentos son idénticos.',
      };
    }
    // Comprobación básica: si uno está vacío y el otro no.
    if ((!input.currentDocumentText && input.newDocumentText) || (input.currentDocumentText && !input.newDocumentText) ) {
         return {
            areDifferent: true,
            differenceSummary: 'Un documento está vacío mientras que el otro tiene contenido.',
         }
    }
    // Comprobación básica para textos muy cortos - la IA podría no ser útil
    if (input.currentDocumentText.length < 50 && input.newDocumentText.length < 50) {
      // Heurística: si las longitudes difieren significativamente para textos cortos, son diferentes
      if (Math.abs(input.currentDocumentText.length - input.newDocumentText.length) > 10) {
        return {
          areDifferent: true,
          differenceSummary: 'Las longitudes de los documentos son significativamente diferentes para textos cortos.',
        };
      }
      // De lo contrario, demasiado corto para comparar de forma fiable con IA, asumir que no son sustancialmente diferentes a menos que sean idénticos (manejado arriba)
      return {
        areDifferent: input.currentDocumentText !== input.newDocumentText, // diferencia simple para textos cortos
        differenceSummary: input.currentDocumentText !== input.newDocumentText ? 'Diferencias menores en textos muy cortos.' : 'Los documentos son idénticos.',
      };
    }

    const {output} = await comparisonPrompt(input);
    return output!;
  }
);
