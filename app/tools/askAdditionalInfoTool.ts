import { z } from 'zod';
import { tool } from 'ai';

// Define the tool schema
export const askAdditionalInfoTool = tool({
  description: 'Asks the user a specific question to clarify ambiguity or gather necessary details before proceeding with a task. Use this when you lack sufficient information.',
  parameters: z.object({
    questionToAsk: z.string().describe('The specific question to ask the user to get the required information.'),
  }),
  // No server-side execute function needed - this tool requires user interaction on the client.
}); 