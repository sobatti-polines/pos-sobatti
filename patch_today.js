const fs = require('fs');
const { execSync } = require('child_process');

const files = execSync('grep -rl "new Date().toISOString().slice(0, 10)" app/ lib/ components/ || true').toString().trim().split('\n').filter(Boolean);

files.forEach(file => {
  let content = fs.readFileSync(file, 'utf8');
  if (!content.includes('getTodayWIB')) {
    if (content.includes('import {') && content.includes('@/lib/utils')) {
      content = content.replace(/import\s+{([^}]+)}\s+from\s+"@\/lib\/utils"/g, 'import { $1, getTodayWIB } from "@/lib/utils"');
    } else {
      content = 'import { getTodayWIB } from "@/lib/utils";\n' + content;
    }
  }
  content = content.replace(/new Date\(\)\.toISOString\(\)\.slice\(0,\s*10\)/g, 'getTodayWIB()');
  fs.writeFileSync(file, content);
});

const files2 = execSync('grep -rl "new Date().toISOString().split(\\"T\\")[0]" app/ lib/ components/ || true').toString().trim().split('\n').filter(Boolean);
files2.forEach(file => {
  let content = fs.readFileSync(file, 'utf8');
  if (!content.includes('getTodayWIB')) {
    if (content.includes('import {') && content.includes('@/lib/utils')) {
      content = content.replace(/import\s+{([^}]+)}\s+from\s+"@\/lib\/utils"/g, 'import { $1, getTodayWIB } from "@/lib/utils"');
    } else {
      content = 'import { getTodayWIB } from "@/lib/utils";\n' + content;
    }
  }
  content = content.replace(/new Date\(\)\.toISOString\(\)\.split\("T"\)\[0\]/g, 'getTodayWIB()');
  fs.writeFileSync(file, content);
});

console.log("Done");
