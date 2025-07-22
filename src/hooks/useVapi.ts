import Vapi from '@vapi-ai/web';
import { useState } from 'react';

// Create a single instance of the Vapi class.
// Handle module interoperability issues.
// If the default import is a module with a `default` property, use that.
const VapiConstructor = (Vapi as any).default || Vapi;
const vapi = new VapiConstructor(import.meta.env.VITE_VAPI_API_KEY);

// Custom hook to provide access to the Vapi instance.
export const useVapi = () => {
  // Although we have a single instance, we can use state to manage component-specific listeners or status if needed.
  // For now, we just return the singleton instance.
  return vapi;
};
