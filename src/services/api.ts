// src/services/api.ts

const OPENROUTER_API_URL = "https://openrouter.ai/api/v1/chat/completions";
const OPENROUTER_MODEL = "google/gemini-flash-1.5";

// Function to get API key with validation
export const getApiKey = (): string | undefined => {
  const key = import.meta.env.VITE_OPENROUTER_API_KEY;
  if (!key) {
    console.error('API key is missing. Please check your .env file.');
    return undefined;
  }
  if (!key.startsWith('sk-or-v1-')) {
    console.error('API key format is invalid - should start with sk-or-v1-');
    return undefined;
  }
  return key;
};

// Function to check if API key is set
export const hasApiKey = (): boolean => {
  return !!import.meta.env.VITE_OPENROUTER_API_KEY;
};

// Main function to send messages to the AI
export const sendMessage = async (
  message: string,
  imageBase64?: string,
  responseType: 'json' | 'text' = 'text'
): Promise<any> => {
  const apiKey = getApiKey();
  if (!apiKey) {
    throw new Error("API key not configured properly. Please check your .env file.");
  }

  let systemPrompt: string;
  let userMessageContent: any;
  const requestBody: any = {
      model: OPENROUTER_MODEL,
      temperature: 0.7,
      max_tokens: 2048,
      stream: false,
  };

  if (imageBase64) {
    systemPrompt = `You are an AI assistant for "Mothers for Mathematics", a project helping teachers and parents in Cameroon with mathematics education. You specialize in providing feedback on student work using Math Error Analysis principles. When analyzing student work, identify:
- Specific error types (e.g., incorrect counting, mixed grouping, etc.)
- Root causes of mathematical misunderstandings
- Practical remediation strategies that parents or teachers can implement

Always be encouraging, use simple language, and provide actionable advice. Use markdown formatting, including headings, to structure the analysis and make it easy to read. The user has uploaded an image of student work. Analyze it for mathematical errors, providing specific feedback on what the student did correctly and incorrectly. Suggest practical remediation activities.`;
    userMessageContent = [
      { type: "text", text: message },
      { type: "image_url", image_url: { url: imageBase64, detail: "high" } }
    ];
  } else {
    // This is for lesson plan generation
     systemPrompt = `You are an AI assistant for "Mothers for Mathematics". Your task is to generate a structured lesson plan based on a given topic. The response MUST be a valid JSON object.`;
     userMessageContent = message;
     // Force the model to return JSON
     if (responseType === 'json') {
        requestBody.response_format = { "type": "json_object" };
     }
  }

  requestBody.messages = [
      { role: "system", content: systemPrompt },
      { role: "user", content: userMessageContent }
  ];

  try {
    const response = await fetch(OPENROUTER_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`,
        "HTTP-Referer": "http://localhost:5173", // Set a referrer for OpenRouter
        "X-Title": "Mother of Math"
      },
      body: JSON.stringify(requestBody)
    });

    if (!response.ok) {
      const errorData = await response.json();
      console.error("API Error Details:", errorData);
      throw new Error(`API request failed with status ${response.status}: ${errorData.error?.message || 'Unknown error'}`);
    }

    const data = await response.json();
    const content = data.choices[0].message.content;

    if (responseType === 'json') {
        try {
            // The response_format flag should ensure this is a valid JSON string.
            return JSON.parse(content);
        } catch (e) {
            console.error("Failed to parse JSON from AI response, even when requested.", e);
            console.error("Raw content was:", content);
            throw new Error("The AI returned a response that was not valid JSON.");
        }
    } else {
        // For 'text' responseType, just return the content.
        return { text: content };
    }

  } catch (error) {
    console.error("API Request Error:", error);
    throw error;
  }
};

// Function to convert file to base64
export const fileToBase64 = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = (error) => reject(error);
  });
};