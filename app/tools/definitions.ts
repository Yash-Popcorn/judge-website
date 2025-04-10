import { askPossibilityTool } from './askPossibilityTool';
import { askAdditionalInfoTool } from './askAdditionalInfoTool';
import { planningTool } from './planningTool';
import { researchTool } from './researchTool';
import { analystTool } from './analystTool';
import { contextualizerTool } from './contextualizerTool';
import { councilTool } from './councilTool';

export const chatTools = {

  askPossibility: askPossibilityTool,

  askAdditionalInfo: askAdditionalInfoTool,

  planning: planningTool,

  research: researchTool,

  analyst: analystTool,

  contextualizer: contextualizerTool,

  council: councilTool,
};

// Define a type for the tools object if needed elsewhere
export type ChatTools = typeof chatTools; 