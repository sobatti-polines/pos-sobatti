const fs = require('fs');
let code = fs.readFileSync('app/pos/pos-client.tsx', 'utf8');

// Add imports
code = code.replace(
  'import { Input } from "@/components/ui/input";',
  `import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";`
);

// Add state
const stateMarker = `const [taxRate, setTaxRate] = useState(0);`;
code = code.replace(stateMarker, `const [taxRate, setTaxRate] = useState(0);
  const [printUrl, setPrintUrl] = useState<string | null>(null);
  const [printIframeOpen, setPrintIframeOpen] = useState(false);`);

// Replace handleCheckout
const handleCheckoutRegex = /const handleCheckout = async \(\) => \{[\s\S]*?router\.push\(url\);\n    \}\n  \};/;
const newHandleCheckout = `const handleCheckout = async () => {
    const result = await checkout();
    if (result.success && result.id) {
      setNumpadValue("");
      let url = \`/pos/invoice/\${result.id}\`;
      const isAutoPrint = metodeCetak === "Direct" ? "&print=auto" : "";
      
      if (jenisNota === "Struk") {
        url = \`/pos/invoice/\${result.id}/receipt?mode=struk\${isAutoPrint}\`;
      } else if (jenisNota === "Faktur") {
        url = \`/pos/invoice/\${result.id}?type=faktur\${isAutoPrint}\`;
      } else {
        url = \`/pos/invoice/\${result.id}?type=invoice\${isAutoPrint}\`;
      }
      
      setPrintUrl(url);
      setPrintIframeOpen(true);
      
      // Reset POS
      usePosStore.setState({ cart: [], activeCartItemId: null, customer: null, numpadValue: "" });
    }
  };`;
code = code.replace(handleCheckoutRegex, newHandleCheckout);

// Add Dialog to the end of the return statement
const returnMarker = `{/* ── Add Item Dialog (4A: choose unit on search click) ──────────────── */}`;
const dialogCode = `{/* ── Print Iframe Dialog ──────────────────────────────────────────────── */}
      <Dialog open={printIframeOpen} onOpenChange={setPrintIframeOpen}>
        <DialogContent className="max-w-2xl h-[80vh] flex flex-col p-0 overflow-hidden">
          <DialogHeader className="px-4 py-3 border-b shrink-0">
            <DialogTitle>Cetak {jenisNota}</DialogTitle>
          </DialogHeader>
          <div className="flex-1 bg-muted/30">
            {printUrl && (
              <iframe 
                src={printUrl} 
                className="w-full h-full border-0 bg-white" 
                title="Print Preview"
              />
            )}
          </div>
        </DialogContent>
      </Dialog>
      
      `;
code = code.replace(returnMarker, dialogCode + returnMarker);

fs.writeFileSync('app/pos/pos-client.tsx', code);
