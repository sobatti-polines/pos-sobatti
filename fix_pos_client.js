const fs = require('fs');

const path = 'app/pos/pos-client.tsx';
let content = fs.readFileSync(path, 'utf8');

// The replacement I did earlier for sidebarOpen didn't work because sidebarOpen doesn't exist.
// So the states were NEVER ADDED!
const stateString = `
  const [editingPriceItem, setEditingPriceItem] = useState<{id_produk: number, satuan_jual: string | null} | null>(null);
  const [editingPriceValue, setEditingPriceValue] = useState<string>("");
`;

content = content.replace(
  'const [cashier, setCashier] = useState<{ name: string; username: string } | null>(null);',
  'const [cashier, setCashier] = useState<{ name: string; username: string } | null>(null);\n' + stateString
);

fs.writeFileSync(path, content, 'utf8');
console.log("Fixed app/pos/pos-client.tsx");
