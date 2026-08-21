const fs = require('fs');
const path = require('path');
const filePath = path.join(__dirname, 'app/dashboard/transactions/transactions-client.tsx');
let content = fs.readFileSync(filePath, 'utf8');

// Add Eye, Printer icons
content = content.replace(
  'import { Search, Receipt, Trash2, AlertTriangle, Loader2, X } from "lucide-react";',
  'import { Search, Receipt, Trash2, AlertTriangle, Loader2, X, Eye, Printer } from "lucide-react";'
);

// Add state and handleOpenDetail right after setVoidModal
const detailStateCode = `
  const [detailModal, setDetailModal] = useState<{ open: boolean; transaction: Transaction | null; items: TransactionDetail[]; loading: boolean }>({
    open: false,
    transaction: null,
    items: [],
    loading: false
  });

  const handleOpenDetail = async (t: Transaction) => {
    setDetailModal({ open: true, transaction: t, items: [], loading: true });
    try {
      const res = await getTransactionDetails(t.id);
      if (res.data) {
        setDetailModal(prev => ({ ...prev, items: res.data as unknown as TransactionDetail[], loading: false }));
      } else {
        setDetailModal(prev => ({ ...prev, loading: false }));
      }
    } catch (e) {
      setDetailModal(prev => ({ ...prev, loading: false }));
    }
  };
`;
content = content.replace(
  '  const isOwnerOrAdmin = role === "OWNER" || role === "ADMIN";',
  detailStateCode + '\n  const isOwnerOrAdmin = role === "OWNER" || role === "ADMIN";'
);

// Update actions column
content = content.replace(
  '      render: (t) => (\n        <div className="flex justify-end">\n          {isOwnerOrAdmin && (\n            <Button variant="ghost" size="icon" className="h-11 w-11 md:h-8 md:w-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10" onClick={(e) => handleOpenVoid(e, t)}>\n              <Trash2 className="h-4 w-4" />\n            </Button>\n          )}\n        </div>\n      ),',
  '      render: (t) => (\n        <div className="flex items-center justify-end gap-1 md:gap-2">\n          <Button variant="ghost" size="icon" className="h-11 w-11 md:h-8 md:w-8 text-muted-foreground hover:text-foreground" onClick={(e) => { e.stopPropagation(); handleOpenDetail(t); }}>\n            <Eye className="h-4 w-4" />\n          </Button>\n          {isOwnerOrAdmin && (\n            <Button variant="ghost" size="icon" className="h-11 w-11 md:h-8 md:w-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10" onClick={(e) => handleOpenVoid(e, t)}>\n              <Trash2 className="h-4 w-4" />\n            </Button>\n          )}\n        </div>\n      ),'
);

// Update onRowClick
content = content.replace(
  'onRowClick={(t) => router.push(`/pos/invoice/${t.id}`)}',
  'onRowClick={(t) => handleOpenDetail(t)}'
);

// Add Slide-over JSX before voidModal
const slideOverJSX = `
      {/* Detail Slide-over */}
      {detailModal.open && (
        <div className="fixed inset-0 z-[60] flex justify-end bg-overlay/40 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-background border-l border-border shadow-2xl w-full max-w-md flex flex-col h-full animate-in slide-in-from-right duration-300">
            <div className="shrink-0 flex items-center justify-between px-6 py-5 border-b border-border">
              <h2 className="text-xl font-medium tracking-tight text-foreground flex items-center gap-2">
                <Receipt className="w-5 h-5 text-primary" />
                Detail Transaksi
              </h2>
              <button
                className="text-muted-foreground hover:text-foreground transition-colors p-1"
                onClick={() => setDetailModal({ open: false, transaction: null, items: [], loading: false })}
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              <div className="space-y-4">
                <div className="bg-muted/30 rounded-xl p-4 border border-border/50 space-y-3">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">No. Transaksi</span>
                    <span className="font-medium">#{detailModal.transaction?.no_transaksi}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Tanggal</span>
                    <span>{detailModal.transaction && formatDate(detailModal.transaction.tgl_transaksi)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Kasir</span>
                    <span>{detailModal.transaction?.pengguna?.nama || detailModal.transaction?.pengguna?.username || "-"}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Pelanggan</span>
                    <span>{detailModal.transaction?.pelanggan?.nama_pelanggan || "Umum"}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Pembayaran</span>
                    <Badge variant="outline" className="font-normal">{detailModal.transaction?.metode_bayar?.nama || "-"}</Badge>
                  </div>
                </div>

                <div>
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-3">Item Pembelian</p>
                  <div className="space-y-3">
                    {detailModal.loading ? (
                      <div className="flex items-center justify-center py-8">
                        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                      </div>
                    ) : detailModal.items.length === 0 ? (
                      <p className="text-sm text-muted-foreground text-center py-4">Tidak ada detail item</p>
                    ) : (
                      detailModal.items.map((item, idx) => (
                        <div key={idx} className="flex flex-col gap-1 p-3 bg-muted/20 rounded-lg border border-border/50">
                          <div className="flex justify-between font-medium text-sm">
                            <span className="truncate pr-4">{item.produk?.nama_produk || "-"}</span>
                            <span>{formatIDR(item.jumlah ?? 0)}</span>
                          </div>
                          <div className="flex justify-between text-xs text-muted-foreground">
                            <span>{item.qty_satuan ?? item.qty} {item.satuan_jual ?? ""} x {formatIDR(item.harga_jual ?? 0)}</span>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>

                {!detailModal.loading && detailModal.items.length > 0 && (
                  <div className="border-t border-dashed border-border pt-4 space-y-2">
                    <div className="flex justify-between text-base font-semibold pt-2">
                      <span>Total Bayar</span>
                      <span className="text-primary">{detailModal.transaction && formatIDR(detailModal.transaction?.total ?? 0)}</span>
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="shrink-0 px-6 py-5 border-t border-border bg-muted/10 flex gap-3">
              <Button 
                variant="default" 
                className="w-full rounded-full shadow-sm" 
                onClick={() => router.push(\`/pos/invoice/\${detailModal.transaction?.id}\`)}
              >
                <Printer className="w-4 h-4 mr-2" />
                Cetak Struk / Invoice
              </Button>
            </div>
          </div>
        </div>
      )}
`;

content = content.replace(
  '{/* Void Modal */}',
  slideOverJSX + '\n      {/* Void Modal */}'
);

fs.writeFileSync(filePath, content);
console.log("Done");
