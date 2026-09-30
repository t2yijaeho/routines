interface BrowserLanguageModelSession {
  prompt(input: string): Promise<string>;
  destroy?: () => void;
}

interface BrowserLanguageModelMonitor {
  addEventListener(
    type: "downloadprogress",
    listener: (event: { loaded: number }) => void,
  ): void;
}

interface BrowserLanguageModel {
  availability(options?: {
    expectedInputs?: Array<{ type: "text"; languages: string[] }>;
    expectedOutputs?: Array<{ type: "text"; languages: string[] }>;
  }): Promise<"unavailable" | "downloadable" | "downloading" | "available">;
  create(options?: {
    expectedInputs?: Array<{ type: "text"; languages: string[] }>;
    expectedOutputs?: Array<{ type: "text"; languages: string[] }>;
    initialPrompts?: Array<{
      role: "system" | "user" | "assistant";
      content: string;
    }>;
    monitor?: (monitor: BrowserLanguageModelMonitor) => void;
  }): Promise<BrowserLanguageModelSession>;
}

interface Window {
  LanguageModel?: BrowserLanguageModel;
}
