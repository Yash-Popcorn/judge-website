// judge-agent-frontend/app/tools/researchTool.ts
import { tool } from 'ai';
import { z } from 'zod';
import Exa from 'exa-js';

// Define the type for the output structure
// Use 'text' field directly and remove unnecessary 'id'
export type ResearchToolResult = z.infer<z.ZodArray<z.ZodObject<{
    query: z.ZodString;
    results: z.ZodArray<z.ZodObject<{
        title: z.ZodOptional<z.ZodString>;
        url: z.ZodString;
        // id: z.ZodString; // No longer needed for separate fetch
        text: z.ZodOptional<z.ZodString>; // Expect text content directly
    }>>;
    error: z.ZodOptional<z.ZodString>;
}>>>;

// Define the input schema for the research tool
const researchToolInputSchema = z.object({
    queries: z.array(z.string()).describe('An array of search queries to execute using Exa.'),
});

// Environment variable check
if (!process.env.EXA_API_KEY) {
    console.warn("EXA_API_KEY environment variable is not set. Research tool will not function.");
}

// Initialize Exa client
const exa = new Exa(process.env.EXA_API_KEY);

export const researchTool = tool({
    description: `Performs web research for queries using Exa. 
                  Searches and retrieves text content in a single step.
                  Returns title, URL, and text content for top results for each query.`, // Simplified description
    parameters: researchToolInputSchema,
    execute: async ({ queries }) => {
        if (!process.env.EXA_API_KEY) {
            return queries.map(query => ({
                query: query,
                results: [],
                error: "EXA_API_KEY is not configured."
            }));
        }

        console.log(`Research Tool executing searchAndContents for queries: ${queries.join(', ')}`);

        // Execute searches in parallel using searchAndContents
        const searchPromises = queries.map(async (query) => {
            try {
                // Use searchAndContents directly
                const response = await exa.searchAndContents(query, {
                    numResults: 3, 
                    // type: 'keyword', // Type might not be needed/supported for searchAndContents, check docs if needed
                    text: true, // Request text content
                });

                // Map results directly, assuming response.results has title, url, text
                const results = response.results.map(res => ({
                    title: res.title || 'No title available',
                    url: res.url,
                    text: res.text || 'No text content retrieved.', // Use the text field
                }));

                console.log(`Query "${query}" searchAndContents succeeded with ${results.length} results.`);
                return { query, results, error: undefined };

            } catch (error: unknown) {
                let errorMessage = 'An unknown error occurred during searchAndContents.';
                if (error instanceof Error) { errorMessage = error.message; }
                console.error(`Error during searchAndContents for query "${query}":`, error);
                return { query, results: [], error: errorMessage };
            }
        });

        // Wait for all searches to complete
        const finalResults = await Promise.all(searchPromises);

        return finalResults;
    }
}); 