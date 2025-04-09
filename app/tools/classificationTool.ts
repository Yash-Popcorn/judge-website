import { z } from 'zod';
import { tool } from 'ai';
import { openai } from '@ai-sdk/openai';
import { generateObject } from 'ai';

export const classificationTool = tool({
  description: 'Classify the user query based on type and complexity.',
  parameters: z.object({
    userQuery: z.string().describe("The user's message content to classify."),
  }),
  execute: async ({ userQuery }) => {
    const gpt4o = openai('gpt-4o'); // Or use a specific model for classification
    try {
      const { object: classification } = await generateObject({
        model: gpt4o,
        schema: z.object({
          reasoning: z.string().describe('Brief reasoning for the classification.'),
          complexity: z.enum([
            'CRITICAL_COMPLEXITY',
            'HIGH_COMPLEXITY',
            'MODERATE_COMPLEXITY',
            'LOW_COMPLEXITY',
            'MINIMAL_COMPLEXITY',
            'TRIVIAL'
          ]).describe('The estimated complexity of the user query.'),
        }),
        prompt: `Classify the following user query: "${userQuery}"

        Determine:
        1. Complexity level (CRITICAL_COMPLEXITY, HIGH_COMPLEXITY, MODERATE_COMPLEXITY, LOW_COMPLEXITY, MINIMAL_COMPLEXITY, TRIVIAL)
        2. Provide brief reasoning for your classification.`,
      });
      console.log('Classification result:', classification);
      // Return the classification object
      return { success: true, classification };
    } catch (error) {
      console.error('Error during classification:', error);
      return { success: false, error: 'Failed to classify query.' };
    }
  },
}); 