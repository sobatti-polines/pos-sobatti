const fs = require('fs');

const path = 'app/pos/pos-client.tsx';
let content = fs.readFileSync(path, 'utf8');

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
  '<div className="flex-1 flex flex-col h-full bg-background">',
  '<div className="flex-1 flex flex-col h-full bg-background">\n' + dialogString
);

fs.writeFileSync(path, content, 'utf8');
console.log("Fixed dialog injection");
