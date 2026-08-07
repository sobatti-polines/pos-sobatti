import { createClient } from "@/lib/supabase/server";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Store, Phone, Mail, MapPin, HelpCircle, BookOpen, LifeBuoy } from "lucide-react";

export const metadata = {
  title: "Bantuan — PLK POS",
};

export default async function SupportPage() {
  const supabase = await createClient();

  const { data: pengaturan } = await supabase
    .from("pengaturan")
    .select("nama_toko, alamat, telepon, email")
    .eq("id", 1)
    .single();

  const storeName = pengaturan?.nama_toko || "PLK POS";
  const storeAddress = pengaturan?.alamat || "-";
  const storePhone = pengaturan?.telepon || "-";
  const storeEmail = pengaturan?.email || "-";

  const faqs = [
    {
      q: "Bagaimana cara melakukan transaksi penjualan?",
      a: "Buka menu Penjualan (POS), cari produk melalui kolom pencarian atau scan barcode, pilih tipe harga (Satuan/Grosir/Promo), atur jumlah, lalu tekan tombol Bayar.",
    },
    {
      q: "Bagaimana cara menambah stok barang?",
      a: "Masuk ke Inventaris → Barang Masuk, pilih produk dan supplier, isi jumlah (dalam satuan suplai, misal lusin), lalu simpan. Stok otomatis masuk ke gudang dan harga pokok (AVCO) dihitung ulang.",
    },
    {
      q: "Apa perbedaan stok display dan stok gudang?",
      a: "Stok display adalah stok yang tersedia di rak toko, stok gudang adalah stok di gudang penyimpanan. Barang masuk menambah stok gudang, penjualan mengurangi stok display (jika kurang, otomatis diambil dari gudang).",
    },
    {
      q: "Bagaimana cara melakukan tutup kasir harian?",
      a: "Buka Kasir & Keuangan → Tutup Kasir, pastikan tanggal sesuai, isi jumlah uang aktual di laci kas, lalu konfirmasi. Sistem akan menghitung selisih otomatis.",
    },
    {
      q: "Bagaimana cara absensi dengan QR?",
      a: "Owner membuka Manajemen Absensi → Generate QR, lalu karyawan memindai QR tersebut melalui halaman Scan QR Absensi (harus berada di area toko, izinkan akses lokasi).",
    },
    {
      q: "Bagaimana jika barcode produk tidak terbaca?",
      a: "Pastikan kode barcode sudah terisi pada data produk. Jika scanner tidak bekerja, barcode dapat diketik manual di kolom pencarian lalu tekan Enter.",
    },
  ];

  return (
    <div className="flex-1 p-4 md:p-8 lg:p-12 w-full flex flex-col gap-4 md:gap-8 mx-auto">
      <header>
        <h1 className="text-4xl font-light tracking-tighter text-foreground">Bantuan</h1>
        <p className="text-muted-foreground mt-2">
          Panduan penggunaan {storeName} dan kontak bantuan
        </p>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BookOpen className="w-5 h-5 text-primary" />
              Pertanyaan Umum (FAQ)
            </CardTitle>
            <CardDescription>Jawaban singkat untuk penggunaan sehari-hari</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            {faqs.map((f) => (
              <div key={f.q} className="rounded-xl border border-border p-4">
                <p className="font-medium text-foreground text-sm">{f.q}</p>
                <p className="text-sm text-muted-foreground mt-1.5 leading-relaxed">{f.a}</p>
              </div>
            ))}
          </CardContent>
        </Card>

        <div className="flex flex-col gap-4 md:gap-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <LifeBuoy className="w-5 h-5 text-primary" />
                Hubungi Kami
              </CardTitle>
              <CardDescription>Jika memerlukan bantuan lebih lanjut</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              <div className="flex items-start gap-3">
                <Store className="w-5 h-5 text-muted-foreground shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-foreground">{storeName}</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <MapPin className="w-5 h-5 text-muted-foreground shrink-0 mt-0.5" />
                <p className="text-sm text-muted-foreground">{storeAddress}</p>
              </div>
              <div className="flex items-start gap-3">
                <Phone className="w-5 h-5 text-muted-foreground shrink-0 mt-0.5" />
                <p className="text-sm text-muted-foreground tabular-nums">{storePhone}</p>
              </div>
              <div className="flex items-start gap-3">
                <Mail className="w-5 h-5 text-muted-foreground shrink-0 mt-0.5" />
                <p className="text-sm text-muted-foreground">{storeEmail}</p>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-muted/30 border-none">
            <CardContent className="py-6 px-6 flex items-start gap-4">
              <HelpCircle className="w-6 h-6 text-primary shrink-0 mt-0.5" />
              <div>
                <p className="font-medium text-foreground">Saran & Masukan</p>
                <p className="text-sm text-muted-foreground leading-relaxed mt-1">
                  Jika menemukan kendala atau memiliki masukan untuk pengembangan sistem,
                  silakan hubungi pengelola sistem melalui kontak di atas.
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
