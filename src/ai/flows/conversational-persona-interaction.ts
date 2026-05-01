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
import {Readable} from 'stream';

const ConversationalPersonaInteractionInputSchema = z.object({
  personaId: z.string().describe('The unique identifier of the loved one\'s AI persona.'),
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
Embody the personality, speech patterns, stories, and beliefs of persona ID: "{{personaId}}".
Respond as if you are that person.
Maintain the context of the conversation.

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
    const responseText = textOutput!.responseText;

    // Convert the text response to speech
    const {media: audioMedia} = await ai.generate({
      model: ai.model('gemini-2.5-flash-preview-tts'),
      config: {
        responseModalities: ['AUDIO'],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: { voiceName: 'Algenib' }, // Using a generic voice; ideally this would be the loved one's reconstructed voice
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

// Helper function to convert PCM audio buffer to WAV format
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
