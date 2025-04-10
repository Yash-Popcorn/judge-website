import { z } from 'zod';
import { tool } from 'ai';
import { openai } from '@ai-sdk/openai';
import { generateObject } from 'ai';
console.log('askPossibilityTool');
// Define the schema for the expected response from the LLM
const possibilitySchema = z.object({
  isPossible: z.enum(['YES', 'NO']).describe('Whether the task is possible (YES or NO).'),
  justification: z.string().describe('Brief justification for the YES/NO answer.'),
});

// Define the available tools in the system - this makes the system capabilities explicit
const availableTools = [
  {
    name: "classify",
    description: "Classifies the user's query to understand the task.",
    capabilities: [
      "Categorize user queries by type and complexity",
      "Identify task requirements and dependencies"
    ]
  },
  {
    name: "askPossibility",
    description: "Evaluates if a software task described by the user is programmatically possible.",
    capabilities: [
      "Determine if a task is feasible with available tools",
      "Provide justification for possibility assessment"
    ]
  },
  {
    name: "askAdditionalInfo",
    description: "Identifies what additional information is needed from the user to complete a task.",
    capabilities: [
      "Detect information gaps in user requests",
      "Generate specific follow-up questions"
    ]
  },
  {
    name: "planning",
    description: "Generates an execution plan based on the task complexity and requirements.",
    capabilities: [
      "Break down complex tasks into subtasks",
      "Determine agent allocation for efficient processing",
      "Balance parallelization and sequencing of subtasks"
    ]
  },
  {
    name: "research",
    description: "Performs internet research based on specific queries.",
    capabilities: [
      "Search for information online",
      "Find relevant facts and details about topics",
      "Gather data from external sources"
    ]
  },
  {
    name: "analyst",
    description: "Analyzes data and provides insights using mermaid.js diagrams.",
    capabilities: [
      "Create data visualizations with mermaid.js",
      "Analyze patterns and relationships in data",
      "Generate charts, graphs, and diagrams"
    ]
  },
  {
    name: "contextualizer",
    description: "Searches user files and documents for relevant information.",
    capabilities: [
      "Access and analyze documents mentioned in conversation",
      "Search through user-provided context",
      "Extract information from files and notes",
      "Process text files of various formats"
    ]
  },
  {
    name: "council",
    description: "Evaluates the collected information and provides a judgment.",
    capabilities: [
      "Synthesize information from multiple sources",
      "Provide balanced assessment of findings",
      "Generate recommendations based on all available data"
    ]
  },
  {
    name: "qa",
    description: "Answers questions based only on provided context.",
    capabilities: [
      "Extract direct, factual information from context",
      "Answer specific questions without synthesis",
      "Provide targeted information retrieval"
    ]
  }
];

export const askPossibilityTool = tool({
  description: 'Evaluate if a software task described by the user is programmatically possible.',
  parameters: z.object({
    taskDescription: z.string().describe("The user's query describing the software task."),
    // Optional: Add context if needed, e.g., relevant file snippets
    contextText: z.string().describe("Additional context to understand the situation."), 
  }),
  
  execute: async ({ taskDescription, contextText }) => {
    const gpt4o = openai('gpt-4o');
    
    // Create system capabilities description based on available tools
    const systemCapabilities = availableTools
      .map(tool => `- ${tool.name}: ${tool.description}`)
      .join('\n');
    
    const toolCapabilities = availableTools
      .flatMap(tool => tool.capabilities.map(cap => `- ${cap} (via ${tool.name})`))
      .join('\n');
    
    const systemPrompt = `Evaluate whether the following software task is possible to accomplish within the scope of programmatic capabilities. 

        SYSTEM CAPABILITIES:
        This AI assistant has access to the following tools and capabilities:
        ${systemCapabilities}
        
        Specifically, the system can:
        ${toolCapabilities}

        This means the system CAN:
        - Process and analyze documents or files mentioned by the user
        - Access and summarize content from the conversation context
        - Work with information that exists in the conversation or that the user could share
        
        Task evaluation guidelines:
        - Answer YES if the task can be accomplished using the system's capabilities
        - Answer YES if the task involves analyzing content (like "physics notes") that could be shared
        - Answer NO ONLY if the task requires capabilities beyond what the system can provide
        - Consider the multi-turn nature of conversation - users can provide additional information when needed
        
        Task to evaluate: ${taskDescription}
        Context: ${contextText}
        Provide a YES/NO answer and brief justification for whether this is a valid software task based on the system's capabilities.`;

    try {
      const { object: possibilityResult } = await generateObject({
        model: gpt4o,
        schema: possibilitySchema,
        prompt: systemPrompt,
      });
      console.log('Possibility evaluation result:', possibilityResult);
      return { success: true, result: possibilityResult };
    } catch (error) {
      console.error('Error during possibility evaluation:', error);
      return { success: false, error: 'Failed to evaluate task possibility.' };
    }
  },
}); 