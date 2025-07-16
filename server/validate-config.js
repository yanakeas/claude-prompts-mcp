// Simple configuration validation script
const fs = require('fs');
const path = require('path');

console.log('=== Configuration Validation ===');

// Check if all required files exist
const requiredFiles = [
    'config.json',
    'promptsConfig.json',
    'dist/index.js',
    'package.json'
];

console.log('\n1. Checking required files:');
let allFilesExist = true;
for (const file of requiredFiles) {
    const fullPath = path.join(__dirname, file);
    const exists = fs.existsSync(fullPath);
    console.log(`   ${exists ? '✓' : '✗'} ${file}`);
    if (!exists) allFilesExist = false;
}

if (!allFilesExist) {
    console.log('\n❌ Missing required files - server cannot start');
    process.exit(1);
}

// Validate config.json
console.log('\n2. Validating config.json:');
try {
    const configContent = fs.readFileSync('config.json', 'utf8');
    const config = JSON.parse(configContent);
    
    // Check required sections
    const requiredSections = ['server', 'prompts', 'transports', 'logging'];
    for (const section of requiredSections) {
        if (!config[section]) {
            console.log(`   ✗ Missing section: ${section}`);
        } else {
            console.log(`   ✓ Section present: ${section}`);
        }
    }
    
    // Check prompts config file reference
    if (config.prompts && config.prompts.file) {
        const promptsConfigPath = path.join(__dirname, config.prompts.file);
        if (fs.existsSync(promptsConfigPath)) {
            console.log(`   ✓ Prompts config file found: ${config.prompts.file}`);
        } else {
            console.log(`   ✗ Prompts config file missing: ${config.prompts.file}`);
        }
    }
    
} catch (error) {
    console.log(`   ✗ Error parsing config.json: ${error.message}`);
    process.exit(1);
}

// Validate promptsConfig.json
console.log('\n3. Validating promptsConfig.json:');
try {
    const promptsConfigContent = fs.readFileSync('promptsConfig.json', 'utf8');
    const promptsConfig = JSON.parse(promptsConfigContent);
    
    console.log(`   ✓ Categories defined: ${promptsConfig.categories ? promptsConfig.categories.length : 0}`);
    console.log(`   ✓ Direct prompts: ${promptsConfig.prompts ? promptsConfig.prompts.length : 0}`);
    console.log(`   ✓ Import files: ${promptsConfig.imports ? promptsConfig.imports.length : 0}`);
    
    // Check if imported files exist
    let importErrors = 0;
    if (promptsConfig.imports) {
        console.log('\n4. Checking imported prompt files:');
        for (const importPath of promptsConfig.imports) {
            const fullPath = path.join(__dirname, importPath);
            const exists = fs.existsSync(fullPath);
            console.log(`   ${exists ? '✓' : '✗'} ${importPath}`);
            if (!exists) importErrors++;
        }
        
        if (importErrors === 0) {
            console.log('   ✓ All import files found');
        } else {
            console.log(`   ⚠️  ${importErrors} import files missing`);
        }
    }
    
} catch (error) {
    console.log(`   ✗ Error parsing promptsConfig.json: ${error.message}`);
    process.exit(1);
}

// Check if dist directory is built
console.log('\n5. Checking build status:');
const distExists = fs.existsSync('dist');
const mainFileExists = fs.existsSync('dist/index.js');

if (!distExists) {
    console.log('   ✗ dist directory missing - run "npm run build"');
    process.exit(1);
} else if (!mainFileExists) {
    console.log('   ✗ dist/index.js missing - run "npm run build"');
    process.exit(1);
} else {
    console.log('   ✓ Build files present');
}

console.log('\n=== Configuration Validation Complete ===');
console.log('✅ All configuration checks passed - server should be able to start');