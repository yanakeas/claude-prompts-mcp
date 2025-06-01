import path from "path";
import { PromptData } from "./types.js";
import {
  deleteFromS3,
  existsInS3,
  listS3Files,
  readFromS3,
  writeToS3,
} from "./utils/s3Utils.js";

// Create a simple logger
const log = {
  info: (message: string, ...args: any[]) => {
    console.log(`[INFO] ${message}`, ...args);
  },
  error: (message: string, ...args: any[]) => {
    console.error(`[ERROR] ${message}`, ...args);
  },
  warn: (message: string, ...args: any[]) => {
    console.warn(`[WARN] ${message}`, ...args);
  },
};

/**
 * Resolves a prompt S3 key consistently
 * @param promptFile The file key from the prompt data
 * @param categoryKey The category key part
 * @returns The fully resolved S3 key for the prompt file
 */
export function resolvePromptS3Key(
  promptFile: string,
  categoryKey: string
): string {
  if (promptFile.startsWith("/")) {
    // Absolute path
    return promptFile.slice(1);
  } else if (promptFile.includes("/")) {
    // Path already includes subdirectories
    return promptFile;
  } else {
    // Simple filename, relative to category
    return path.posix.join(categoryKey, promptFile);
  }
}

/**
 * Reads a prompt file from S3 and returns its content
 * @param s3Key S3 key for the prompt file
 * @returns The content of the prompt file
 */
export async function readPromptFile(s3Key: string): Promise<string> {
  try {
    return await readFromS3(s3Key);
  } catch (error) {
    log.error(`Error reading prompt file from S3 (${s3Key}):`, error);
    throw new Error(
      `Failed to read prompt file: ${
        error instanceof Error ? error.message : String(error)
      }`
    );
  }
}

/**
 * Parses a prompt file content into sections
 * @param content The content of the prompt file
 * @returns An object containing the different sections of the prompt
 */
