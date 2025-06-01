import {
  DeleteObjectCommand,
  GetObjectCommand,
  ListObjectsV2Command,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";

// Initialize S3 client
const s3 = new S3Client({
  region: process.env.AWS_REGION || "us-east-1",
});

// The bucket name should be set in environment variables
const bucketName = process.env.S3_BUCKET;

// Logger function
const logger = {
  info: (message: string, ...args: any[]) =>
    console.log(`[INFO] ${message}`, ...args),
  error: (message: string, ...args: any[]) =>
    console.error(`[ERROR] ${message}`, ...args),
  warn: (message: string, ...args: any[]) =>
    console.warn(`[WARN] ${message}`, ...args),
};

// In-memory fallback storage when S3 is not configured
const memoryStorage: Record<string, string> = {};

// Helper to check S3 configuration and use fallback if needed
function checkS3Config(operation: string): boolean {
  if (!bucketName) {
    logger.warn(
      `S3_BUCKET not set. Using in-memory storage for ${operation} operation.`
    );
    return false;
  }
  return true;
}

/**
 * Read a file from S3
 * @param key The S3 object key (path)
 * @returns The file content as string
 */
export async function readFromS3(key: string): Promise<string> {
  if (!checkS3Config("read")) {
    // Use in-memory fallback
    if (key === "index.json" && !memoryStorage[key]) {
      // Initialize with empty data if index.json doesn't exist
      memoryStorage[key] = JSON.stringify({ prompts: [], categories: [] });
    }

    if (!memoryStorage[key]) {
      throw new Error(`File not found in memory storage: ${key}`);
    }
    return memoryStorage[key];
  }

  try {
    const command = new GetObjectCommand({
      Bucket: bucketName,
      Key: key,
    });

    const response = await s3.send(command);
    if (!response.Body) {
      throw new Error(`File not found: ${key}`);
    }

    return await response.Body.transformToString("utf-8");
  } catch (error) {
    logger.error(`Error reading from S3 (${key}):`, error);
    throw error;
  }
}

/**
 * Write a file to S3
 * @param key The S3 object key (path)
 * @param content The content to write
 * @param contentType Optional content type (defaults to text/markdown)
 */
export async function writeToS3(
  key: string,
  content: string,
  contentType: string = "text/markdown"
): Promise<void> {
  if (!checkS3Config("write")) {
    // Use in-memory fallback
    memoryStorage[key] = content;
    logger.info(`Successfully wrote to memory storage: ${key}`);
    return;
  }

  try {
    const command = new PutObjectCommand({
      Bucket: bucketName,
      Key: key,
      Body: content,
      ContentType: contentType,
    });

    await s3.send(command);
    logger.info(`Successfully wrote to S3: ${key}`);
  } catch (error) {
    logger.error(`Error writing to S3 (${key}):`, error);
    throw error;
  }
}

/**
 * Delete a file from S3
 * @param key The S3 object key (path)
 */
export async function deleteFromS3(key: string): Promise<void> {
  if (!checkS3Config("delete")) {
    // Use in-memory fallback
    if (memoryStorage[key]) {
      delete memoryStorage[key];
      logger.info(`Successfully deleted from memory storage: ${key}`);
    }
    return;
  }

  try {
    const command = new DeleteObjectCommand({
      Bucket: bucketName,
      Key: key,
    });

    await s3.send(command);
    logger.info(`Successfully deleted from S3: ${key}`);
  } catch (error) {
    logger.error(`Error deleting from S3 (${key}):`, error);
    throw error;
  }
}

/**
 * List files in S3 with a prefix
 * @param prefix The prefix to filter objects by
 * @returns Array of keys (filenames)
 */
export async function listS3Files(prefix: string = ""): Promise<string[]> {
  if (!checkS3Config("list")) {
    // Use in-memory fallback
    return Object.keys(memoryStorage).filter((key) => key.startsWith(prefix));
  }

  try {
    const command = new ListObjectsV2Command({
      Bucket: bucketName,
      Prefix: prefix,
    });

    const response = await s3.send(command);
    const files = response.Contents?.map((item) => item.Key as string) || [];
    return files;
  } catch (error) {
    logger.error(`Error listing S3 files (prefix: ${prefix}):`, error);
    throw error;
  }
}

/**
 * Check if an object exists in S3
 * @param key The S3 object key to check
 * @returns boolean indicating if the object exists
 */
export async function existsInS3(key: string): Promise<boolean> {
  if (!checkS3Config("check")) {
    // Use in-memory fallback
    return key in memoryStorage;
  }

  try {
    const command = new GetObjectCommand({
      Bucket: bucketName,
      Key: key,
    });

    await s3.send(command);
    return true;
  } catch (error) {
    // If the error is because the object doesn't exist, return false
    // Otherwise, propagate the error
    if ((error as any).name === "NoSuchKey") {
      return false;
    }
    throw error;
  }
}
