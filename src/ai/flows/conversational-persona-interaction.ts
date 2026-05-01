'use server';
/**
 * @fileOverview A Genkit flow for engaging in a voice-to-voice conversation with an AI persona.
 *
 * - conversationalPersonaInteraction - A function that handles the conversational interaction process.
 * - ConversationalPersonaInteractionInput - The input type for the conversationalPersonaInteraction function.
 * - ConversationalPersonaInteractionOutput - The return type for the conversationalPersonaInteraction function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';
import * as wav from 'wav';
import {Buffer} from 'buffer';

const ConversationalPersonaInteractionInputSchema = z.object({
  personaId: z.string().describe('The unique identifier of the loved one\'s AI persona.'),
  personaContext: z.object({
    name: z.string(),
    summary: z.string(),
    traits: z.array(z.string()),
    phrases: z.array(z.string()),
  }).describe('The personality and biographical context of the loved one.'),
  userInputText: z.string().describe('The user\'s spoken input converted to text.'),
  conversationHistory: z.array(
    z.object({
      role: z.union([z.literal('user'), z.literal('model')]),
      content: z.string(),
    })
  ).describe('The history of the conversation to maintain context.'),
});
export type ConversationalPersonaInteractionInput = z.infer<typeof ConversationalPersonaInteractionInputSchema>;

const ConversationalPersonaInteractionOutputSchema = z.object({
  responseText: z.string().describe('The AI persona\'s generated text response.'),
  responseAudioDataUri: z.string().describe('The AI persona\'s generated speech as a WAV data URI.'),
});
export type ConversationalPersonaInteractionOutput = z.infer<typeof ConversationalPersonaInteractionOutputSchema>;

export async function conversationalPersonaInteraction(input: ConversationalPersonaInteractionInput): Promise<ConversationalPersonaInteractionOutput> {
  return conversationalPersonaInteractionFlow(input);
}

const personaConversationPrompt = ai.definePrompt({
  name: 'personaConversationPrompt',
  input: {schema: ConversationalPersonaInteractionInputSchema},
  output: {schema: ConversationalPersonaInteractionOutputSchema.pick({responseText: true})},
  prompt: `You are acting as an AI persona of a deceased loved one. Your goal is to engage in a natural, voice-to-voice conversation with a family member.

Loved One's Name: {{personaContext.name}}
Biography: {{personaContext.summary}}
Personality Traits: {{#each personaContext.traits}}{{this}}, {{/each}}
Common Phrases: {{#each personaContext.phrases}}"{{this}}", {{/each}}

Embody this person's spirit, warmth, and unique way of speaking. Respond as if you are that person talking to a dear family member. Keep your responses concise (1-3 sentences) to maintain a natural conversation flow.

Here is the conversation history so far:
{{#each conversationHistory}}
{{this.role}}: {{this.content}}
{{/each}}

User: {{{userInputText}}}
AI Persona:`,
});

const conversationalPersonaInteractionFlow = ai.defineFlow(
  {
    name: 'conversationalPersonaInteractionFlow',
    inputSchema: ConversationalPersonaInteractionInputSchema,
    outputSchema: ConversationalPersonaInteractionOutputSchema,
  },
  async (input) => {
    // Generate text response from the AI persona
    const {output: textOutput} = await personaConversationPrompt(input);
    const responseText = textOutput?.responseText || "I'm here, listening.";

    // Convert the text response to speech using the Gemini TTS model
    const {media: audioMedia} = await ai.generate({
      model: 'googleai/gemini-2.5-flash-preview-tts',
      config: {
        responseModalities: ['AUDIO'],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: { voiceName: 'Algenib' },
          },
        },
      },
      prompt: responseText,
    });

    if (!audioMedia) {
      throw new Error('No audio media returned from TTS generation.');
    }

    // Convert the PCM audio to WAV format
    const audioBuffer = Buffer.from(
      audioMedia.url.substring(audioMedia.url.indexOf(',') + 1),
      'base64'
    );
    const responseAudioDataUri = 'data:audio/wav;base64,' + (await toWav(audioBuffer));

    return {
      responseText,
      responseAudioDataUri,
    };
  }
);

async function toWav(
  pcmData: Buffer,
  channels = 1,
  rate = 24000,
  sampleWidth = 2
): Promise<string> {
  return new Promise((resolve, reject) => {
    const writer = new wav.Writer({
      channels,
      sampleRate: rate,
      bitDepth: sampleWidth * 8,
    });

    let bufs = [] as any[];
    writer.on('error', reject);
    writer.on('data', function (d) {
      bufs.push(d);
    });
    writer.on('end', function () {
      resolve(Buffer.concat(bufs).toString('base64'));
    });

    writer.write(pcmData);
    writer.end();
  });
}
