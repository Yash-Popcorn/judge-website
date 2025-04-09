import { z } from 'zod';
import { tool } from 'ai';
import { openai } from '@ai-sdk/openai';
import { generateObject } from 'ai';

// Define the schema for the expected response from the LLM
const possibilitySchema = z.object({
  isPossible: z.enum(['YES', 'NO']).describe('Whether the task is possible (YES or NO).'),
  justification: z.string().describe('Brief justification for the YES/NO answer.'),
});

export const askPossibilityTool = tool({
  description: 'Evaluate if a software task described by the user is programmatically possible.',
  parameters: z.object({
    taskDescription: z.string().describe("The user's query describing the software task."),
    
    // Optional: Add context if needed, e.g., relevant file snippets
    // contextText: z.string().optional().describe("Additional context like file contents."), 
  }),
  
  execute: async ({ taskDescription /*, contextText */ }) => {
    const gpt4o = openai('gpt-4o');
    
    const systemPrompt = `Evaluate whether the following software task is possible to accomplish within the scope of programmatic capabilities. Assume that the system has access to files or text storage that the user has explicitly provided or saved.

        Answer YES if the task:
        - Can be accomplished purely through software/programming
        - Requires only digital/computational resources
        - Can be done with available programming languages, frameworks, or APIs
        - Is within scope of data processing, automation, or digital operations
        - Doesn't require physical world interactions or human intervention
        - Can be achieved with proper API access and authentication where needed
        - Involves searching for information or context that an AI system can access
        - Requires document or information retrieval from accessible digital sources
        - Retrieving and searching for specific information based on the user's prior interaction and storage/context

        Answer NO if the task:
        - Requires physical world manipulation (e.g., building hardware, 3D printing)
        - Needs human physical intervention
        - Involves purchasing or financial transactions without proper API access
        - Requires real-world sensing or actuating without proper interfaces
        - Goes beyond pure software capabilities
        - Requires AGI-level capabilities or general world knowledge
        - Involves unauthorized access or illegal operations

        Task to evaluate: ${taskDescription}

        Provide a YES/NO answer and brief justification for whether this is a valid software task.`;

    try {
      const { object: possibilityResult } = await generateObject({
        model: gpt4o,
        schema: possibilitySchema,
        prompt: systemPrompt, // Using the detailed prompt directly here
      });
      console.log('Possibility evaluation result:', possibilityResult);
      return { success: true, result: possibilityResult };
    } catch (error) {
      console.error('Error during possibility evaluation:', error);
      return { success: false, error: 'Failed to evaluate task possibility.' };
    }
  },
}); 