#!/usr/bin/env node

/**
 * Script to migrate prompts from the local filesystem to S3
 * Usage: node scripts/migrate-to-s3.js
 */

import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import dotenv from "dotenv";
import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";

// Load environment variables
dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, "..");

// Initialize S3 client
const s3 = new S3Client({
  region: process.env.AWS_REGION || "us-east-1",
});

// The bucket name from environment variable
const bucketName = process.env.S3_BUCKET;

// Main function
async function migrateToS3() {
  if (!bucketName) {
    console.error("Error: S3_BUCKET environment variable is not set");
    process.exit(1);
  }

  try {
    console.log(`Migrating prompts to S3 bucket: ${bucketName}`);

    // Read the promptsConfig.json file
    const configPath = path.join(rootDir, "promptsConfig.json");
    const configContent = await fs.readFile(configPath, "utf8");
    const promptsConfig = JSON.parse(configContent);

    // Create a new index structure
    const index = {
      prompts: [],
      categories: promptsConfig.categories || [],
    };

    // Load all the prompts from each category file
    for (const importPath of promptsConfig.imports || []) {
      try {
        const categoryPath = path.join(rootDir, importPath);
        const categoryContent = await fs.readFile(categoryPath, "utf8");
        const categoryFile = JSON.parse(categoryContent);

        // Get the category ID from the path
        const categoryMatch = importPath.match(/prompts\/([^/]+)/);
        const categoryId = categoryMatch ? categoryMatch[1] : "default";

        // Process each prompt in this category
        for (const prompt of categoryFile.prompts || []) {
          // Resolve the prompt file path
          let promptFilePath;
          if (prompt.file.includes("/")) {
            promptFilePath = path.join(rootDir, prompt.file);
          } else {
            promptFilePath = path.join(path.dirname(categoryPath), prompt.file);
          }

          try {
            // Read the prompt markdown content
            const promptContent = await fs.readFile(promptFilePath, "utf8");

            // Upload the prompt markdown to S3
            const s3Key = `prompts/${categoryId}/${path.basename(prompt.file)}`;
            await uploadToS3(s3Key, promptContent, "text/markdown");
            console.log(`✅ Uploaded prompt: ${s3Key}`);

            // Add the prompt to our index
            index.prompts.push({
              ...prompt,
              category: categoryId,
              file: path.basename(prompt.file),
            });
          } catch (promptError) {
            console.error(
              `Error processing prompt '${prompt.id}':`,
              promptError
            );
          }
        }
      } catch (categoryError) {
        console.error(
          `Error processing category file '${importPath}':`,
          categoryError
        );
      }
    }

    // Upload the index.json file
    await uploadToS3(
      "index.json",
      JSON.stringify(index, null, 2),
      "application/json"
    );
    console.log("✅ Uploaded index.json");

    // Create empty references directory
    await uploadToS3("references/.keep", "", "text/plain");
    console.log("✅ Created references directory");

    console.log("\nMigration completed successfully!");
    console.log(
      `Migrated ${index.prompts.length} prompts and ${index.categories.length} categories.`
    );
    console.log("\nYou can now start the server with: npm start");
  } catch (error) {
    console.error("Error during migration:", error);
    process.exit(1);
  }
}

// Helper function to upload a file to S3
async function uploadToS3(key, content, contentType) {
  try {
    const command = new PutObjectCommand({
      Bucket: bucketName,
      Key: key,
      Body: content,
      ContentType: contentType,
    });

    await s3.send(command);
  } catch (error) {
    console.error(`Error uploading ${key} to S3:`, error);
    throw error;
  }
}

// Run the migration
migrateToS3();
