import { openai } from '@ai-sdk/openai';
import { generateObject, tool } from 'ai';
import { z } from 'zod';

// Define the schema for the council's evaluation INPUT
// This describes what the orchestrator needs to pass TO the council tool
const councilInputSchema = z.object({
    aggregatedToolResults: z.string().describe("A string containing the combined, summarized, or relevant outputs from all preceding tool calls (research, analysis, contextualizer, etc.)."),
    userQuery: z.string().describe("The original user query that initiated the current task sequence."),
    conversationHistory: z.string().describe("A string representation of the complete conversation history leading up to the council evaluation."),
});

// Define the schema for the council's evaluation OUTPUT
// This describes the structured response the council tool (and gpt-4o-mini) will return
// Export this schema so MessageList can import it or its inferred type
export const councilOutputSchema = z.object({
    judgement: z.enum(["passed", "hallucination", "not_verified", "not_aligned", "error"])
                 .describe("Overall judgement based on checks: 'passed' if all checks ok, otherwise the category of the first failure (hallucination, not_verified, not_aligned), or 'error' if evaluation failed."),
    explanation: z.string()
                   .describe("Detailed explanation combining insights from hallucination, verification, and alignment checks. Explain the reasoning for the judgement."),
});

// Define the type based on the schema for easier use elsewhere (like MessageList)
export type CouncilResult = z.infer<typeof councilOutputSchema>;


// Define the actual execution logic for the council tool
async function executeCouncil(args: z.infer<typeof councilInputSchema>): Promise<CouncilResult> {
    console.log("Council Tool executing with args:", args);
    const councilLlm = openai('gpt-4o-mini'); // Use the specified OpenAI model

    try {
        // Construct the prompt for the council LLM
        const councilPrompt = `
You are an evaluation council. Your task is to assess an AI response based on the provided context. Evaluate for hallucination, verification, and alignment. Provide a final judgement ('passed', 'hallucination', 'not_verified', 'not_aligned') and a combined explanation.

Conversation History:
${args.conversationHistory}

User Query:
${args.userQuery}

Aggregated Tool Results / Proposed Response Content:
${args.aggregatedToolResults}

Based on the above, perform the following checks:
1.  **Hallucination Check:** Does the response make up facts, cite non-existent sources, or misrepresent the context?
2.  **Verification Check:** Are claims, code references, library usages, function calls, etc., accurate based on the history and established facts?
3.  **Alignment Check:** Does the response directly address the user's query and intent as expressed in the conversation history?

Generate a JSON object matching the required schema with 'judgement' and 'explanation' fields.
`;

        // Use generateObject instead of generateText
        const { object: evaluation } = await generateObject({
            model: councilLlm,
            prompt: councilPrompt,
            schema: councilOutputSchema, // Pass the Zod schema directly
        });

        // Log the parsed object directly (no need for intermediate logging if generateObject succeeds)
        console.log("Council Tool evaluation result (parsed object):", evaluation);

        // generateObject throws if parsing fails, so if we reach here, evaluation is valid
        return evaluation;

    } catch (error) {
         // Log the specific error caught
         console.error("Error caught during council tool execution (generateObject):", error);
         // Return an error object conforming to the output schema
         return {
            judgement: "error",
            explanation: `Council evaluation failed with exception: ${error instanceof Error ? error.message : String(error)}`,
         };
    }
}

// Define the council tool using the Vercel AI SDK
export const councilTool = tool({
    description: "Evaluates aggregated tool results against conversation history and user query for hallucination, verification, and alignment using a separate AI model ('gpt-4o-mini'). Requires aggregated results, user query, and history as input.",
    parameters: councilInputSchema, // Input schema defined above
    execute: executeCouncil,        // The execution function defined above
}); 