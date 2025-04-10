import { tool } from 'ai';
import { z } from 'zod';

// Define the schema for a single agent in the plan
const agentSchema = z.object({
  type: z.enum(['researcher', 'contextualizer', 'analyst'])
    .describe('The type of the agent.'),
  order: z.number()
    .describe('Execution order number. Agents with the same number run in parallel.'),
  purpose: z.string()
    .describe('Specific description of what this agent instance will accomplish.'),
  dependencies: z.array(z.number())
    .describe('List of order numbers for agents that must complete before this one starts. Empty list means no dependencies.'),
  query: z.string().optional()
    .describe('Specific query for researcher, contextualizer, or analyst agents. Required for these types.'),
}).refine(agent => {
    // Require query for specific types
    if (['researcher', 'contextualizer', 'analyst'].includes(agent.type)) {
        return typeof agent.query === 'string' && agent.query.length > 0;
    }
    return true;
}, {
    message: "Query is required for agent types 'researcher', 'contextualizer', and 'analyst'.",
    path: ['query'], // Indicate the path of the error
});

// Define the main schema for the planning tool's output
const planningSchema = z.object({
  task: z.string().describe('The original task description provided by the user.'),
  agents: z.array(agentSchema).describe('List of agents planned for executing the task.'),
});

// Create the planning tool definition
export const planningTool = tool({
  description: `Generates a detailed, step-by-step plan involving multiple AI agents to accomplish a given task.
  Analyzes the task's complexity, feasibility, and dependencies to create an efficient execution strategy.
  Specifies agent types (researcher, qa, contextualizer, analyst), execution order (allowing parallelism), purpose, dependencies, and specific queries where applicable.
  Adheres to strict guidelines for parallelization, agent capabilities, query formulation, and dependency management.
  The output MUST be a valid JSON object conforming to the specified schema.`,
  parameters: planningSchema, // The schema the LLM's output for this tool must adhere to
  // Execute function is not strictly needed here as the LLM generates the JSON output directly
  // based on the system prompt and the tool's schema definition when it decides to "call" this tool.
  // Including a minimal execute function to satisfy the 'tool' interface.
  execute: async (args) => {
    // In a real scenario, this might trigger the *execution* of the plan,
    // but here the LLM's generation *is* the output.
    console.log('Planning Tool "executed" with generated plan:', args);
    return args; // Return the generated plan
  }
}); 