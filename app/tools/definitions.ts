import { z } from 'zod';
import { askPossibilityTool } from './askPossibilityTool';
import { askAdditionalInfoTool } from './askAdditionalInfoTool';
import { planningTool } from './planningTool';
import { researchTool } from './researchTool';
import { analystTool } from './analystTool';
import { contextualizerTool } from './contextualizerTool';
import { councilTool } from './councilTool';

export const chatTools = {
  getWeatherInformation: {
    description: 'show the weather in a given city to the user',
    parameters: z.object({ city: z.string() }),
    execute: async ({ city }: { city: string }) => {
      console.log(`Fetching weather for ${city}...`);
      // Simulate API call delay
      await new Promise(resolve => setTimeout(resolve, 1000)); 
      const weatherOptions = ['sunny', 'cloudy', 'rainy', 'snowy', 'windy'];
      const weather = weatherOptions[Math.floor(Math.random() * weatherOptions.length)];
      console.log(`Weather for ${city}: ${weather}`);
      return weather;
    },
  },
  askForConfirmation: {
    description: 'Ask the user for confirmation.',
    parameters: z.object({
      message: z.string().describe('The message to ask for confirmation.'),
    }),
    // No execute function needed here; handled client-side
  },
  
  getLocation: {
    description:
      'Get the user location. Always ask for confirmation before using this tool.',
    parameters: z.object({}),
    // No execute function needed here; handled client-side
  },

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