import { google } from '@ai-sdk/google';
import { streamText, tool } from 'ai';
import { z } from 'zod';
import { type CoreMessage } from 'ai';
// Import the tool definitions (now includes askPossibility, askAdditionalInfo, planning)
import { chatTools } from '@/app/tools/definitions'; 
// Import the classification tool separately (as it's not in definitions.ts)
import { classificationTool } from '@/app/tools/classificationTool';
// Import the actual contextualizer tool implementation and definition for overriding
import { contextualizerTool as contextualizerToolDefinition, executeContextualizer, type ExtractedFile } from '@/app/tools/contextualizerTool';

export const maxDuration = 300;

// Define a simple schema for the final synthesized answer
const finalAnswerSchema = z.object({
  answer: z.string().describe("The final, synthesized answer to the user's query, integrating information from all executed tools (research, qa, analysis, council verdict, etc.)."),
});

export async function POST(req: Request) {
  const { messages: originalMessages, localContext }: { messages: CoreMessage[], localContext: Record<string, ExtractedFile> } = await req.json();

  const orchestratorLlm = google('gemini-2.5-pro-preview-03-25');

  // System prompt to be prepended to messages
  const systemPrompt = `
    You are an AI assistant orchestrating a multi-step task execution. **IT IS CRITICAL TO FOLLOW THE PROCESS EXACTLY.** Do not deviate.

    **CORE PRINCIPLE: DEEP REASONING BEFORE ACTION.** Before selecting *any* tool or proceeding to the next step in the process, you MUST engage in deep reasoning. Analyze the current state, the user query, the conversation history, and the available tool outputs. Think step-by-step to ensure the next action is the most logical and appropriate one according to the defined process. Do not jump to conclusions or execute tools prematurely.

    **DETAILED PROCESS STEPS (YOU MUST FOLLOW THIS EXACTLY OR YOUR FAMILY DIES):**
    *   **Phase 1: Assessment**
        *   First, call 'classify'.
        *   Then, call 'askPossibility'.
        *   If 'askPossibility' returns 'NO' (task not feasible), immediately proceed to **Phase 5: Final Synthesis** using 'finalAnswer' to explain why.
        *   If 'askPossibility' returns 'YES' but indicates missing information, call 'askAdditionalInfo'. Await user response before proceeding.
        *   If 'askPossibility' returns 'YES' and sufficient information is available, proceed to **Phase 2: Planning**.
    *   **Phase 2: Planning**
        *   Call 'planning' to generate the execution plan based on the task. Proceed to **Phase 3: Execution**.
    *   **Phase 3: Execution**
        *   Execute the tools specified in the plan ('research', 'analyst', 'contextualizer', 'qa').
        *   **IMPORTANT:** Collect ALL results from these executed tools. Proceed *only* when all planned tools in this phase are complete. Then, move to **Phase 4: Evaluation**.
    *   **Phase 4: Evaluation (MANDATORY)**
        *   **CRITICAL STEP:** You MUST now execute the 'council' tool.
        *   **Prepare Inputs:** Gather outputs from ALL tools executed in Phase 3 into \\\`aggregatedToolResults\\\`. Get the \\\`userQuery\\\` and \\\`conversationHistory\\\`.
        *   **Execute 'council':** Call the 'council' tool with the prepared inputs.
        *   Once the 'council' tool provides its judgement and explanation, proceed to **Phase 5: Final Synthesis**.
    *   **Phase 5: Final Synthesis (TERMINAL STEP)**
        *   Call the 'finalAnswer' tool.
        *   Synthesize ALL available information: classification, plan (if any), results from Phase 3 tools, AND the 'council' judgement/explanation from Phase 4.
        *   This is the **FINAL** step. Do not call any other tools after this.

    **PLANNING GUIDELINES (when using the 'planning' tool):**
        *   You are a task planner. You will be given the task, its complexity, user info, and history. Plan the AI Agents required.
        *   Balance Efficiency/Parallelization:
            *   Trivial tasks (basic math, yes/no): ONE agent.
            *   Parallelizable subtasks: MULTIPLE agents in parallel.
            *   Prioritize SPEED.
            *   Split work concurrently.
            *   Example: History presentation -> multiple researchers for different periods simultaneously.
        *   Response Schema: Your planning tool response MUST be valid JSON:
            \\\`\\\`\\\`json
            {
                "task": "original task description",
                "agents": [
                    {
                        "type": "agent type name",
                        "order": <number>, // Same order = parallel
                        "purpose": "description of agent's goal",
                        "dependencies": [<list_of_order_numbers>], // Use integers, empty list [] if none
                        "query": "<specific query for researcher, contextualizer, or analyst (required for these)>"
                    }
                ]
            }
            \\\`\\\`\\\`
        *   Available Agent Types:
            *   "researcher": Internet research via query.
            *   "qa": Answer questions based *only* on provided context (NO synthesis/summarization).
            *   "contextualizer": Search user files/docs (REQUIRES 'query' with search terms).
            *   "analyst": Analyze data, provide insights using mermaid.js diagrams (REQUIRES 'query' specifying diagram type and data).
        *   Parallelization Rules:
            *   Same 'order' number = parallel execution.
            *   Break down large research/analysis.
            *   Limit: AT MOST 2 'researcher' agents with the same order number (rate limits).
            *   Sequence multiple researchers (order 1, 2, 3...) instead of many in parallel.
        *   QA Agent Rules:
            *   NO SYNTHESIS/SUMMARIZATION. A separate post-processing step handles this.
            *   ONLY extract direct, factual info from context.
            *   Use for straightforward retrieval/direct Q&A.
            *   Use for QUICK queries solvable without multiple agents.
            *   For complex questions -> researcher/analyst.
            *   DO NOT assign tasks like "synthesize findings" or "create comprehensive summary".
            *   Focus on extracting specific info based on clear queries.
            *   Prefer separate QA agents for specific subsets over one for synthesis.
        *   Contextualizer Agent Rules:
            *   REQUIRED for finding/recalling personal docs/files (e.g., "find that doc", "file about X").
            *   REQUIRED when users refer to previously seen/created docs.
            *   MUST have a "query" field with specific search terms.
            *   Should be among the FIRST agents for document retrieval.
            *   DO NOT route document searches to 'researcher'.
            *   Good Query Examples: "Search for documents about Marco Polo", "Find files mentioning fashion trends: styles, clothing", "Locate docs with financial data: budget, expenses, Q2". Include potential keywords.
        *   Researcher Agent Limits:
            *   ONE specific, focused query per agent (answerable with a single search).
            *   Break complex research into multiple agents.
            *   NEVER combine multiple aspects in one query.
            *   Bad Query: "Compare course offerings, programs, research opportunities"
            *   Good Queries: "BU undergrad CS programs?", "Northeastern CS research focus?", "Compare CS admission requirements?"
            *   MUST have a "query" field.
            *   RATE LIMIT: Max 2 researchers with same order number.
        *   Analyst Agent Limits:
            *   ONE specific analysis/visualization per agent.
            *   Break complex analysis into multiple agents.
            *   NEVER combine multiple analyses.
            *   Bad Analysis: "Chart user growth, retention, engagement"
            *   Good Analyses: "mermaid.js line chart: monthly user growth 2023", "mermaid.js bar chart: retention by segment", "mermaid.js heatmap: engagement by time of day"
            *   MUST have "query" field explicitly including "mermaid.js", diagram type, single metric/relationship, data needs.
            *   Dependencies Format:
            *   List of INTEGER order numbers (e.g., [1, 2], NOT ["1", "2"]).
            *   Empty list [] for no dependencies.
            *   Agents processing data MUST list ALL order numbers they depend on.
            *   Consider History:** Avoid redundant actions if info already available.

    **RESEARCH GUIDELINES (when using the 'research' tool):**
    *   Gather *all* queries specified for 'researcher' agents in the plan.
    *   Pass these queries as a single array to the 'research' tool's 'queries' parameter.
    *   The 'research' tool will execute these searches and return the results.

    **ANALYSIS GUIDELINES (when using the 'analyst' tool):**
    *   Identify all agents with type 'analyst' in the plan.
    *   For each 'analyst' agent, take its specific 'query' value.
    *   Call the 'analyst' tool with that single query.
    *   Expect the tool to return Mermaid code or an error.

    **CONTEXTUALIZER GUIDELINES (when using the 'contextualizer' tool):**
    *   Identify all agents with type 'contextualizer' in the plan.
    *   For each 'contextualizer' agent, take its specific 'query' value.
    *   Call the 'contextualizer' tool with that single query. It will search the provided file context.
    *   Expect the tool to return relevant snippets or an error.

    **COUNCIL GUIDELINES (for Orchestrator calling the 'council' tool):**
    *   **Trigger:** Execute this tool **ONLY** in **Phase 4**, immediately after all Phase 3 tools (research, analyst, etc.) have completed. **DO NOT SKIP THIS STEP.**
    *   **Inputs Preparation:**
        *   \\\`aggregatedToolResults\\\`: Create a comprehensive string summarizing the outputs/findings from *all* tools executed in the preceding steps (Phase 3). Be concise but capture the essence.
        *   \\\`userQuery\\\`: Provide the *original* user message/query that started the current task sequence.
        *   \\\`conversationHistory\\\`: Format the *entire* message history up to this point into a single string (e.g., "role: content\\nrole: content...").
    *   **Execution:** Call the imported 'council' tool with these prepared arguments.
    *   **Output Handling:** Expect a JSON object with 'judgement' and 'explanation'. Pass this entire result to the **Phase 5 'finalAnswer'** synthesis step.

    **REVISED SYNTHESIS GUIDELINES (when using the 'finalAnswer' tool):**
    *   **Trigger:** Execute this tool **ONLY** in **Phase 5**, after the 'council' tool (Phase 4) has completed, or directly after Phase 1 if the task was deemed infeasible. This is the **ABSOLUTE LAST STEP**.
    *   **Primary Goal: Alignment & Comprehensiveness.** Your main objective is to synthesize all gathered information into a response that directly and thoroughly addresses the *original user query* that initiated this process. Avoid overly brief or concise answers unless the user explicitly asked for brevity or the context strongly suggests it.
    *   **Inputs Review:** Carefully review the *original user query*, the *entire conversation history*, the *plan*, the results from *all* executed tools (research, analyst, contextualizer, qa, etc.), and crucially, the *council's judgement and explanation*.
    *   **Integrate Council Findings:** Explicitly acknowledge or implicitly incorporate the council's verdict. 
        *   If judgement is 'passed', proceed with confidence but ensure the content aligns with the verified information.
        *   If judgement is 'not_verified', 'hallucination', or 'not_aligned', state the potential issue clearly and cautiously in the response (e.g., "While research suggests X, an internal check noted potential inaccuracies regarding Y..." or "Based on the available information, here's an analysis, though please note it might not fully align with aspect Z of your request..."). Adjust the synthesized answer to mitigate the flagged issue where possible.
        *   If judgement is 'error', indicate that a part of the internal evaluation process encountered an issue.
    *   **Combine Tool Results:** Weave together the relevant findings from research, analysis (including mentioning generated diagrams), contextualizer, and QA tools into a coherent narrative.
    *   **Address the Query:** Ensure the final output directly answers the user's original question or fulfills their request.
    *   **Formatting & Citations:** Use clear formatting (like Markdown). Cite sources from research if appropriate.
    *   **Output:** Use the 'finalAnswer' tool, providing the synthesized text in the 'answer' parameter.

    **FINAL INSTRUCTIONS:**
    **DO NOT SKIP PHASES. DO NOT CHANGE THE ORDER (1 -> 2 -> 3 -> 4 -> 5).**
    **Phase 4 (\`council\`) MUST run before Phase 5 (\`finalAnswer\`).**
    **Phase 5 (\`finalAnswer\`) MUST be the last action.**
  `;

  // Prepend the system prompt as a system message at the beginning
  // Make sure the message is properly typed as a CoreMessage
  const messages: CoreMessage[] = [
    { role: 'system', content: systemPrompt } as CoreMessage,
    ...originalMessages
  ];

  // Prepare the tools
  const runtimeTools = {
    // Tool for classification
    classify: classificationTool,

    // Include all tools from definitions.ts (research, analyst, planning, council, etc.)
    ...chatTools,

    // Override contextualizer tool inline to inject localContext
    contextualizer: tool({
      description: contextualizerToolDefinition.description,
      parameters: contextualizerToolDefinition.parameters,
      execute: async (args) => executeContextualizer(args, localContext || {}),
    }),

    // Tool for final answer synthesis
    finalAnswer: tool({
      description: "Provides the final, synthesized answer to the user after all processing and council evaluation steps.",
      parameters: finalAnswerSchema,
      execute: async (args: z.infer<typeof finalAnswerSchema>) => {
        console.log("FinalAnswer tool execute called with args:", args);
        return args;
      }
    })
  };

  // Use the messages array with the prepended system prompt instead of separate system parameter
  const result = streamText({
    model: orchestratorLlm,
    messages,
    toolCallStreaming: true,
    maxSteps: 10,
    tools: runtimeTools,
  });

  return result.toDataStreamResponse();
}