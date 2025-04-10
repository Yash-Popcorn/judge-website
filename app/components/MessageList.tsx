import React, { useState, useEffect, useRef } from 'react';
import { Message, ToolInvocation } from 'ai';
import Markdown from 'react-markdown';
import mermaid from 'mermaid';
// Import the type from the research tool file
import { ResearchToolResult } from '../tools/researchTool'; // Adjust path if necessary
// Import the type from the analyst tool file
import { AnalystToolResult } from '../tools/analystTool'; // Adjust path
// Import the type from the contextualizer tool file
import { ContextualizerResult } from '../tools/contextualizerTool'; // Adjust path
// Import the type for the council tool result
import { type CouncilResult } from '../tools/councilTool'; // Adjust path

interface MessageListProps {
  messages: Message[];
  addToolResult?: ({ toolCallId, result }: { toolCallId: string; result: unknown; }) => void;
  isLoading?: boolean; // Add optional isLoading prop
}

// Define a type for the classification result structure
type ClassificationResult = {
  success: boolean;
  classification?: {
    type: string;
    complexity: string;
    reasoning: string;
  };
  error?: string;
};

// Define a type for the possibility evaluation result structure
type PossibilityEvaluationResult = {
  success: boolean;
  result?: {
    isPossible: 'YES' | 'NO';
    justification: string;
  };
  error?: string;
};

// Define types for the planning tool result structure
type AgentPlan = {
  type: 'researcher' | 'qa' | 'contextualizer' | 'analyst';
  order: number;
  purpose: string;
  dependencies: number[];
  query?: string;
};

type PlanningResult = {
  task: string;
  agents: AgentPlan[];
};

// Define type for the final answer tool result
type FinalAnswerResult = {
  answer: string;
};

// Define type for the council tool result (matching councilOutputSchema)
// Ensure this type is exported from councilTool.ts or defined consistently here
// type CouncilResult = { // No longer needed here, imported above
//     judgement: "passed" | "hallucination" | "not_verified" | "not_aligned" | "error";
//     explanation: string;
// };

// --- Type Guards ---
// Generic type guard to check if the invocation has a result property
function invocationHasResultProperty<T>(invocation: ToolInvocation): invocation is ToolInvocation & { result: T } {
  return 'result' in invocation && invocation.result !== undefined;
}

// Specific type guard for Classification Result
function invocationHasClassificationResult(invocation: ToolInvocation): invocation is ToolInvocation & { result: ClassificationResult } {
  // We can add more specific checks here if needed, e.g., checking for `success` property
  return invocationHasResultProperty<ClassificationResult>(invocation);
}

// Specific type guard for Possibility Evaluation Result
function invocationHasPossibilityResult(invocation: ToolInvocation): invocation is ToolInvocation & { result: PossibilityEvaluationResult } {
  // We can add more specific checks here if needed
  return invocationHasResultProperty<PossibilityEvaluationResult>(invocation);
}

// Specific type guard for Planning Result
function invocationHasPlanningResult(invocation: ToolInvocation): invocation is ToolInvocation & { result: PlanningResult } {
  // Basic check, can be expanded to validate structure if needed
  return invocationHasResultProperty<PlanningResult>(invocation) && 
         typeof invocation.result?.task === 'string' &&
         Array.isArray(invocation.result?.agents);
}

// Specific type guard for Research Result
function invocationHasResearchResult(invocation: ToolInvocation): invocation is ToolInvocation & { result: ResearchToolResult } {
  // Check if result is an array and potentially check the structure of the first element
  return invocationHasResultProperty<ResearchToolResult>(invocation) &&
         Array.isArray(invocation.result) &&
         (invocation.result.length === 0 || (typeof invocation.result[0]?.query === 'string' && Array.isArray(invocation.result[0]?.results)));
}

// Specific type guard for Final Answer Result
function invocationHasFinalAnswerResult(invocation: ToolInvocation): invocation is ToolInvocation & { result: FinalAnswerResult } {
    return invocationHasResultProperty<FinalAnswerResult>(invocation) &&
           typeof invocation.result?.answer === 'string';
}

