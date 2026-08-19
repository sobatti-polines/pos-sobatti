const fs = require('fs');
let content = fs.readFileSync('components/data-table.tsx', 'utf8');

content = content.replace(
  '  isPending?: boolean\n  error?: string\n}',
  '  isPending?: boolean\n  error?: string\n  secondaryAction?: { label: string; onClick: () => void }\n}'
);

content = content.replace(
  '{deleteModal.isPending && (\n                  <Loader2 className="w-4 h-4 animate-spin mr-2" />\n                )}\n                {deleteModal.confirmLabel || "Hapus"}\n              </Button>\n            </div>',
  `{deleteModal.isPending && (
                  <Loader2 className="w-4 h-4 animate-spin mr-2" />
                )}
                {deleteModal.confirmLabel || "Hapus"}
              </Button>
            </div>
            {deleteModal.secondaryAction && (
              <div className="px-6 pb-5 bg-transparent flex justify-end">
                <Button
                  type="button"
                  variant="outline"
                  className="rounded-full px-6 border-destructive/50 text-destructive hover:bg-destructive hover:text-destructive-foreground"
                  onClick={deleteModal.secondaryAction.onClick}
                  disabled={deleteModal.isPending}
                >
                  {deleteModal.secondaryAction.label}
                </Button>
              </div>
            )}`
);

fs.writeFileSync('components/data-table.tsx', content);
console.log('data-table.tsx patched');
