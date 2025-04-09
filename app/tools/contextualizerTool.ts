import { tool, generateText } from 'ai';
import { google } from '@ai-sdk/google';
import { z } from 'zod';

// Define the structure for the ExtractedFile expected from local storage
export interface ExtractedFile {
  fileName: string;
  fileType: string;
  fileSize: number;
  text: string;
  extractedAt: number;
}

// Define the input schema
const contextualizerInputSchema = z.object({
    query: z.string().describe('The search query or keywords to look for in local user files/documents.'),
});

// Define the type for the output structure directly using z.infer with inline schema
export type ContextualizerResult = z.infer<z.ZodObject<{
    query: z.ZodString;
    foundContext: z.ZodString; 
    error: z.ZodOptional<z.ZodString>;
}>>;

// --- LLM Instance for Context Search ---
const contextSearchLlm = google('gemini-2.0-flash-thinking-exp-01-21'); // Or another suitable model

// --- Separate Exported Execution Logic --- 
export async function executeContextualizer(
    args: z.infer<typeof contextualizerInputSchema>,
    localContext: Record<string, ExtractedFile> // Receive the context map
): Promise<ContextualizerResult> {
    const { query } = args;
    console.log(`Contextualizer Tool executing LLM search in provided context for query: "${query}"`);

    if (!query || query.trim().length < 3) {
        console.warn("Contextualizer search: Query too short/vague.");
        return {
            query: query,
            foundContext: "Search not performed: Query was too short or vague.",
            error: "Query too vague for search."
        };
    }

    const files = Object.values(localContext);
    if (!files || files.length === 0) {
        console.warn("Contextualizer search: No local context provided.");
        return {
            query: query,
            foundContext: "Search not performed: No local file context was provided with the request.",
            error: "No local context available."
        };
    }

    // --- LLM Search Logic --- 
    try {
        // Concatenate file content with markers
        const contextText = files.map(file => 
            `--- START FILE: ${file.fileName} ---\n${file.text}
--- END FILE: ${file.fileName} ---`
        ).join('\n\n');

        // Prepare prompt for LLM
        const systemPrompt = `You are an AI assistant specialized in searching through provided text context based on a user query.
Analyze the following text content, which consists of one or more files separated by markers.
Find and extract the most relevant sentences or short paragraphs that directly answer or address the user's query.
If multiple relevant snippets are found across different files, include them all, clearly indicating the source file for each.
If no relevant information is found, state that clearly.
Do not summarize the entire content; only extract specific, relevant parts.`;
        
        const prompt = `User Query: "${query}"

Provided File Context:
${contextText}

Relevant Snippets (or state if none found):
`;

        // Call LLM to perform the search
        const { text: foundContext } = await generateText({
            model: contextSearchLlm,
            system: systemPrompt,
            prompt: prompt,
            temperature: 0.3, // Adjust temperature as needed
            // maxTokens: 500, // Optional: Limit output length
        });

        if (!foundContext || foundContext.trim() === '') {
             console.warn("Contextualizer LLM search returned empty result.");
              return {
                query: query,
                foundContext: "The AI search assistant could not find relevant information for the query in the provided files.",
                error: "LLM search returned empty."
             };
        }

        console.log(`Contextualizer LLM search completed for query: "${query}"`);
        // Return the LLM's response as the found context
        return {
            query: query,
            foundContext: foundContext.trim(),
            error: undefined,
        };

    } catch (error: unknown) {
        let errorMessage = 'An unknown error occurred during LLM context search.';
        if (error instanceof Error) { errorMessage = error.message; }
        console.error("Error during LLM context search:", error);
        return {
            query: query,
            foundContext: "An error occurred while searching the file context.",
            error: errorMessage
        };
    }
    // --- End LLM Search Logic ---
}

// --- Tool Definition (uses the exported execute function indirectly via route.ts) --- 
export const contextualizerTool = tool({
    description: `Searches through locally stored user files (provided in the request context) for information based on a query.
                  Returns relevant text snippets found.`, // Updated description
    parameters: contextualizerInputSchema,
    // The actual execution is now handled by the inline definition in route.ts,
    // which calls the exported executeContextualizer function.
    // We can leave a dummy execute here or remove it if the inline definition is always used.
    execute: async (args) => {
        // This execute won't be called directly if overridden in route.ts
        console.warn("ContextualizerTool.execute called directly - should be called via route override with context.");
        // Fallback simulation if called directly (shouldn't happen)
        return executeContextualizer(args, {}); 
    }
}); 