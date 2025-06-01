#!/usr/bin/env node

/**
 * Script to convert SVG logo to PNG
 * Requires: npm install canvas sharp
 * Usage: node scripts/convert-logo.js
 */

import { createCanvas } from "canvas";
import fs from "fs/promises";
import path from "path";
import sharp from "sharp";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, "..");

// Convert SVG to PNG
async function convertSvgToPng(svgPath, pngPath, size = 512) {
  try {
    console.log(`Converting ${svgPath} to ${pngPath}`);

    // Read the SVG file
    const svgContent = await fs.readFile(svgPath, "utf8");

    // Use sharp to convert SVG to PNG
    await sharp(Buffer.from(svgContent))
      .resize(size, size)
      .png()
      .toFile(pngPath);

    console.log("✅ Conversion successful!");
  } catch (error) {
    console.error("Error converting SVG to PNG:", error);
    process.exit(1);
  }
}

// Create a simple PNG if conversion fails
async function createSimplePng(pngPath, size = 512) {
  try {
    console.log(`Creating simple PNG logo at ${pngPath}`);

    // Create a canvas
    const canvas = createCanvas(size, size);
    const ctx = canvas.getContext("2d");

    // Draw a circle
    ctx.fillStyle = "#f8f9fa";
    ctx.beginPath();
    ctx.arc(size / 2, size / 2, size / 2 - 5, 0, Math.PI * 2);
    ctx.fill();

    // Add a border
    ctx.strokeStyle = "#3498db";
    ctx.lineWidth = 10;
    ctx.stroke();

    // Add text
    ctx.fillStyle = "#2c3e50";
    ctx.font = `bold ${size / 8}px Arial, sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("Prompt", size / 2, size / 2 - size / 10);
    ctx.fillText("Library", size / 2, size / 2 + size / 10);

    // Save the image
    const buffer = canvas.toBuffer("image/png");
    await fs.writeFile(pngPath, buffer);

    console.log("✅ Created simple PNG logo!");
  } catch (error) {
    console.error("Error creating simple PNG:", error);
    process.exit(1);
  }
}

// Main function
async function main() {
  const svgPath = path.join(rootDir, "public", "logo.svg");
  const pngPath = path.join(rootDir, "public", "logo.png");

  try {
    // Check if the SVG exists
    await fs.access(svgPath);

    // Try to convert SVG to PNG
    try {
      await convertSvgToPng(svgPath, pngPath);
    } catch (error) {
      console.warn(
        "SVG conversion failed, creating simple PNG instead:",
        error.message
      );
      await createSimplePng(pngPath);
    }
  } catch (error) {
    // SVG doesn't exist, create a simple PNG
    console.warn("SVG file not found, creating simple PNG instead");
    await createSimplePng(pngPath);
  }
}

// Run the script
main();
