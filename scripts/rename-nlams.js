// scripts/rename-nlams.js
/**
 * Bulk replace utility – changes every occurrence of "NLAMS" to "BHUMITRA"
 * across the repository (excluding binary files and .git directory).
 *
 * Usage: `node scripts/rename-nlams.js`
 */
const fs = require('fs');
const path = require('path');

function isBinary(filePath) {
  // Simple heuristic: skip common binary extensions.
  const binaryExt = ['.png', '.jpg', '.jpeg', '.gif', '.ico', '.pdf', '.zip', '.gz'];
  return binaryExt.includes(path.extname(filePath).toLowerCase());
}

function replaceInFile(file) {
  const content = fs.readFileSync(file, 'utf8');
  if (content.includes('NLAMS')) {
    const newContent = content.replace(/NLAMS/g, 'BHUMITRA');
    fs.writeFileSync(file, newContent, 'utf8');
    console.log(`Updated ${file}`);
  }
}

function walk(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === '.git') continue; // skip repo metadata
      walk(fullPath);
    } else if (entry.isFile() && !isBinary(fullPath)) {
      replaceInFile(fullPath);
    }
  }
}

walk(process.cwd());