export function parsePromptSections(content: string): Record<string, string> {
  const sections: Record<string, string> = {};

  // Extract the title and description (everything before the first ## heading)
  const titleMatch = content.match(/^# (.+?)(?=\n\n|\n##)/s);
  if (titleMatch) {
    sections.title = titleMatch[1].trim();

    // Extract description (content between title and first ## heading)
    const descMatch = content.match(/^# .+?\n\n([\s\S]+?)(?=\n## )/s);
    if (descMatch) {
      sections.description = descMatch[1].trim();
    } else {
      sections.description = "";
    }
  }

  // Extract other sections (## headings)
  const sectionMatches = content.matchAll(
    /## ([^\n]+)\n\n([\s\S]+?)(?=\n## |\n# |\n$)/g
  );
  for (const match of sectionMatches) {
    const sectionName = match[1].trim();
    const sectionContent = match[2].trim();
    sections[sectionName] = sectionContent;
  }

  return sections;
}

/**
 * Modifies a specific section of a prompt markdown file stored in S3
 * @param promptId Unique identifier of the prompt to modify
 * @param sectionName Name of the section to modify
 * @param newContent New content for the specified section
 * @returns Object containing the result of the operation
 */
export async function modifyPromptSection(
  promptId: string,
  sectionName: string,
  newContent: string
): Promise<{
  success: boolean;
  message: string;
  promptData?: PromptData;
  s3Key?: string;
}> {
  try {
    // Get the index.json file from S3
    const indexContent = await readFromS3("index.json");
    const promptsIndex = JSON.parse(indexContent) as {
      prompts: PromptData[];
      categories: any[];
    };

    // Find the prompt in the index
    const promptIndex = promptsIndex.prompts.findIndex(
      (p) => p.id === promptId
    );
    if (promptIndex === -1) {
      return {
        success: false,
        message: `Prompt with ID '${promptId}' not found in the index`,
      };
    }

    const prompt = promptsIndex.prompts[promptIndex];
    const categoryKey = `prompts/${prompt.category}`;

    // Determine the S3 key for the prompt file
    const promptS3Key = resolvePromptS3Key(prompt.file, categoryKey);

    // Read the prompt file content
    const promptContent = await readPromptFile(promptS3Key);

    // Parse the prompt sections
    const sections = parsePromptSections(promptContent);

    // Check if the section exists
    if (!(sectionName in sections) && sectionName !== "description") {
      return {
        success: false,
        message: `Section '${sectionName}' not found in prompt '${promptId}'`,
      };
    }

    // Modify the section
    if (sectionName === "title") {
      sections.title = newContent;
    } else if (sectionName === "description") {
      sections.description = newContent;
    } else {
      sections[sectionName] = newContent;
    }

    // Reconstruct the prompt content
    let newPromptContent = `# ${sections.title}\n\n${sections.description}\n\n`;

    // Add other sections
    for (const [name, content] of Object.entries(sections)) {
      if (name !== "title" && name !== "description") {
        newPromptContent += `## ${name}\n\n${content}\n\n`;
      }
    }

    // Create the updated prompt data
    const updatedPrompt: PromptData = {
      ...prompt,
      name: sectionName === "title" ? newContent : prompt.name,
    };

    // Update the index with the modified prompt
    promptsIndex.prompts[promptIndex] = updatedPrompt;

    try {
      // Write the updated prompt content to S3
      await writeToS3(promptS3Key, newPromptContent);

      // Write the updated index to S3
      await writeToS3(
        "index.json",
        JSON.stringify(promptsIndex, null, 2),
        "application/json"
      );

      return {
        success: true,
        message: `Successfully modified section '${sectionName}' in prompt '${promptId}'`,
        promptData: updatedPrompt,
        s3Key: promptS3Key,
      };
    } catch (writeError) {
      log.error(`Error writing updated files to S3:`, writeError);
      return {
        success: false,
        message: `Failed to write updated files to S3: ${
          writeError instanceof Error ? writeError.message : String(writeError)
        }`,
      };
    }
  } catch (error) {
    log.error(`Error in modifyPromptSection:`, error);
    return {
      success: false,
      message: `Failed to modify prompt section: ${
        error instanceof Error ? error.message : String(error)
      }`,
    };
  }
}

/**
 * Safely writes content to an S3 object
 * @param s3Key The S3 key (path)
 * @param content Content to write
 * @param contentType Optional content type (defaults to 'text/markdown')
 */
export async function safeWriteFile(
  s3Key: string,
  content: string,
  contentType: string = "text/markdown"
): Promise<void> {
  try {
    await writeToS3(s3Key, content, contentType);
  } catch (error) {
    log.error(`Error writing to S3 (${s3Key}):`, error);
    throw error;
  }
}

/**
 * Finds and deletes a prompt file from S3
 * @param promptId Unique identifier of the prompt to delete
 * @returns Object containing information about the deletion
 */
export async function findAndDeletePromptFile(promptId: string): Promise<{
  found: boolean;
  deleted: boolean;
  path?: string;
  error?: string;
}> {
  try {
    // Get the index.json file from S3
    const indexContent = await readFromS3("index.json");
    const promptsIndex = JSON.parse(indexContent) as {
      prompts: PromptData[];
      categories: any[];
    };

    // Find the prompt in the index
    const promptIndex = promptsIndex.prompts.findIndex(
      (p) => p.id === promptId
    );
    if (promptIndex === -1) {
      return { found: false, deleted: false };
    }

    const prompt = promptsIndex.prompts[promptIndex];
    const categoryKey = `prompts/${prompt.category}`;

    // Determine the S3 key for the prompt file
    const promptS3Key = resolvePromptS3Key(prompt.file, categoryKey);

    // Check if the file exists
    const exists = await existsInS3(promptS3Key);
    if (!exists) {
      return {
        found: false,
        deleted: false,
        error: `Prompt file not found in S3: ${promptS3Key}`,
      };
    }

    // Delete the file from S3
    try {
      await deleteFromS3(promptS3Key);

      // Remove the prompt from the index and update it
      promptsIndex.prompts.splice(promptIndex, 1);
      await writeToS3(
        "index.json",
        JSON.stringify(promptsIndex, null, 2),
        "application/json"
      );

      return { found: true, deleted: true, path: promptS3Key };
    } catch (deleteError) {
      const errorMessage = `Error deleting file from S3 ${promptS3Key}: ${
        deleteError instanceof Error ? deleteError.message : String(deleteError)
      }`;
      log.error(errorMessage);
      return {
        found: true,
        deleted: false,
        path: promptS3Key,
        error: errorMessage,
      };
    }
  } catch (error) {
    const errorMessage = `Error finding and deleting prompt file: ${
      error instanceof Error ? error.message : String(error)
    }`;
    log.error(errorMessage);
    return { found: false, deleted: false, error: errorMessage };
  }
}

/**
 * Lists all prompt files in S3
 * @returns Array of prompt keys
 */
export async function listPromptFiles(): Promise<string[]> {
  try {
    return await listS3Files("prompts/");
  } catch (error) {
    log.error("Error listing prompt files from S3:", error);
    throw error;
  }
}
