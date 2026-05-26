import fs from 'fs';
import path from 'path';

function fixFile(file) {
  const filePath = path.join(process.cwd(), file);
  if (!fs.existsSync(filePath)) return;
  let content = fs.readFileSync(filePath, 'utf8');

  // Cancel buttons
  content = content.replace(
    /<Button variant="ghost" size="icon" className="h-11 w-11 md:h-8 md:w-8 text-muted-foreground hover:text-foreground" onClick=\{handleCancelInline\} disabled=\{isPending\}>/g,
    '<Button variant="ghost" size="icon" aria-label="Batal Edit" className="h-11 w-11 md:h-8 md:w-8 text-muted-foreground hover:text-foreground" onClick={handleCancelInline} disabled={isPending}>'
  );

  // Save buttons
  content = content.replace(
    /<Button variant="ghost" size="icon" className="h-11 w-11 md:h-8 md:w-8 text-primary hover:text-primary hover:bg-primary\/10" onClick=\{handleSaveInline\} disabled=\{isPending\}>/g,
    '<Button variant="ghost" size="icon" aria-label="Simpan Edit" className="h-11 w-11 md:h-8 md:w-8 text-primary hover:text-primary hover:bg-primary/10" onClick={handleSaveInline} disabled={isPending}>'
  );

  // Edit buttons
  content = content.replace(
    /<Button\s+variant="ghost"\s+size="icon"\s+className="h-11 w-11 md:h-8 md:w-8 text-muted-foreground hover:text-foreground"\s+onClick=\{\(e\) => handleEditClick\(e, ([^)]+)\)\}\s+disabled=\{editingId !== null\}\s*>/g,
    '<Button variant="ghost" size="icon" aria-label="Edit $1" className="h-11 w-11 md:h-8 md:w-8 text-muted-foreground hover:text-foreground" onClick={(e) => handleEditClick(e, $1)} disabled={editingId !== null}>'
  );

  // Trash buttons
  content = content.replace(
    /<Button\s+variant="ghost"\s+size="icon"\s+className="h-11 w-11 md:h-8 md:w-8 text-muted-foreground hover:text-destructive hover:bg-destructive\/10"\s+onClick=\{\(e\) => \{\s*e\.stopPropagation\(\);\s*setDeleteModal\(\{ open: true, data: ([^ ]+) \}\);\s*\}\}\s+disabled=\{editingId !== null\}\s*>/g,
    '<Button variant="ghost" size="icon" aria-label="Hapus $1" className="h-11 w-11 md:h-8 md:w-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10" onClick={(e) => { e.stopPropagation(); setDeleteModal({ open: true, data: $1 }); }} disabled={editingId !== null}>'
  );

  // Prev Page
  content = content.replace(
    /<Button\s+variant="outline"\s+size="sm"\s+onClick=\{\(\) => setCurrentPage\(p => Math\.max\(1, p - 1\)\)\}/g,
    '<Button aria-label="Halaman Sebelumnya" variant="outline" size="sm" onClick={() => setCurrentPage(p => Math.max(1, p - 1))}'
  );

  // Next Page
  content = content.replace(
    /<Button\s+variant="outline"\s+size="sm"\s+onClick=\{\(\) => setCurrentPage\(p => Math\.min\(totalPages, p \+ 1\)\)\}/g,
    '<Button aria-label="Halaman Selanjutnya" variant="outline" size="sm" onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}'
  );

  // Close Modals
  content = content.replace(
    /<button\s+className="text-muted-foreground hover:text-foreground transition-colors p-1"\s+onClick=\{\(\) => setModalState\(\{ open: false, type: "add", data: null \}\)\}\s*>/g,
    '<button aria-label="Tutup" className="text-muted-foreground hover:text-foreground transition-colors p-1" onClick={() => setModalState({ open: false, type: "add", data: null })}>'
  );
  content = content.replace(
    /<button\s+className="text-muted-foreground hover:text-foreground transition-colors p-1"\s+onClick=\{\(\) => setDeleteModal\(\{ open: false, data: null \}\)\}\s*>/g,
    '<button aria-label="Tutup" className="text-muted-foreground hover:text-foreground transition-colors p-1" onClick={() => setDeleteModal({ open: false, data: null })}>'
  );

  // Inputs without aria-labels
  content = content.replace(/<Input \n?\s*autoFocus\n?\s*placeholder="([^"]+)"/g, '<Input autoFocus aria-label="$1" placeholder="$1"');
  content = content.replace(/<Input \n?\s*placeholder="([^"]+)"/g, '<Input aria-label="$1" placeholder="$1"');
  content = content.replace(/<Input \n?\s*type="number"\n?\s*placeholder="([^"]+)"/g, '<Input type="number" aria-label="$1" placeholder="$1"');

  // Search input
  content = content.replace(
    /<Input\s+placeholder="Cari([^"]+)"/g,
    '<Input aria-label="Pencarian" placeholder="Cari$1"'
  );
  
  // Select items per page
  content = content.replace(
    /<select\s+value=\{itemsPerPage\}/g,
    '<select aria-label="Baris per halaman" value={itemsPerPage}'
  );

  fs.writeFileSync(filePath, content);
  console.log(`Fixed A11y in ${file}`);
}

const files = [
  'app/dashboard/suppliers/suppliers-client.tsx',
  'app/dashboard/customers/customers-client.tsx',
  'app/dashboard/inventory/inventory-client.tsx',
  'app/dashboard/transactions/transactions-client.tsx'
];

files.forEach(fixFile);
