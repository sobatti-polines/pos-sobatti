const fs = require('fs');

const path = 'app/pos/pos-client.tsx';
let content = fs.readFileSync(path, 'utf8');

// 1. Add setCustomPrice to store import
content = content.replace(
  'setSellUnit,',
  'setSellUnit,\n    setCustomPrice,'
);

// 2. Add state for custom price dialog
const stateString = `
  const [editingPriceItem, setEditingPriceItem] = useState<{id_produk: number, satuan_jual: string | null} | null>(null);
  const [editingPriceValue, setEditingPriceValue] = useState<string>("");
`;
content = content.replace(
  'const [sidebarOpen, setSidebarOpen] = useState(false);',
  'const [sidebarOpen, setSidebarOpen] = useState(false);\n' + stateString
);

// 3. Add DialogFooter to dialog imports
content = content.replace(
  'DialogTitle,\n} from "@/components/ui/dialog";',
  'DialogTitle,\n  DialogFooter,\n} from "@/components/ui/dialog";'
);

// 4. Add the Dialog UI below other dialogs (e.g., above <div className="min-h-screen bg-muted/30 flex flex-col md:flex-row">)
const dialogString = `
      {/* Dialog Custom Price */}
      <Dialog open={!!editingPriceItem} onOpenChange={(open) => !open && setEditingPriceItem(null)}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Set Harga Baru</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="flex flex-col gap-2">
              <label htmlFor="custom-price" className="text-sm font-medium">Harga Satuan</label>
              <Input
                id="custom-price"
                type="number"
                value={editingPriceValue}
                onChange={(e) => setEditingPriceValue(e.target.value)}
                placeholder="Masukkan harga"
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    if (editingPriceItem) {
                      setCustomPrice(editingPriceItem.id_produk, editingPriceItem.satuan_jual, Number(editingPriceValue) || 0);
                      setEditingPriceItem(null);
                    }
                  }
                }}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingPriceItem(null)}>Batal</Button>
            <Button onClick={() => {
              if (editingPriceItem) {
                setCustomPrice(editingPriceItem.id_produk, editingPriceItem.satuan_jual, Number(editingPriceValue) || 0);
                setEditingPriceItem(null);
              }
            }}>Simpan Harga</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
`;
content = content.replace(
  '<div className="min-h-screen bg-muted/30 flex flex-col md:flex-row">',
  dialogString + '\n      <div className="min-h-screen bg-muted/30 flex flex-col md:flex-row">'
);

// 5. Update price rendering in cart list to make it editable if 0
// Desktop:
// <TableCell className="text-right hidden md:table-cell">
//   {formatIDR(item.harga_jual)}
// </TableCell>
// Mobile:
// <span className="font-medium text-base tabular-nums">{formatIDR((item.harga_jual - item.diskon_item) * item.qty_satuan)}</span>
// Wait, we just need to add a click handler and an icon.

const desktopPriceMatch = '<TableCell className="text-right hidden md:table-cell">\n                          {formatIDR(item.harga_jual)}\n                        </TableCell>';
const desktopPriceReplace = `<TableCell className="text-right hidden md:table-cell">
                          {(item.harga_jual === 0 || item.harga_jual_custom !== undefined) ? (
                            <Button 
                              variant="outline" 
                              size="sm" 
                              className="h-8 gap-1.5 px-2"
                              onClick={(e) => {
                                e.stopPropagation();
                                setEditingPriceValue(String(item.harga_jual || ""));
                                setEditingPriceItem({ id_produk: item.id_produk, satuan_jual: item.satuan_jual });
                              }}
                            >
                              {formatIDR(item.harga_jual)} <Pencil className="w-3 h-3 text-muted-foreground" />
                            </Button>
                          ) : (
                            formatIDR(item.harga_jual)
                          )}
                        </TableCell>`;

content = content.replace(desktopPriceMatch, desktopPriceReplace);

const mobilePriceMatch = '<span className="font-medium text-base tabular-nums">{formatIDR((item.harga_jual - item.diskon_item) * item.qty_satuan)}</span>';
const mobilePriceReplace = `{(item.harga_jual === 0 || item.harga_jual_custom !== undefined) ? (
                                <Button 
                                  variant="outline" 
                                  size="sm" 
                                  className="h-7 gap-1.5 px-2 text-base font-medium"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setEditingPriceValue(String(item.harga_jual || ""));
                                    setEditingPriceItem({ id_produk: item.id_produk, satuan_jual: item.satuan_jual });
                                  }}
                                >
                                  {formatIDR((item.harga_jual - item.diskon_item) * item.qty_satuan)} <Pencil className="w-3 h-3 text-muted-foreground" />
                                </Button>
                              ) : (
                                <span className="font-medium text-base tabular-nums">{formatIDR((item.harga_jual - item.diskon_item) * item.qty_satuan)}</span>
                              )}`;
content = content.replace(mobilePriceMatch, mobilePriceReplace);

// Don't forget to import Pencil icon if not imported
if (!content.includes('Pencil')) {
    content = content.replace('Trash2,', 'Trash2,\n  Pencil,');
}

fs.writeFileSync(path, content, 'utf8');
console.log("Updated app/pos/pos-client.tsx");
