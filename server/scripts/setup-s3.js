#!/usr/bin/env node

/**
 * Script to initialize the S3 bucket with a basic structure and sample prompt
 * Usage: node scripts/setup-s3.js
 */

import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

// Load environment variables
dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Initialize S3 client
const s3 = new S3Client({
  region: process.env.AWS_REGION || "us-east-1",
});

// The bucket name from environment variable
const bucketName = process.env.S3_BUCKET;

// Sample prompt content
const samplePromptContent = `# Content Analysis

This prompt analyzes the content to identify key themes, tone, and structure.

## System Message

You are a content analysis assistant with expertise in writing, language patterns, and document structure. Your task is to analyze any text provided and offer clear, constructive insights.

## User Message Template

Please analyze the following content:

{{content}}

Provide an analysis covering:
1. Main themes and key points
2. Tone and style
3. Organizational structure
4. Strengths and potential improvements
`;

// Sample index.json content
const indexContent = {
  prompts: [
    {
      id: "content_analysis",
      name: "Content Analysis",
      category: "analysis",
      description:
        "Analyzes content to identify key themes, tone, and structure",
      file: "content_analysis.md",
      arguments: [
        {
          name: "content",
          description: "The content to analyze",
          required: true,
        },
      ],
      isChain: false,
      tools: false,
    },
  ],
  categories: [
    {
      id: "analysis",
      name: "Analysis Tools",
      description: "Prompts for analyzing different types of content",
    },
  ],
};

// Main function
async function setupS3() {
  if (!bucketName) {
    console.error("Error: S3_BUCKET environment variable is not set");
    process.exit(1);
  }

  try {
    console.log(`Setting up S3 bucket: ${bucketName}`);

    // Upload index.json
    await uploadToS3(
      "index.json",
      JSON.stringify(indexContent, null, 2),
      "application/json"
    );
    console.log("✅ Uploaded index.json");

    // Create prompts/analysis directory structure with sample prompt
    await uploadToS3(
      "prompts/analysis/content_analysis.md",
      samplePromptContent,
      "text/markdown"
    );
    console.log(
      "✅ Uploaded sample prompt: prompts/analysis/content_analysis.md"
    );

    // Create empty references directory
    await uploadToS3("references/.keep", "", "text/plain");
    console.log("✅ Created references directory");

    console.log("\nS3 setup completed successfully!");
    console.log("\nYou can now start the server with: npm start");
  } catch (error) {
    console.error("Error setting up S3:", error);
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

// Run the setup
setupS3();
