const fs = require('fs');
let content = fs.readFileSync('components/data-table.tsx', 'utf8');

content = content.replace(
  'hover:text-destructive-foreground',
  'hover:text-white'
);

fs.writeFileSync('components/data-table.tsx', content);
console.log('data-table.tsx hover patched');
