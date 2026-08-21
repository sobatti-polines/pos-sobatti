const fs = require('fs');
const path = require('path');
const filePath = path.join(__dirname, 'app/dashboard/transactions/transactions-client.tsx');
let content = fs.readFileSync(filePath, 'utf8');

if (!content.includes('import { createClient } from "@/lib/supabase/client"')) {
  content = content.replace(
    'import { ExportDropdown } from "@/components/export-dropdown";',
    'import { ExportDropdown } from "@/components/export-dropdown";\nimport { createClient } from "@/lib/supabase/client";'
  );
}

const exportFunctions = `
  const supabase = createClient();
  const [isExporting, setIsExporting] = useState(false);

  const fetchExportData = async () => {
    setIsExporting(true);
    try {
      const txIds = filteredData.map(t => t.id);
      const detailsMap = new Map<number, any[]>();
      
      for (let i = 0; i < txIds.length; i += 200) {
        const chunk = txIds.slice(i, i + 200);
        const { data, error } = await supabase
          .from("detail_transaksi_keluar")
          .select("id_transaksi, qty, qty_satuan, satuan_jual, harga_jual, jumlah, produk(nama_produk)")
          .in("id_transaksi", chunk);
          
        if (data && !error) {
          data.forEach(d => {
            const arr = detailsMap.get(d.id_transaksi) || [];
            arr.push(d);
            detailsMap.set(d.id_transaksi, arr);
          });
        }
      }
      return detailsMap;
    } finally {
      setIsExporting(false);
    }
  };

  const handleExportCSV = async () => {
    const detailsMap = await fetchExportData();
    const headers = ["No. Transaksi", "Tanggal", "Kasir", "Pelanggan", "Status Pembayaran", "Nama Barang", "Harga", "Qty", "Subtotal Item", "Total Transaksi"];
    
    const data: any[][] = [];
    filteredData.forEach(t => {
      const items = detailsMap.get(t.id) || [];
      const baseInfo = [
        \`#\${t.no_transaksi}\`,
        formatDate(t.tgl_transaksi),
        t.pengguna?.nama || t.pengguna?.username || "-",
        t.pelanggan?.nama_pelanggan || "Umum",
        t.bayar >= t.total ? "Selesai" : (t.bayar > 0 ? "Sebagian" : "Tertunda")
      ];
      
      if (items.length === 0) {
         data.push([...baseInfo, "-", "-", "-", "-", formatIDR(t.total)]);
      } else {
         items.forEach((item, idx) => {
           data.push([
             ...baseInfo,
             item.produk?.nama_produk || "-",
             formatIDR(item.harga_jual),
             \`\${item.qty_satuan ?? item.qty} \${item.satuan_jual ?? ""}\`.trim(),
             formatIDR(item.jumlah),
             idx === 0 ? formatIDR(t.total) : ""
           ]);
         });
      }
    });
    
    exportToCSV("Data_Transaksi", headers, data);
  };

  const handleExportPDF = async () => {
    const detailsMap = await fetchExportData();
    const headers = ["Transaksi", "Nama Barang", "Harga", "Qty", "Subtotal", "Total"];
    
    const data: any[][] = [];
    filteredData.forEach(t => {
      const items = detailsMap.get(t.id) || [];
      const txName = \`#\${t.no_transaksi} - \${t.pelanggan?.nama_pelanggan || "Umum"} (\${formatDate(t.tgl_transaksi)})\`;
      
      if (items.length === 0) {
         data.push([txName, "-", "-", "-", "-", formatIDR(t.total)]);
      } else {
         items.forEach((item, idx) => {
           data.push([
             idx === 0 ? txName : "",
             item.produk?.nama_produk || "-",
             formatIDR(item.harga_jual),
             \`\${item.qty_satuan ?? item.qty} \${item.satuan_jual ?? ""}\`.trim(),
             formatIDR(item.jumlah),
             idx === items.length - 1 ? formatIDR(t.total) : ""
           ]);
         });
      }
    });
    
    exportToPDF("Data_Transaksi", "Laporan Riwayat Transaksi", headers, data);
  };
`;

// Replace handleExportCSV and handleExportPDF
content = content.replace(
  /const handleExportCSV = \(\) => \{[\s\S]*?exportToPDF\("Data_Transaksi", "Laporan Data Transaksi", headers, data\);\n  \};/,
  exportFunctions.trim()
);

// Update customRender
content = content.replace(
  '                onExportPDF={handleExportPDF}\n                className="flex-1 md:flex-none"\n              />',
  '                onExportPDF={handleExportPDF}\n                className="flex-1 md:flex-none"\n                isLoading={isExporting}\n              />'
);

fs.writeFileSync(filePath, content);
console.log("Done");
