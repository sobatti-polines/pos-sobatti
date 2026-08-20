const fs = require('fs');
let code = fs.readFileSync('app/dashboard/tutup-kasir/tutup-kasir-client.tsx', 'utf8');

code = code.replace(
  /export default function TutupKasirClient\(\{\n\s*initialSummary,\n\}\: \{\n\s*initialSummary\: any;\n\}\) \{/g,
  `import { format } from "date-fns";
import { id } from "date-fns/locale";

export default function TutupKasirClient({
  initialSummary,
  store,
  username,
}: {
  initialSummary: any;
  store: any;
  username: string;
}) {`
);

// We need to wrap the existing return content in a <div className="print:hidden h-full flex flex-col">
// and add the print receipt template.
// But first, let's just do a simpler replace.
fs.writeFileSync('app/dashboard/tutup-kasir/tutup-kasir-client.tsx', code);
