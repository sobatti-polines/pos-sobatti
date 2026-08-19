const fs = require('fs');
let content = fs.readFileSync('app/dashboard/inventory/inventory-client.tsx', 'utf8');

const forceDeleteFunction = `
  const handleForceDelete = async () => {
    if (!deleteTarget?.id) return;
    const id = deleteTarget.id;
    setErrorMsg("");
    startTransition(async () => {
      const res = await forceDeleteProduct(id);
      if (res?.error) { 
        setErrorMsg(res.error); 
      } else {
        setDeleteTarget(null);
        setSelectedIds((prev) => {
          const next = new Set(prev);
          next.delete(id);
          return next;
        });
        router.refresh();
      }
    });
  };
`;

content = content.replace(
  'const handleDeleteConfirm = async () => {',
  forceDeleteFunction + '\n  const handleDeleteConfirm = async () => {'
);

const deleteModalTarget = `    : deleteTarget ? {
        open: true, title: "Hapus Produk?", itemName: deleteTarget.nama_produk,
        onConfirm: handleDeleteConfirm,
        onCancel: () => { setDeleteTarget(null); setErrorMsg(""); },
        isPending, error: errorMsg,
      }`;

const newDeleteModalTarget = `    : deleteTarget ? {
        open: true, title: "Hapus Produk?", itemName: deleteTarget.nama_produk,
        onConfirm: handleDeleteConfirm,
        onCancel: () => { setDeleteTarget(null); setErrorMsg(""); },
        isPending, error: errorMsg,
        secondaryAction: errorMsg && errorMsg.includes("riwayat") ? {
          label: "Hapus Paksa & Riwayat",
          onClick: handleForceDelete
        } : undefined
      }`;

content = content.replace(deleteModalTarget, newDeleteModalTarget);

fs.writeFileSync('app/dashboard/inventory/inventory-client.tsx', content);
console.log('inventory-client.tsx patched');
