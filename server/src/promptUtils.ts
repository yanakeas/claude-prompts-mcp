import fs from 'fs/promises';
import path from 'path';
import { PromptsFile, PromptData, PromptsConfigFile } from './types.js';

// Create a simple logger since we can't import from index.ts
const log = {
  info: (message: string, ...args: any[]) => {
    console.log(`[INFO] ${message}`, ...args);
  },
  error: (message: string, ...args: any[]) => {
    console.error(`[ERROR] ${message}`, ...args);
  },
  warn: (message: string, ...args: any[]) => {
    console.warn(`[WARN] ${message}`, ...args);
  }
};

/**
 * Reads a prompt file and returns its content
 * @param promptFilePath Path to the prompt file
 * @returns The content of the prompt file
 */
export async function readPromptFile(promptFilePath: string): Promise<string> {
  try {
    return await fs.readFile(promptFilePath, 'utf8');
  } catch (error) {
    log.error(`Error reading prompt file ${promptFilePath}:`, error);
    throw new Error(`Failed to read prompt file: ${error instanceof Error ? error.message : String(error)}`);
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
      sections.description = '';
    }
  }
  
  // Extract other sections (## headings)
  const sectionMatches = content.matchAll(/## ([^\n]+)\n\n([\s\S]+?)(?=\n## |\n# |\n$)/g);
  for (const match of sectionMatches) {
    const sectionName = match[1].trim();
    const sectionContent = match[2].trim();
    sections[sectionName] = sectionContent;
  }
  
  return sections;
}

/**
 * Modifies a section of a prompt
 * @param promptId The ID of the prompt to modify
 * @param sectionName The name of the section to modify
 * @param newContent The new content for the section
 * @param configPath Path to the promptsConfig.json file
 * @returns A message indicating success or failure
 */
export async function modifyPromptSection(
  promptId: string,
  sectionName: string,
  newContent: string,
  configPath: string
): Promise<string> {
  try {
    // Read the promptsConfig.json file
    const configFilePath = path.resolve(configPath);
    const configContent = await fs.readFile(configFilePath, 'utf8');
    const promptsConfig = JSON.parse(configContent) as PromptsConfigFile;
    
    // Find the prompt in all category files
    let prompt: PromptData | null = null;
    let categoryFilePath: string = '';
    let promptIndex: number = -1;
    let promptsFile: any = null;
    
    // Search through each import path
    for (const importPath of promptsConfig.imports) {
      try {
        // Construct the full path to the import file
        const fullImportPath = path.resolve(path.dirname(configFilePath), importPath);
        
        // Check if the file exists
        try {
          await fs.access(fullImportPath);
        } catch (error) {
          log.warn(`Import file not found: ${importPath}. Skipping.`);
          continue;
        }
        
        // Read the file
        const fileContent = await fs.readFile(fullImportPath, 'utf8');
        const categoryPromptsFile = JSON.parse(fileContent);
        
        if (categoryPromptsFile.prompts && Array.isArray(categoryPromptsFile.prompts)) {
          // Find the prompt in this category file
          const foundIndex = categoryPromptsFile.prompts.findIndex((p: PromptData) => p.id === promptId);
          
          if (foundIndex !== -1) {
            prompt = categoryPromptsFile.prompts[foundIndex];
            categoryFilePath = fullImportPath;
            promptIndex = foundIndex;
            promptsFile = categoryPromptsFile;
            break;
          }
        }
      } catch (error) {
        log.error(`Error processing import file ${importPath}:`, error);
      }
    }
    
    // If prompt not found, throw an error
    if (!prompt) {
      throw new Error(`Prompt with ID '${promptId}' not found in any category file`);
    }
    
    // Determine the category folder path
    const categoryFolder = path.dirname(categoryFilePath);
    
    // Get the full path to the prompt file (considering it might be relative to the category folder)
    let promptFilePath: string;
    if (prompt.file.startsWith('/')) {
      // Absolute path
      promptFilePath = path.resolve(path.dirname(configFilePath), prompt.file.slice(1));
    } else if (prompt.file.includes('/')) {
      // Path already includes category
      promptFilePath = path.resolve(path.dirname(configFilePath), prompt.file);
    } else {
      // Relative to category folder
      promptFilePath = path.resolve(categoryFolder, prompt.file);
    }
    
    // Read the prompt file
    const promptContent = await readPromptFile(promptFilePath);
    
    // Parse the prompt sections
    const sections = parsePromptSections(promptContent);
    
    // Check if the section exists
    if (!(sectionName in sections) && sectionName !== 'description') {
      throw new Error(`Section '${sectionName}' not found in prompt '${promptId}'`);
    }
    
    // Store the original prompt data for potential rollback
    const originalPrompt = { ...prompt };
    const originalContent = promptContent;
    
    // Modify the section
    if (sectionName === 'title') {
      sections.title = newContent;
    } else if (sectionName === 'description') {
      sections.description = newContent;
    } else {
      sections[sectionName] = newContent;
    }
    
    // Reconstruct the prompt content
    let newPromptContent = `# ${sections.title}\n\n${sections.description}\n\n`;
    
    // Add other sections
    for (const [name, content] of Object.entries(sections)) {
      if (name !== 'title' && name !== 'description') {
        newPromptContent += `## ${name}\n\n${content}\n\n`;
      }
    }
    
    // Create a backup of the original prompt file
    const backupPath = `${promptFilePath}.bak`;
    await fs.writeFile(backupPath, originalContent, 'utf8');
    
    try {
      // Remove the prompt from the category file
      promptsFile.prompts.splice(promptIndex, 1);
      await fs.writeFile(categoryFilePath, JSON.stringify(promptsFile, null, 2), 'utf8');
      
      // Create the updated prompt
      const updatedPrompt: PromptData = {
        ...originalPrompt,
        name: sectionName === 'title' ? newContent : originalPrompt.name
      };
      
      // Write the updated prompt file
      await fs.writeFile(promptFilePath, newPromptContent, 'utf8');
      
      // Update the category file with the updated prompt
      promptsFile.prompts.push(updatedPrompt);
      await fs.writeFile(categoryFilePath, JSON.stringify(promptsFile, null, 2), 'utf8');
      
      return `Successfully modified section '${sectionName}' in prompt '${promptId}'`;
    } catch (error) {
      // Rollback if an error occurs
      log.error(`Error modifying prompt section, rolling back:`, error);
      
      // Restore the original prompt file
      await fs.copyFile(backupPath, promptFilePath);
      
      // Restore the category file
      if (promptIndex !== -1) {
        promptsFile.prompts[promptIndex] = originalPrompt;
        await fs.writeFile(categoryFilePath, JSON.stringify(promptsFile, null, 2), 'utf8');
      }
      
      throw new Error(`Failed to modify prompt section: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      // Clean up the backup file
      try {
        await fs.unlink(backupPath);
      } catch (error) {
        log.warn(`Failed to delete backup file ${backupPath}:`, error);
      }
    }
  } catch (error) {
    log.error(`Error in modifyPromptSection:`, error);
    throw new Error(`Failed to modify prompt section: ${error instanceof Error ? error.message : String(error)}`);
  }
} 