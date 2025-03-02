// Define types for configuration
export interface ServerConfig {
  name: string;
  version: string;
  port: number;
}

export interface PromptsConfig {
  file: string;
  registrationMode?: "id" | "name" | "both";
}

export interface TransportConfig {
  enabled: boolean;
}

export interface TransportsConfig {
  default: string;
  sse: TransportConfig;
  stdio: TransportConfig;
  [key: string]: TransportConfig | string;
}

export interface Config {
  server: ServerConfig;
  prompts: PromptsConfig;
  transports: TransportsConfig;
}

// Define types for prompts
export interface PromptArgument {
  name: string;
  description?: string;
  required: boolean;
}

export interface MessageContent {
  type: "text";
  text: string;
}

export interface Message {
  role: "user" | "assistant" | "system";
  content: MessageContent;
}

export interface Category {
  id: string;
  name: string;
  description: string;
}

export interface PromptData {
  id: string;
  name: string;
  category: string;
  description: string;
  file: string;
  arguments: PromptArgument[];
}

export interface PromptsFile {
  categories: Category[];
  prompts: PromptData[];
}

// Define types for prompt file content
export interface PromptFile {
  title: string;
  description: string;
  systemMessage?: string;
  userMessageTemplate: string;
}