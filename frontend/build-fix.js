const fs = require('fs');
const path = require('path');

const outDir = path.join(__dirname, 'out');
const oldNextDir = path.join(outDir, '_next');
const newAssetsDir = path.join(outDir, 'assets');

// 1. Rename the _next directory to assets
if (fs.existsSync(oldNextDir)) {
  fs.renameSync(oldNextDir, newAssetsDir);
}

// 2. Delete forbidden files and directories starting with '_'
if (fs.existsSync(outDir)) {
  fs.readdirSync(outDir).forEach(file => {
    if (file.startsWith('_')) {
      const fullPath = path.join(outDir, file);
      if (fs.lstatSync(fullPath).isFile()) {
        fs.unlinkSync(fullPath);
        console.log(`Deleted forbidden file: ${file}`);
      } else if (fs.lstatSync(fullPath).isDirectory()) {
        fs.rmSync(fullPath, { recursive: true, force: true });
        console.log(`Deleted forbidden directory: ${file}`);
      }
    }
  });
}

// 3. Find and replace all references in the built files
function replaceInFiles(dir) {
  if (!fs.existsSync(dir)) return;
  
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);
    
    if (stat.isDirectory()) {
      replaceInFiles(filePath);
    } else if (/\.(html|css|js)$/.test(filePath)) {
      let content = fs.readFileSync(filePath, 'utf8');
      
      // Replace absolute and relative paths
      content = content.replace(/\/_next\//g, '/assets/');
      content = content.replace(/_next\//g, 'assets/');
      // Replace escaped paths inside JSON/JS strings
      content = content.replace(/\\\/_next\\\//g, '\\/assets\\/');
      
      fs.writeFileSync(filePath, content, 'utf8');
    }
  }
}

replaceInFiles(outDir);
// 4. Extract inline scripts to comply with Chrome Extension CSP
function extractInlineScripts(dir) {
  if (!fs.existsSync(dir)) return;
  
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);
    
    if (stat.isDirectory()) {
      extractInlineScripts(filePath);
    } else if (filePath.endsWith('.html')) {
      let content = fs.readFileSync(filePath, 'utf8');
      
      let scriptCounter = 0;
      // Regex to find all <script>...</script> tags without a src attribute
      const scriptRegex = /<script\b(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/gi;
      
      const newContent = content.replace(scriptRegex, (fullMatch, scriptContent) => {
        if (!scriptContent.trim()) return fullMatch;
        
        const baseName = path.basename(filePath, '.html');
        const scriptName = `${baseName}_inline_${scriptCounter++}.js`;
        const scriptPath = path.join(dir, scriptName);
        
        fs.writeFileSync(scriptPath, scriptContent, 'utf8');
        return `<script src="./${scriptName}"></script>`;
      });
      
      if (content !== newContent) {
        fs.writeFileSync(filePath, newContent, 'utf8');
        console.log(`Extracted ${scriptCounter} inline scripts from ${file}`);
      }
    }
  }
}

extractInlineScripts(outDir);
console.log('✅ Next.js build patched: Replaced "_next", purged forbidden files, and extracted inline scripts.');