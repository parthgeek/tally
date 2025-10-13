import { GoogleGenerativeAI } from "@google/generative-ai";

interface GeminiConfig {
  apiKey?: string;
  model?: string;
  temperature?: number;
}

interface GeminiResponse {
  text: string;
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
}

export class GeminiClient {
  private genAI: GoogleGenerativeAI;
  private model: any;
  private modelName: string;
  private temperature: number;

  constructor(config: GeminiConfig = {}) {
    const apiKey = config.apiKey || process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error("GEMINI_API_KEY environment variable is required");
    }

    this.modelName = config.model || "gemini-2.5-flash-lite";
    this.temperature = config.temperature ?? 1.0;
    this.genAI = new GoogleGenerativeAI(apiKey);
    this.model = this.genAI.getGenerativeModel({
      model: this.modelName,
      generationConfig: {
        temperature: this.temperature,
        maxOutputTokens: 200,
      },
    });
  }

  async generateContent(prompt: string): Promise<GeminiResponse> {
    try {
      const result = await this.model.generateContent(prompt);
      const response = await result.response;
      const text = response.text();

      // Note: Gemini API doesn't provide detailed token usage like OpenAI
      // We'll estimate based on text length for now
      const estimatedPromptTokens = Math.ceil(prompt.length / 4);
      const estimatedCompletionTokens = Math.ceil(text.length / 4);

      return {
        text,
        usage: {
          promptTokens: estimatedPromptTokens,
          completionTokens: estimatedCompletionTokens,
          totalTokens: estimatedPromptTokens + estimatedCompletionTokens,
        },
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      throw new Error(`Gemini API error: ${errorMessage}`);
    }
  }

  getModelName(): string {
    return this.modelName;
  }
}
