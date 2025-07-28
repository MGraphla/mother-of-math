interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

interface ChatbotResponse {
  success: boolean;
  message: string;
  error?: string;
}

class ChatbotService {
  private apiKey: string;
  private apiUrl: string;
  private model: string;

  constructor() {
    this.apiKey = import.meta.env.VITE_OPENROUTER_API_KEY;
    this.apiUrl = import.meta.env.VITE_OPENROUTER_API_URL;
    this.model = 'google/gemini-2.5-flash';

    if (!this.apiKey) {
      throw new Error('OpenRouter API key is not configured');
    }
  }

  async sendMessage(
    message: string,
    conversationHistory: ChatMessage[] = [],
    grade: string
  ): Promise<ChatbotResponse> {
    if (!grade) {
      return {
        success: false,
        message: 'Grade level is not selected. Please select a grade to continue.',
        error: 'Grade not provided'
      };
    }

    try {
      const systemPrompt = `You are MAMA (Mathematics Assistant for Cameroon), an AI teaching assistant specialized in Cameroon's primary mathematics curriculum. You are currently assisting a teacher for Primary ${grade}. All your responses must be tailored specifically to this grade level.\n\nYou help teachers with:\n- Mathematics curriculum guidance for Cameroon National Primary Mathematics Standards for Primary ${grade}.\n- Lesson planning and teaching strategies for Primary ${grade}.\n- Student assessment and progress tracking for Primary ${grade}.\n- Explaining mathematical concepts appropriate for Primary ${grade}.\n- Cultural integration of local Cameroonian contexts in math education for Primary ${grade}.\n\nKey Guidelines:\n- Your primary focus is Primary ${grade}. All examples, explanations, and advice must be suitable for a child in this class.\n- Always provide culturally relevant examples using Cameroonian contexts (CFA francs, local markets, familiar foods, etc.).\n- Use simple, clear language appropriate for Primary ${grade}.\n- Provide specific, actionable advice for teachers relevant to Primary ${grade}.\n\nBe helpful, encouraging, and educational in all responses, ensuring they are directly applicable to Primary ${grade}.`;

      // Prepare conversation context
      const messages = [
        {
          role: 'system',
          content: systemPrompt
        },
        ...conversationHistory.map(msg => ({
          role: msg.role,
          content: msg.content
        })),
        {
          role: 'user',
          content: message
        }
      ];

      const response = await fetch(this.apiUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': window.location.origin,
          'X-Title': 'Mother of Mathematics - Cameroon Math Teacher AI'
        },
        body: JSON.stringify({
          model: this.model,
          messages: messages,
          temperature: 0.7,
          max_tokens: 2048,
          top_p: 0.9,
          frequency_penalty: 0.1,
          presence_penalty: 0.1
        })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error?.message || `API request failed: ${response.status}`);
      }

      const data = await response.json();
      
      if (!data.choices || !data.choices[0] || !data.choices[0].message) {
        throw new Error('Invalid response format from API');
      }

      return {
        success: true,
        message: data.choices[0].message.content.trim()
      };

    } catch (error) {
      console.error('Chatbot service error:', error);
      return {
        success: false,
        message: 'I apologize, but I encountered an error processing your request. Please try again.',
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  // Get suggested questions for new users
  getSuggestedQuestions(): string[] {
    return [
      "How can I teach addition to Grade 2 students using local examples?",
      "What are effective ways to explain fractions using Cameroonian contexts?",
      "How do I create engaging math lessons about money using CFA francs?",
      "What teaching strategies work best for multiplication tables?",
      "How can parents help their children with math homework at home?",
      "What are common math difficulties for primary school students?",
      "How do I assess student progress in mathematics effectively?",
      "Can you suggest math games using local materials?"
    ];
  }

  // Generate conversation starters based on user role
  getConversationStarters(userRole: 'teacher' | 'parent' | 'student'): string[] {
    switch (userRole) {
      case 'teacher':
        return [
          "Help me plan a lesson on shapes using local objects",
          "What's the best way to teach word problems?",
          "How do I differentiate math instruction for different ability levels?",
          "Suggest assessment strategies for primary math"
        ];
      case 'parent':
        return [
          "How can I help my child with math at home?",
          "My child struggles with math - what should I do?",
          "What math skills should my Grade 2 child know?",
          "How do I make math fun for my child?"
        ];
      case 'student':
        return [
          "I need help with addition problems",
          "Can you explain subtraction in a simple way?",
          "Help me understand shapes and their properties",
          "Show me how to solve word problems step by step"
        ];
      default:
        return this.getSuggestedQuestions();
    }
  }
}

export default ChatbotService;
export type { ChatMessage, ChatbotResponse };
