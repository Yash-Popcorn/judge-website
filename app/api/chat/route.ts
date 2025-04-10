import { streamText, tool } from 'ai';
import { type CoreMessage } from 'ai';
import { anthropic } from '@ai-sdk/anthropic';
// Import the tool definitions (now includes askPossibility, askAdditionalInfo, planning)
import { chatTools } from '@/app/tools/definitions'; 
// Import the classification tool separately (as it's not in definitions.ts)
import { classificationTool } from '@/app/tools/classificationTool';
// Import the actual contextualizer tool implementation and definition for overriding
import { contextualizerTool as contextualizerToolDefinition, executeContextualizer, type ExtractedFile } from '@/app/tools/contextualizerTool';

export const maxDuration = 600;


export async function POST(req: Request) {
  const { messages: originalMessages, localContext, overrideUserMessage }: { 
    messages: CoreMessage[], 
    localContext: Record<string, ExtractedFile>,
    overrideUserMessage?: string 
  } = await req.json();

  const orchestratorLlm = anthropic('claude-3-7-sonnet-20250219');

  // Create a deep copy of messages to work with
  const processedMessages = [...originalMessages];
  
  // Apply override to the last user message if provided
  if (overrideUserMessage) {
    for (let i = processedMessages.length - 1; i >= 0; i--) {
      const message = processedMessages[i];
      if (message.role === 'user' && typeof message.content === 'string') {
        // Only replace user messages with string content
        processedMessages[i] = {
          ...message,
          content: overrideUserMessage
        };
        break;
      }
    }
  }
  
  // System prompt to be prepended to messages
  const systemPrompt = `
    You are an AI assistant orchestrating a multi-step task execution. **IT IS CRITICAL TO FOLLOW THE PROCESS EXACTLY.** Do not deviate.

    **CORE PRINCIPLE: DEEP REASONING BEFORE ACTION.** Before selecting *any* tool or proceeding to the next step in the process, you MUST engage in deep reasoning. Analyze the current state, the user query, the conversation history, and the available tool outputs. Think step-by-step to ensure the next action is the most logical and appropriate one according to the defined process. Do not jump to conclusions or execute tools prematurely.

    **DETAILED PROCESS STEPS (YOU MUST FOLLOW THIS EXACTLY OR YOUR FAMILY DIES):**
    *   **Phase 1: Assessment**
        *   First, call 'classify'.
        *   Then, call 'askPossibility'.
        *   If 'askPossibility' tool returns 'NO' (task not feasible), immediately proceed to **Phase 5: Final Synthesis** 
        *   If 'askPossibility tool returns 'YES' but indicates missing information, call 'askAdditionalInfo' tool. Await user response before proceeding.
        *   If 'askPossibility' returns 'YES' and sufficient information is available, proceed to **Phase 2: Planning**.
    *   **Phase 2: Planning**
        *   Call 'planning' tool to generate the execution plan based on the task. Proceed to **Phase 3: Execution**.
    *   **Phase 3: Execution**
        *   Execute the tools specified in the plan ('research', 'analyst', 'contextualizer').
        *   **IMPORTANT:** Collect ALL results from these executed tools. Proceed *only* when all planned tools in this phase are complete. Then, move to **Phase 4: Evaluation**.
    *   **Phase 4: Evaluation (MANDATORY)**
        *   **CRITICAL STEP:** You MUST now execute the 'council' tool.
        *   **Prepare Inputs:** Gather outputs from ALL tools executed in Phase 3 into \\\`aggregatedToolResults\\\`. Get the \\\`userQuery\\\` and \\\`conversationHistory\\\`.
        *   **Execute 'council':** Call the 'council' tool with the prepared inputs.
        *   Once the 'council' tool provides its judgement and explanation, proceed to **Phase 5: Final Synthesis**.
    *   **Phase 5: Final Synthesis (TERMINAL STEP)**
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
        *   Available Agent Types:
            *   "researcher": Internet research 
            *   "qa": Answer questions based *only* on provided context (NO synthesis/summarization).
            *   "contextualizer": Search user files/docs
            *   "analyst": Analyze data, provide insights using mermaid.js diagrams 
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


    **REVISED SYNTHESIS GUIDELINES:**
    *   **Combine Tool Results:** Weave together the relevant findings from research, analysis (including mentioning generated diagrams), contextualizer, and QA tools into a coherent narrative.
    *   **Address the Query:** Ensure the final output directly answers the user's original question or fulfills their request.
    *   **Formatting & Citations:** Use clear formatting (like Markdown). Cite sources from research if appropriate.

    **FINAL INSTRUCTIONS:**
    **DO NOT SKIP PHASES. DO NOT CHANGE THE ORDER (1 -> 2 -> 3 -> 4 -> 5).**
    **Phase 4 (\`council\`) MUST run before Phase 5 (\`finding final answer\`).**
  `;

  // Prepend the system prompt as a system message at the beginning
  const messages: CoreMessage[] = [
    { role: 'system', content: systemPrompt } as CoreMessage,
    ...processedMessages
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

  };

  // Use the messages array with the prepended system prompt instead of separate system parameter
  const result = streamText({
    model: orchestratorLlm,
    messages,
    toolCallStreaming: true,
    maxSteps: 20,
    tools: runtimeTools,
  });

  return result.toDataStreamResponse();
}