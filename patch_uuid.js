const fs = require('fs');
let code = fs.readFileSync('app/pos/pos-client.tsx', 'utf8');

const regex = /const \[sessionId\] = useState\(\(\) => crypto\.randomUUID\(\)\);/;
const replacement = `const [sessionId] = useState(() => {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) {
      return crypto.randomUUID();
    }
    return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
  });`;

code = code.replace(regex, replacement);
fs.writeFileSync('app/pos/pos-client.tsx', code);
