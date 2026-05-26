import fs from 'fs';
import path from 'path';

const files = [
  'app/dashboard/suppliers/suppliers-client.tsx',
  'app/dashboard/customers/customers-client.tsx',
  'app/dashboard/inventory/inventory-client.tsx',
  'app/dashboard/transactions/transactions-client.tsx',
  'app/dashboard/inventory/stock-in/history/history-client.tsx',
  'app/dashboard/inventory/stock-opname/history/history-client.tsx'
];

for (const file of files) {
  const filePath = path.join(process.cwd(), file);
  if (fs.existsSync(filePath)) {
    let content = fs.readFileSync(filePath, 'utf8');
    content = content.replace(/className="([^"]*)h-8 w-8([^"]*)"/g, 'className="$1h-11 w-11 md:h-8 md:w-8$2"');
    fs.writeFileSync(filePath, content);
    console.log(`Updated ${file}`);
  }
}
