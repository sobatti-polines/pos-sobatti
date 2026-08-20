const fs = require('fs');
let code = fs.readFileSync('app/pos/pos-client.tsx', 'utf8');

// Add Printer to lucide-react imports
code = code.replace(
  '  Calculator,\n} from "lucide-react";',
  '  Calculator,\n  Printer,\n} from "lucide-react";'
);

// Replace the previous Dialog with the improved one
const dialogRegex = /\{\/\* ── Print Iframe Dialog ──────────────────────────────────────────────── \*\/\}\n      <Dialog open=\{printIframeOpen\} onOpenChange=\{setPrintIframeOpen\}>[\s\S]*?<\/Dialog>\n      \n      /;
const newDialog = `{/* ── Print Iframe Dialog ──────────────────────────────────────────────── */}
      <Dialog open={printIframeOpen} onOpenChange={setPrintIframeOpen}>
        <DialogContent className="max-w-4xl h-[90vh] flex flex-col p-0 overflow-hidden bg-background">
          <DialogHeader className="px-6 py-4 border-b shrink-0 flex flex-row items-center justify-between">
            <DialogTitle className="text-xl">Pratinjau {jenisNota}</DialogTitle>
            <div className="flex items-center gap-3">
              <Button 
                variant="default" 
                className="rounded-full"
                onClick={() => {
                  const iframe = document.getElementById("print-iframe") as HTMLIFrameElement;
                  iframe?.contentWindow?.print();
                }}
              >
                <Printer className="w-4 h-4 mr-2" />
                Cetak Sekarang
              </Button>
            </div>
          </DialogHeader>
          <div className="flex-1 bg-muted/30 relative">
            {printUrl && (
              <iframe 
                id="print-iframe"
                src={printUrl} 
                className="w-full h-full border-0 bg-transparent" 
                title="Print Preview"
              />
            )}
          </div>
        </DialogContent>
      </Dialog>
      
      `;
code = code.replace(dialogRegex, newDialog);

fs.writeFileSync('app/pos/pos-client.tsx', code);
