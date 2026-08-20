const fs = require('fs');
let code = fs.readFileSync('app/dashboard/tutup-kasir/tutup-kasir-client.tsx', 'utf8');

code = code.replace(
  /className="flex-1 flex flex-col min-h-0 bg-background/g,
  'className="print:hidden flex-1 flex flex-col min-h-0 bg-background'
);

const printLayout = `
      {/* PRINT RECEIPT (Struk Laporan Harian) */}
      <div className="hidden print:block invoice-print-area text-black bg-white" style={{ fontFamily: 'monospace', width: '58mm', margin: '0 auto', fontSize: '11px', lineHeight: '1.4' }}>
        <div style={{ textAlign: 'center', marginBottom: '8px' }}>
          <h2 style={{ fontSize: '14px', fontWeight: 'bold', margin: '0 0 4px 0', letterSpacing: '0.5px' }}>{store?.nama_toko || "TOKO POS"}</h2>
          <p style={{ margin: '0', fontSize: '10px' }}>{store?.alamat || "Alamat Toko"}</p>
          <p style={{ margin: '0', fontSize: '10px' }}>Telp: {store?.telepon || "-"}</p>
        </div>

        <div style={{ borderTop: '1px dashed #000', borderBottom: '1px dashed #000', padding: '6px 0', marginBottom: '8px', fontSize: '10px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span>TANGGAL</span>
            <span>{date ? format(new Date(date), "dd-MM-yyyy") : "-"}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span>KASIR</span>
            <span>{username.toUpperCase()}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span>CETAK</span>
            <span>{format(new Date(), "dd-MM-yyyy HH:mm")}</span>
          </div>
        </div>

        <div style={{ textAlign: 'center', fontWeight: 'bold', marginBottom: '8px', fontSize: '12px' }}>
          LAPORAN KAS HARIAN
        </div>

        <div style={{ marginBottom: '8px', paddingBottom: '8px', borderBottom: '1px dashed #000' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '2px' }}>
            <span>MODAL AWAL</span>
            <span>{formatIDR(Number(summary?.uang_awal ?? saldoAwal))}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '2px' }}>
            <span>PENJUALAN (+)</span>
            <span>{formatIDR(totalMasuk)}</span>
          </div>
          
          <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 'bold', marginTop: '4px', paddingTop: '4px', borderTop: '1px solid #000' }}>
            <span>TOTAL SISTEM</span>
            <span>{formatIDR(expectedSaldoAkhir)}</span>
          </div>
        </div>

        <div style={{ marginBottom: '12px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '2px', fontWeight: 'bold' }}>
            <span>FISIK LACI</span>
            <span>{formatIDR(Number(summary?.uang_aktual ?? 0))}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span>SELISIH</span>
            <span>{formatIDR(Number(summary?.selisih ?? 0))}</span>
          </div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '20px', textAlign: 'center', fontSize: '10px' }}>
          <div style={{ width: '45%' }}>
            <p style={{ margin: '0 0 30px 0' }}>Diserahkan Oleh,</p>
            <p style={{ margin: '0', textDecoration: 'underline' }}>{username}</p>
          </div>
          <div style={{ width: '45%' }}>
            <p style={{ margin: '0 0 30px 0' }}>Diterima Oleh,</p>
            <p style={{ margin: '0', textDecoration: 'underline' }}>Admin/Owner</p>
          </div>
        </div>
      </div>
    </>`;

code = code.replace(/<\/>\n\s*\);\n\}/, printLayout + '\n  );\n}');

fs.writeFileSync('app/dashboard/tutup-kasir/tutup-kasir-client.tsx', code);
