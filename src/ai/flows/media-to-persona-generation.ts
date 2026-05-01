'use server';
/**
 * @fileOverview This file implements a Genkit flow for processing various media types
 * to generate a comprehensive conversational persona of a deceased loved one.
 *
 * - mediaToPersonaGeneration - The main function to initiate the persona generation process.
 * - MediaToPersonaGenerationInput - The input type for the mediaToPersonaGeneration function.
 * - MediaToPersonaGenerationOutput - The return type for the mediaToPersonaGeneration function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

// Input Schema
const MediaToPersonaGenerationInputSchema = z.object({
  lovedOneName: z.string().describe("The name of the loved one for whom the persona is being generated."),
  audioDataUris: z.array(
    z.string().describe(
      "An audio recording of the loved one, as a data URI that must include a MIME type and use Base64 encoding. Expected format: 'data:<mimetype>;base64,<encoded_data>'."
    )
  ).optional().describe("An array of audio recordings (e.g., voice notes, interviews)."),
  imageDataUris: z.array(
    z.string().describe(
      "A photo of the loved one, as a data URI that must include a MIME type and use Base64 encoding. Expected format: 'data:<mimetype>;base64,<encoded_data>'."
    )
  ).optional().describe("An array of images (e.g., photos, scanned documents)."),
  textDocuments: z.array(
    z.string().describe("The content of a text document (e.g., letters, diary entries, written stories).")
  ).optional().describe("An array of text documents."),
  videoDataUris: z.array(
    z.string().describe(
      "A video of the loved one, as a data URI that must include a MIME type and use Base64 encoding. Expected format: 'data:<mimetype>;base64,<encoded_data>'."
    )
  ).optional().describe("An array of video snippets. The visual and audio components will be analyzed."),
});
export type MediaToPersonaGenerationInput = z.infer<typeof MediaToPersonaGenerationInputSchema>;

// Output Schema
const MediaToPersonaGenerationOutputSchema = z.object({
  personalityTraits: z.array(z.string()).describe("A list of distinct personality traits observed."),
  keyBeliefs: z.array(z.string()).describe("A list of core beliefs or values expressed or inferred."),
  speakingStyle: z.object({
    tone: z.string().describe("A descriptive summary of their typical vocal tone (e.g., warm, humorous, serious)."),
    commonPhrases: z.array(z.string()).describe("A list of common phrases, idioms, or recurring expressions they used."),
    cadenceDescription: z.string().describe("A description of their speech rhythm, speed, and pauses."),
  }).describe("Analysis of their unique speaking style."),
  overallSummary: z.string().describe("A comprehensive narrative summary of the loved one's persona, integrating all findings."),
  exampleDialogues: z.array(z.string()).describe("A few short example dialogues demonstrating how the persona might respond in conversation, reflecting their personality and speaking style."),
});
export type MediaToPersonaGenerationOutput = z.infer<typeof MediaToPersonaGenerationOutputSchema>;

/**
 * Prompt definition for generating the persona.
 * Uses Handlebars templating to include multimodal inputs.
 */
const personaGenerationPrompt = ai.definePrompt({
  name: 'generateLovedOnePersona',
  input: {
    schema: MediaToPersonaGenerationInputSchema
  },
  output: {
    schema: MediaToPersonaGenerationOutputSchema
  },
  prompt: `You are an AI persona analyst. Your task is to meticulously analyze all provided media content (audio, images, text, and video) related to a deceased loved one.
Based on this analysis, you must construct a comprehensive conversational persona that accurately reflects their unique personality, core beliefs, and distinctive speaking style.
Pay close attention to nuances in language, recurring themes, emotional expression, and any verbal or non-verbal cues present in the media.

The loved one's name is: {{lovedOneName}}

{{#if textDocuments}}
--- ANALYZE THE FOLLOWING TEXT DOCUMENTS ---
{{#each textDocuments}}
Document {{@index}}:
{{{this}}}

{{/each}}
{{/if}}

{{#if imageDataUris}}
--- ANALYZE THE FOLLOWING IMAGES ---
{{#each imageDataUris}}
{{media url=this}}
{{/each}}
{{/if}}

{{#if audioDataUris}}
--- ANALYZE THE FOLLOWING AUDIO RECORDINGS ---
{{#each audioDataUris}}
{{media url=this}}
{{/each}}
{{/if}}

{{#if videoDataUris}}
--- ANALYZE THE FOLLOWING VIDEO SNIPPETS ---
{{#each videoDataUris}}
{{media url=this}}
{{/each}}
{{/if}}

Please output the persona analysis as a structured JSON object according to the specified schema.`,
});

/**
 * Wrapper function to initiate the persona generation process.
 */
export async function mediaToPersonaGeneration(input: MediaToPersonaGenerationInput): Promise<MediaToPersonaGenerationOutput> {
  return mediaToPersonaGenerationFlow(input);
}

/**
 * Genkit Flow for generating a persona from media assets.
 */
const mediaToPersonaGenerationFlow = ai.defineFlow(
  {
    name: 'mediaToPersonaGenerationFlow',
    inputSchema: MediaToPersonaGenerationInputSchema,
    outputSchema: MediaToPersonaGenerationOutputSchema,
  },
  async (input) => {
    // Call the defined prompt with the input and specific configuration
    const { output } = await personaGenerationPrompt(input, {
      config: {
        safetySettings: [
          { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_NONE' },
          { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_NONE' },
          { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'BLOCK_NONE' },
          { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_NONE' }
        ],
      },
    });

    if (!output) {
      throw new Error("Failed to generate persona output.");
    }

    return output;
  }
);