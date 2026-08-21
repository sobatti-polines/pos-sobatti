const fs = require('fs');
const { execSync } = require('child_process');

const files = execSync('grep -rl "import { getTodayWIB } from \\"@/lib/utils\\";" app/ components/ lib/').toString().trim().split('\n').filter(Boolean);

files.forEach(file => {
  let content = fs.readFileSync(file, 'utf8');
  const importLine = 'import { getTodayWIB } from "@/lib/utils";\n';
  if (content.startsWith(importLine)) {
    content = content.substring(importLine.length);
    // Find the end of directives
    const lines = content.split('\n');
    let insertIdx = 0;
    while (insertIdx < lines.length && (lines[insertIdx].startsWith('"use client"') || lines[insertIdx].startsWith('"use server"') || lines[insertIdx].startsWith("'use client'") || lines[insertIdx].startsWith("'use server'") || lines[insertIdx].trim() === '')) {
      insertIdx++;
    }
    lines.splice(insertIdx, 0, 'import { getTodayWIB } from "@/lib/utils";');
    fs.writeFileSync(file, lines.join('\n'));
  }
});
console.log("Fixed directives");
