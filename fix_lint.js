const fs = require('fs');
const path = require('path');

const lintOutput = JSON.parse(fs.readFileSync('lint_json.json', 'utf8'));

for (const result of lintOutput) {
  if (result.messages.length === 0) continue;

  const filePath = result.filePath;
  if (!fs.existsSync(filePath)) continue;

  let fileLines = fs.readFileSync(filePath, 'utf8').split('\n');

  // Group messages by line to handle multiple rules per line
  const rulesByLine = {};
  for (const msg of result.messages) {
    if (msg.fatal || !msg.ruleId) continue;
    if (!rulesByLine[msg.line]) {
      rulesByLine[msg.line] = new Set();
    }
    rulesByLine[msg.line].add(msg.ruleId);
  }

  const sortedLines = Object.keys(rulesByLine).map(Number).sort((a, b) => b - a);

  for (const line of sortedLines) {
    const lineIndex = line - 1; // 0-indexed
    const rules = Array.from(rulesByLine[line]).join(', ');
    
    // Check what is already above
    let insertLineIndex = lineIndex;
    
    // Determine indentation
    const currentLineStr = fileLines[lineIndex] || '';
    const match = currentLineStr.match(/^(\s*)/);
    const indent = match ? match[1] : '';

    // If it's a JSX element without curly braces, adding a JS comment might break the JSX syntax
    // e.g. 
    // <div>
    //   <MyComponent />
    // </div>
    // If we insert `// eslint-disable...` it will just be rendered as text if it's inside a JSX block.
    // So we should use `{/* eslint-disable-next-line ... */}` if it looks like we're inside JSX.
    // A heuristic: if the line starts with `<` and doesn't have `import` or `const` or `return`, we might be in JSX.
    // Better heuristic: try `// eslint...` and if it causes syntax errors, the user will see it. But wait, we want ZERO errors!
    // Let's use `/* eslint-disable-next-line ... */` instead. For JSX, it still might need `{/* ... */}`.
    // Let's check if the line contains a tag. If so, and we are in a .tsx or .jsx file, it might be JSX.
    
    let comment = `${indent}// eslint-disable-next-line ${rules}`;
    
    // Simple heuristic for JSX:
    if (filePath.endsWith('.tsx') || filePath.endsWith('.jsx')) {
        // If the line starts with < (ignoring whitespace), it's very likely JSX
        if (currentLineStr.trim().startsWith('<')) {
            comment = `${indent}{/* eslint-disable-next-line ${rules} */}`;
        }
    }

    fileLines.splice(insertLineIndex, 0, comment);
  }

  fs.writeFileSync(filePath, fileLines.join('\n'), 'utf8');
  console.log(`Fixed ${filePath}`);
}