// Specific type guard for Analyst Result
function invocationHasAnalystResult(invocation: ToolInvocation): invocation is ToolInvocation & { result: AnalystToolResult } {
    // Corrected: Check for existence of result object first
    return invocationHasResultProperty<AnalystToolResult>(invocation) && 
           (typeof invocation.result?.mermaidCode === 'string' || typeof invocation.result?.error === 'string');
}

// Specific type guard for Contextualizer Result
function invocationHasContextualizerResult(invocation: ToolInvocation): invocation is ToolInvocation & { result: ContextualizerResult } {
    return invocationHasResultProperty<ContextualizerResult>(invocation) &&
           typeof invocation.result?.query === 'string' && 
           typeof invocation.result?.foundContext === 'string';
}

// Specific type guard for Council Result
function invocationHasCouncilResult(invocation: ToolInvocation): invocation is ToolInvocation & { result: CouncilResult } {
    return invocationHasResultProperty<CouncilResult>(invocation) &&
           typeof invocation.result?.judgement === 'string' &&
           typeof invocation.result?.explanation === 'string';
}

// --- Component State for Input --- 
// Store input values for askAdditionalInfo tool calls temporarily
interface AdditionalInfoInputState {
  [toolCallId: string]: string; // Map toolCallId to user input
}

const MessageList: React.FC<MessageListProps> = ({ messages, addToolResult, isLoading = false }) => {
  // Add ref for auto-scrolling
  const messagesEndRef = useRef<HTMLDivElement>(null);
  
  // Auto-scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // State to hold user input for additional info requests
  const [additionalInfoInput, setAdditionalInfoInput] = useState<AdditionalInfoInputState>({});

  // useEffect to run Mermaid rendering after messages update
  useEffect(() => {
    // Initialize Mermaid with securityLevel set to 'loose' to bypass DOMPurify
    // WARNING: This disables sanitization. Use only if you understand the security risks.
    mermaid.initialize({ 
        startOnLoad: false, // We call run() manually
        securityLevel: 'loose',
        // theme: 'dark' // Optional: Example theme
    }); 

    // Find all mermaid blocks and render them
    // Adding a try-catch block for safety
    try {
         mermaid.run({
             nodes: document.querySelectorAll('.mermaid'),
         });
         console.log("Mermaid rendering attempted with loose security.");
    } catch (e) {
        console.error("Error rendering Mermaid diagrams:", e);
    }
  }, [messages]); // Re-run when messages change

  // Handler for input changes
  const handleInputChange = (toolCallId: string, value: string) => {
    setAdditionalInfoInput(prev => ({ ...prev, [toolCallId]: value }));
  };

  // Handler for submitting the input
  const handleSubmitInput = (toolCallId: string) => {
    if (addToolResult && additionalInfoInput[toolCallId]) {
      addToolResult({
        toolCallId: toolCallId,
        result: additionalInfoInput[toolCallId], // Send the user's input as the result
      });
      // Optional: Clear the input field after submission
      // setAdditionalInfoInput(prev => ({ ...prev, [toolCallId]: '' })); 
    }
  };

  return (
    <div className="flex-1 overflow-y-auto p-16">
      {messages.map((message) => (
        <div key={message.id} className={`mb-4 animate-fadeIn`}>
          <div 
            className={`p-3 rounded-2xl ${
              message.role === 'user' 
                ? 'bg-white text-black ml-auto min-w-[120px] max-w-[60%] font-semibold border border-gray-300' 
                : 'bg-[#302E2F] text-[#FCFAFA] mr-auto min-w-[120px] max-w-[80%] font-medium border border-gray-900'
            }`}
          >
            {message.parts?.map((part, index) => {
              switch (part.type) {
                case 'text':
                  return (
                    <div key={index} className="text-content">
                      <style jsx>{`
                        /* Custom styles for the markdown content */
                        .text-content :global(*) {
                          @apply text-base leading-relaxed tracking-wide;
                        }
                        .text-content :global(h1) {
                          @apply text-2xl font-semibold mt-5 mb-3 tracking-normal;
                        }
                        .text-content :global(h2) {
                          @apply text-xl font-semibold mt-4 mb-3 tracking-normal;
                        }
                        .text-content :global(h3) {
                          @apply text-lg font-semibold mt-4 mb-2 tracking-normal;
                        }
                        .text-content :global(p) {
                          @apply my-3 text-base leading-relaxed tracking-wide;
                        }
                        .text-content :global(ul), .text-content :global(ol) {
                          @apply my-3 pl-6 space-y-2;
                        }
                        .text-content :global(li) {
                          @apply text-base leading-relaxed tracking-wide;
                        }
                        .text-content :global(pre) {
                          @apply my-4 p-4 bg-black/10 rounded-md overflow-x-auto;
                        }
                        .text-content :global(code) {
                          @apply font-mono text-base px-1.5 py-0.5 rounded bg-black/10 tracking-normal;
                        }
                        .text-content :global(pre code) {
                          @apply p-0 bg-transparent;
                        }
                        .text-content :global(blockquote) {
                          @apply pl-4 my-3 border-l-4 border-gray-400 italic text-gray-500 tracking-wide;
                        }
                        .text-content :global(a) {
                          @apply text-blue-500 hover:underline tracking-wide;
                        }
                        .text-content :global(table) {
                          @apply w-full my-4 text-base border-collapse;
                        }
                        .text-content :global(th), .text-content :global(td) {
                          @apply border border-gray-300 p-2 tracking-wide;
                        }
                        .text-content :global(th) {
                          @apply bg-gray-100 font-semibold;
                        }
                      `}</style>
                      <Markdown>{part.text}</Markdown>
                    </div>
                  );

                case 'tool-invocation': {
                  // Destructure with specific type
                  const toolInvocation: ToolInvocation = part.toolInvocation;
                  const { toolCallId, toolName, args, state } = toolInvocation;

                  switch (toolName) {
                    case 'askForConfirmation':
                      switch (state) {
                        case 'call':
                          return (
                            <div key={toolCallId} className="my-2 p-2 border-[#3B3B3B] rounded bg-gray-700 rounded-xl text-sm">
                              <p className="font-semibold mb-2">Confirmation Required:</p>
                              <p className="mb-3">{args.message}</p>
                              {addToolResult ? (
                                <div className="flex space-x-2">
                                  <button
                                    className="px-3 py-1 rounded bg-green-600 hover:bg-green-700 text-white text-xs"
                                    onClick={() =>
                                      addToolResult({
                                        toolCallId: toolCallId,
                                        result: 'Yes, confirmed.',
                                      })
                                    }
                                  >
                                    Yes
                                  </button>
                                  <button
                                    className="px-3 py-1 rounded bg-red-600 hover:bg-red-700 text-white text-xs"
                                    onClick={() =>
                                      addToolResult({
                                        toolCallId: toolCallId,
                                        result: 'No, denied',
                                      })
                                    }
                                  >
                                    No
                                  </button>
                                </div>
                              ) : (
                                <p className="text-xs italic text-gray-400">Waiting for confirmation...</p>
                              )}
                            </div>
                          );
                        case 'result':
                           // Check if result exists before accessing it
                          if (invocationHasResultProperty<unknown>(toolInvocation)) {
                            return (
                              <div key={toolCallId} className="my-2 p-2 border border-[#3B3B3B] rounded-xl bg-[#202020] text-xs italic">
                                Confirmation response: {JSON.stringify(toolInvocation.result)}
                              </div>
                            );
                          }
                      }
                      break;

                    case 'getLocation':
                      switch (state) {
                        case 'call':
                          return <div key={toolCallId} className="my-2 p-2 border-[#3B3B3B] rounded-xl bg-[#202020] text-xs italic">Getting location...</div>;
                        case 'result':
                           // Check if result exists before accessing it
                           if (invocationHasResultProperty<unknown>(toolInvocation)) {
                            return <div key={toolCallId} className="my-2 p-2  border-[#3B3B3B] rounded-xl bg-[#202020] text-xs italic">Location: {JSON.stringify(toolInvocation.result)}</div>;
                           }
                      }
                      break;

                    case 'getWeatherInformation':
                      switch (state) {
                        case 'partial-call':
                          return (
                            <div key={toolCallId} className="my-2 p-2 border-[#3B3B3B] rounded-xl bg-[#202020] text-xs italic">
                              <p>Requesting weather for: {args?.city || 'detecting city...'}</p>
                              <pre className="text-xs overflow-x-auto mt-1">{JSON.stringify(args, null, 2)}</pre>
                            </div>
                          );
                        case 'call':
                          return (
                            <div key={toolCallId} className="my-2 p-2 border-[#3B3B3B] rounded-xl bg-[#202020] text-xs italic">
                              Getting weather information for {args?.city}...
                            </div>
                          );
                        case 'result':
                           // Check if result exists before accessing it
                           if (invocationHasResultProperty<unknown>(toolInvocation)) {
                            return (
                              <div key={toolCallId} className="my-2 p-2 border-[#3B3B3B] rounded-xl bg-[#202020] text-xs italic">
                                Weather in {args?.city}: {JSON.stringify(toolInvocation.result)}
                              </div>
                            );
                           }
                      }
                      break;
                    case 'classify': {
                      switch (state) {
                        case 'call':
                          return <div key={toolCallId} className="my-2 p-2 border-[#3B3B3B] rounded-xl bg-[#202020] text-xs italic">Classifying query...</div>;
                        case 'result':
                          // Use type guard to safely access result
                          if (invocationHasClassificationResult(toolInvocation)) {
                            const toolResult = toolInvocation.result as ClassificationResult; // Safe cast after guard
                            if (toolResult?.success && toolResult.classification) {
                              return (
                                <div key={toolCallId} className="my-2 p-3 border border-[#3B3B3B] rounded-xl bg-[#202020] text-xs">
                                  <p className="font-semibold text-gray-300 mb-1">Query Classification:</p>
                                  <p><span className="font-medium text-gray-400">Complexity:</span> {toolResult.classification.complexity}</p>
                                  <p className="mt-1 italic text-gray-500">Reasoning: {toolResult.classification.reasoning}</p>
                                </div>
                              );
                            } else {
                              return (
                                <div key={toolCallId} className="my-2 p-2 border border-red-500 rounded-xl bg-red-900 text-xs text-white">
                                  Classification failed: {toolResult?.error || 'Unknown error'}
                                </div>
                              );
                            }
                          }
                          // Handle case where result state doesn't have result (shouldn't happen but good for type safety)
                          return <div key={toolCallId} className="my-2 p-2 border border-yellow-500 rounded-xl bg-yellow-900 text-xs text-white">Classification result pending...</div>;
                      }
                      break;
                    }

                    // Add case for the askPossibility tool
                    case 'askPossibility': {
                       switch (state) {
                         case 'call':
                           return <div key={toolCallId} className="my-2 p-2 border-[#3B3B3B] rounded-xl bg-[#202020] text-xs italic">Evaluating task possibility...</div>;
                         case 'result':
                           // Use the specific type guard
                           if (invocationHasPossibilityResult(toolInvocation)) {
                             const toolResult = toolInvocation.result; // Already typed by the guard
                             if (toolResult?.success && toolResult.result) {
                               const isYes = toolResult.result.isPossible === 'YES';
                               return (
                                 <div key={toolCallId} className={`my-2 p-3 border rounded-xl text-xs ${isYes ? 'border-green-600 bg-green-900/30' : 'border-red-600 bg-red-900/30'}`}>
                                   <p className={`font-semibold mb-1 ${isYes ? 'text-green-300' : 'text-red-300'}`}>Task Possibility: {toolResult.result.isPossible}</p>
                                   <p className="italic text-gray-400">Justification: {toolResult.result.justification}</p>
                                 </div>
                               );
                             } else {
                               return (
                                 <div key={toolCallId} className="my-2 p-2 border border-red-500 rounded-xl bg-red-900 text-xs text-white">
                                   Possibility evaluation failed: {toolResult?.error || 'Unknown error'}
                                 </div>
                               );
                             }
                           }
                           // Handle case where result state doesn't have result
                           return <div key={toolCallId} className="my-2 p-2 border border-yellow-500 rounded-xl bg-yellow-900 text-xs text-white">Possibility result pending...</div>;
                       }
                       break;
                     }

                    // Add case for the askAdditionalInfo tool
                    case 'askAdditionalInfo': {
                      switch (state) {
                        case 'call':
                          return (
                            <div key={toolCallId} className="my-2 p-3 border border-blue-500 rounded-xl bg-blue-900/30 text-sm">
                              <p className="font-semibold text-blue-300 mb-2">Additional Information Required:</p>
                              <p className="mb-3 text-gray-300">{args.questionToAsk}</p>
                              {addToolResult ? (
                                <div className="flex items-center space-x-2 mt-2">
                                  <input
                                    type="text"
                                    value={additionalInfoInput[toolCallId] || ''}
                                    onChange={(e) => handleInputChange(toolCallId, e.target.value)}
                                    placeholder="Your answer..."
                                    className="flex-grow p-1.5 rounded border border-gray-600 bg-[#202020] text-gray-200 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500"
                                  />
                                  <button
                                    onClick={() => handleSubmitInput(toolCallId)}
                                    disabled={!additionalInfoInput[toolCallId]} // Disable if input is empty
                                    className="px-3 py-1 rounded bg-blue-600 hover:bg-blue-700 text-white text-xs disabled:opacity-50 disabled:cursor-not-allowed"
                                  >
                                    Submit
                                  </button>
                                </div>
                              ) : (
                                <p className="text-xs italic text-gray-500 mt-2">Waiting for input...</p>
                              )}
                            </div>
                          );
                        case 'result':
                          // Display the answer the user provided
                           if (invocationHasResultProperty<string>(toolInvocation)) {
                              return (
                                <div key={toolCallId} className="my-2 p-2 border border-[#3B3B3B] rounded-xl bg-[#202020] text-xs italic">
                                  Provided Information: {toolInvocation.result}
                                </div>
                              );
                           }
                           return <div key={toolCallId} className="my-2 p-2 border border-yellow-500 rounded-xl bg-yellow-900 text-xs text-white">Processing information...</div>; 
                      }
                      break;
                    }

                    // Add case for the planning tool
                    case 'planning': {
                      switch (state) {
                        case 'call':
                          return <div key={toolCallId} className="my-2 p-2 border-[#3B3B3B] rounded-xl bg-[#202020] text-xs italic">Generating execution plan...</div>;
                        case 'result':
                          // Use the specific type guard
                          if (invocationHasPlanningResult(toolInvocation)) {
                            const plan = toolInvocation.result;
                            return (
                              <div key={toolCallId} className="my-2 p-3 border border-purple-500 rounded-xl bg-purple-900/30 text-sm">
                                <p className="font-semibold text-purple-300 mb-2">Execution Plan Generated:</p>
                                <p className="text-xs italic text-gray-400 mb-3">Original Task: {plan.task}</p>
                                <p className="font-medium text-gray-300 mb-1">Planned Agents:</p>
                                {plan.agents.length > 0 ? (
                                  <ul className="list-none pl-0 space-y-2 text-xs">
                                    {plan.agents.map((agent: AgentPlan, agentIndex: number) => (
                                      <li key={agentIndex} className="p-2 border border-gray-600 rounded bg-[#202020]/50">
                                        <p><span className="font-semibold text-purple-400">Type:</span> {agent.type}</p>
                                        <p><span className="font-semibold text-purple-400">Order:</span> {agent.order} {plan.agents.filter((a: AgentPlan) => a.order === agent.order).length > 1 ? '(Parallel)' : ''}</p>
                                        <p><span className="font-semibold text-purple-400">Purpose:</span> {agent.purpose}</p>
                                        {agent.dependencies.length > 0 && (
                                          <p><span className="font-semibold text-purple-400">Depends on Order(s):</span> {agent.dependencies.join(', ')}</p>
                                        )}
                                        {agent.query && (
                                          <p><span className="font-semibold text-purple-400">Query:</span> <code className="text-xs bg-gray-700 px-1 rounded">{agent.query}</code></p>
                                        )}
                                      </li>
                                    ))}
                                  </ul>
                                ) : (
                                  <p className="text-xs italic text-gray-500">No agents planned (likely a simple task handled directly).</p>
                                )}
                              </div>
                            );
                          } 
                          // Handle case where result state doesn't have result or structure is wrong
                          return <div key={toolCallId} className="my-2 p-2 border border-yellow-500 rounded-xl bg-yellow-900 text-xs text-white">Planning result pending or invalid...</div>;
                      }
                      break;
                    }

                    // Add case for the research tool
                    case 'research': {
                        switch (state) {
                            case 'call':
                                // Display the queries being searched
                                const researchArgs = toolInvocation.args as { queries: string[] } | undefined;
                                const queriesText = researchArgs?.queries?.map(q => `"${q}"`).join(', ') || 'queries...';
                                return <div key={toolCallId} className="my-2 p-2 border-[#3B3B3B] rounded-xl bg-[#202020] text-xs italic">Performing research for: {queriesText}</div>;
                            case 'result':
                                // Use the specific type guard
                                if (invocationHasResearchResult(toolInvocation)) {
                                    const researchResults = toolInvocation.result;
                                    return (
                                      <div key={toolCallId} className="my-2 p-3 border border-green-500 rounded-xl bg-green-900/30 text-sm">
                                        <p className="font-semibold text-green-300 mb-2">Research Results:</p>
                                        {researchResults.length > 0 ? (
                                          <ul className="list-none pl-0 space-y-3 text-xs">
                                            {researchResults.map((queryResult: ResearchToolResult[0], index: number) => (
                                              <li key={index} className="border-b border-green-700/50 pb-2 last:border-b-0">
                                                <p className="font-medium text-gray-300 mb-1">Query: <code className="text-xs bg-gray-700 px-1 rounded">{queryResult.query}</code></p>
                                                {queryResult.error ? (
                                                  <p className="text-red-400 italic">Error: {queryResult.error}</p>
                                                ) : queryResult.results.length > 0 ? (
                                                  <ul className="list-disc pl-5 space-y-1 text-gray-400">
                                                    {queryResult.results.map((result: { title?: string | undefined; url: string }, rIndex: number) => (
                                                      <li key={rIndex}>
                                                        <a href={result.url} target="_blank" rel="noopener noreferrer" className="text-green-400 hover:text-green-300 hover:underline break-all">
                                                          {result.title || result.url}
                                                        </a>
                                                      </li>
                                                    ))}
                                                  </ul>
                                                ) : (
                                                  <p className="italic text-gray-500">No results found.</p>
                                                )}
                                              </li>
                                            ))}
                                          </ul>
                                        ) : (
                                          <p className="text-xs italic text-gray-500">No research queries were executed.</p>
                                        )}
                                      </div>
                                    );
                                }
                                // Handle case where result state doesn't have result or structure is wrong
                                return <div key={toolCallId} className="my-2 p-2 border border-yellow-500 rounded-xl bg-yellow-900 text-xs text-white">Research result pending or invalid...</div>;
                        }
                        break;
                    }

                     // Add case for the analyst tool
                     case 'analyst': {
                        switch (state) {
                            case 'call':
                                const analystArgs = toolInvocation.args as { query: string } | undefined;
                                const queryText = analystArgs?.query || 'analysis query...';
                                return <div key={toolCallId} className="my-2 p-2 border-[#3B3B3B] rounded-xl bg-[#202020] text-xs italic">Generating diagram for: {queryText}</div>;
                            case 'result':
                                if (invocationHasAnalystResult(toolInvocation)) {
                                    const analystResult = toolInvocation.result;
                                    const analystQueryArgs = toolInvocation.args as { query: string } | undefined; // Get args again for display

                                    return (
                                        <div key={toolCallId} className="my-2 p-3 border border-cyan-500 rounded-xl bg-cyan-900/30 text-sm">
                                            <p className="font-semibold text-cyan-300 mb-2">Analysis Result:</p>
                                            {analystQueryArgs?.query && <p className="text-xs italic text-gray-400 mb-2">Original Query: {analystQueryArgs.query}</p> }

                                            {analystResult.mermaidCode ? (
                                                <div>
                                                    <p className="text-xs text-gray-400 mb-1">Generated Mermaid Diagram:</p>
                                                    {/* IMPORTANT: Render Mermaid code in a pre/code block with class="mermaid" */}
                                                    <pre className="bg-white p-2 rounded overflow-x-auto text-black">
                                                        <code className="mermaid text-sm">
                                                            {analystResult.mermaidCode}
                                                        </code>
                                                    </pre>
                                                </div>
                                            ) : analystResult.error ? (
                                                <p className="text-red-400 italic">Error: {analystResult.error}</p>
                                            ) : (
                                                <p className="text-yellow-400 italic">No diagram generated and no error reported.</p>
                                            )}
                                        </div>
                                    );
                                }
                                // Handle invalid result
                                return <div key={toolCallId} className="my-2 p-2 border border-yellow-500 rounded-xl bg-yellow-900 text-xs text-white">Analysis result pending or invalid...</div>;
                        }
                        break;
                    }

                    // Add case for the contextualizer tool
                    case 'contextualizer': {
                        switch (state) {
                            case 'call':
                                const contextArgs = toolInvocation.args as { query: string } | undefined;
                                const queryText = contextArgs?.query || 'local file query...';
                                return <div key={toolCallId} className="my-2 p-2 border-[#3B3B3B] rounded-xl bg-[#202020] text-xs italic">Searching local documents for: {queryText}</div>;
                            case 'result':
                                if (invocationHasContextualizerResult(toolInvocation)) {
                                    const contextResult = toolInvocation.result;
                                    return (
                                        <div key={toolCallId} className="my-2 p-3 border border-orange-500 rounded-xl bg-orange-900/30 text-sm">
                                            <p className="font-semibold text-orange-300 mb-2">Local Document Search Results:</p>
                                            <p className="text-xs italic text-gray-400 mb-1">Query: <code className="text-xs bg-gray-700 px-1 rounded">{contextResult.query}</code></p>
                                            {contextResult.error ? (
                                                <p className="text-red-400 italic">Error: {contextResult.error}</p>
                                            ) : (
                                                // Display the actual found context (snippets or message)
                                                <pre className="whitespace-pre-wrap font-mono text-xs text-orange-300/90 bg-black/10 p-2 rounded mt-1">
                                                    {contextResult.foundContext}
                                                </pre>
                                            )}
                                        </div>
                                    );
                                }
                                // Handle invalid result
                                return <div key={toolCallId} className="my-2 p-2 border border-yellow-500 rounded-xl bg-yellow-900 text-xs text-white">Contextualizer result pending or invalid...</div>;
                        }
                        break;
                    }

                    // Add case for the finalAnswer tool
                    case 'finalAnswer': {
                        switch (state) {
                            case 'call':
                                // This state might not be reached if the LLM directly outputs the result
                                return <div key={toolCallId} className="my-2 p-2 border-[#3B3B3B] rounded-xl bg-[#202020] text-xs italic">Synthesizing final answer...</div>;
                            case 'result':
                                // Use the specific type guard
                                if (invocationHasFinalAnswerResult(toolInvocation)) {
                                    const finalAnswer = toolInvocation.result;
                                    return (
                                        <div key={toolCallId} className="my-2 p-3 border border-gray-500 rounded-xl bg-[#252525] text-sm">
                                            {/* We display the answer as regular message content, potentially in the *next* message part */}
                                            {/* This rendering block can be minimal or just confirm synthesis happened */}
                                             <p className="font-semibold text-gray-300 mb-1">Final Answer Prepared:</p>
                                            {/* The actual answer text will likely be in a 'text' part following this tool result */}
                                             <div className="text-gray-300">
                                                <Markdown>{finalAnswer.answer}</Markdown>
                                             </div>
                                        </div>
                                    );
                                }
                                // Handle invalid result
                                return <div key={toolCallId} className="my-2 p-2 border border-yellow-500 rounded-xl bg-yellow-900 text-xs text-white">Final answer pending or invalid...</div>;
                        }
                        break;
                    }

                    // Add case for the council tool
                    case 'council': {
                        switch (state) {
                            case 'call':
                                // Display the inputs being evaluated if needed (or just a generic message)
                                // const councilArgs = toolInvocation.args as { aggregatedToolResults?: string, userQuery?: string, conversationHistory?: string } | undefined;
                                return <div key={toolCallId} className="my-2 p-2 border-[#3B3B3B] rounded-xl bg-[#202020] text-xs italic">Evaluating results (Council)...</div>;
                            case 'result':
                                // Use the specific type guard
                                if (invocationHasCouncilResult(toolInvocation)) {
                                    const councilResult = toolInvocation.result;
                                    let borderColor = 'border-gray-500';
                                    let bgColor = 'bg-gray-900/30';
                                    let titleColor = 'text-gray-300';

                                    switch (councilResult.judgement) {
                                        case 'passed':
                                            borderColor = 'border-green-500';
                                            bgColor = 'bg-green-900/30';
                                            titleColor = 'text-green-300';
                                            break;
                                        case 'hallucination':
                                        case 'not_verified':
                                        case 'not_aligned':
                                            borderColor = 'border-red-500';
                                            bgColor = 'bg-red-900/30';
                                            titleColor = 'text-red-300';
                                            break;
                                        case 'error':
                                            borderColor = 'border-yellow-500';
                                            bgColor = 'bg-yellow-900/30';
                                            titleColor = 'text-yellow-300';
                                            break;
                                    }

                                    return (
                                        <div key={toolCallId} className={`my-2 p-3 border ${borderColor} rounded-xl ${bgColor} text-sm`}>
                                            <p className={`font-semibold ${titleColor} mb-1`}>Council Evaluation:</p>
                                            <p className="mb-2"><span className="font-medium text-gray-400">Judgement:</span> <span className={`font-bold ${titleColor}`}>{councilResult.judgement}</span></p>
                                            <p className="font-medium text-gray-400 mb-1">Explanation:</p>
                                            <p className="text-xs text-gray-300 whitespace-pre-wrap">{councilResult.explanation}</p>
                                        </div>
                                    );
                                }
                                // Handle invalid result
                                return <div key={toolCallId} className="my-2 p-2 border border-yellow-500 rounded-xl bg-yellow-900 text-xs text-white">Council result pending or invalid...</div>;
                        }
                        break;
                    }

                    default:
                      return (
                        <div key={toolCallId} className="my-2 p-2 border-[#3B3B3B] rounded bg-yellow-800 text-xs">
                          <p>Tool Invocation: {toolName} ({state})</p>
                          <pre className="text-xs overflow-x-auto mt-1">{JSON.stringify(toolInvocation, null, 2)}</pre>
                        </div>
                      );
                  }
                }
              }
              return null;
            })}
          </div>
        </div>
      ))}

      {/* Loading indicator - only shows when isLoading is true */}
      {isLoading && (
        <div className="mb-4 animate-fadeIn">
          <div className="bg-[#302E2F] text-[#FCFAFA] mr-auto p-3 rounded-2xl min-w-[120px] max-w-[80%] border border-gray-900">
            <div className="flex items-center space-x-2">
              <div className="w-2 h-2 bg-gray-500 rounded-full animate-pulse"></div>
              <div className="w-2 h-2 bg-gray-500 rounded-full animate-pulse-delay-1"></div>
              <div className="w-2 h-2 bg-gray-500 rounded-full animate-pulse-delay-2"></div>
            </div>
          </div>
        </div>
      )}
      
      {/* Invisible element to scroll to */}
      <div ref={messagesEndRef} />
    </div>
  );
};

export default MessageList; 