-- Modul PO Custom general untuk pencatatan pesanan custom pelanggan.
-- File ini sengaja hanya migration SQL. Apply manual ke PostgreSQL local/remote sesuai kebutuhan.

CREATE TABLE IF NOT EXISTS public.po_custom (
  id BIGSERIAL PRIMARY KEY,
  no_po TEXT NOT NULL UNIQUE,
  id_pelanggan INTEGER NOT NULL REFERENCES public.pelanggan(id),
  id_produk INTEGER REFERENCES public.produk(id),
  tanggal_po DATE NOT NULL DEFAULT CURRENT_DATE,
  nama_pesanan TEXT NOT NULL,
  spesifikasi TEXT,
  atribut_custom JSONB NOT NULL DEFAULT '{}'::jsonb,
  qty NUMERIC(15,3) NOT NULL DEFAULT 1,
  harga_total NUMERIC(15,2) NOT NULL DEFAULT 0,
  target_selesai DATE,
  status TEXT NOT NULL DEFAULT 'MENUNGGU_DP',
  catatan_internal TEXT,
  created_by INTEGER REFERENCES public.pengguna(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT po_custom_status_check CHECK (
    status IN ('DRAFT', 'MENUNGGU_DP', 'DIPROSES', 'SIAP_KIRIM', 'SELESAI', 'BATAL')
  ),
  CONSTRAINT po_custom_qty_check CHECK (qty > 0),
  CONSTRAINT po_custom_harga_total_check CHECK (harga_total >= 0),
  CONSTRAINT po_custom_atribut_object_check CHECK (jsonb_typeof(atribut_custom) = 'object')
);

CREATE TABLE IF NOT EXISTS public.po_custom_pembayaran (
  id BIGSERIAL PRIMARY KEY,
  id_po BIGINT NOT NULL REFERENCES public.po_custom(id) ON DELETE CASCADE,
  tanggal_bayar DATE NOT NULL DEFAULT CURRENT_DATE,
  jumlah_bayar NUMERIC(15,2) NOT NULL,
  id_metode_bayar INTEGER REFERENCES public.metode_bayar(id),
  jenis_pembayaran TEXT NOT NULL DEFAULT 'TAMBAHAN',
  keterangan TEXT,
  created_by INTEGER REFERENCES public.pengguna(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT po_custom_pembayaran_jumlah_check CHECK (jumlah_bayar > 0),
  CONSTRAINT po_custom_pembayaran_jenis_check CHECK (
    jenis_pembayaran IN ('DP', 'PELUNASAN', 'TAMBAHAN')
  )
);

CREATE INDEX IF NOT EXISTS idx_po_custom_pelanggan ON public.po_custom(id_pelanggan);
CREATE INDEX IF NOT EXISTS idx_po_custom_produk ON public.po_custom(id_produk);
CREATE INDEX IF NOT EXISTS idx_po_custom_status ON public.po_custom(status);
CREATE INDEX IF NOT EXISTS idx_po_custom_target_selesai ON public.po_custom(target_selesai);
CREATE INDEX IF NOT EXISTS idx_po_custom_pembayaran_po ON public.po_custom_pembayaran(id_po);

CREATE OR REPLACE FUNCTION public.set_po_custom_updated_at()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_set_po_custom_updated_at ON public.po_custom;
CREATE TRIGGER trg_set_po_custom_updated_at
BEFORE UPDATE ON public.po_custom
FOR EACH ROW
EXECUTE FUNCTION public.set_po_custom_updated_at();

ALTER TABLE public.po_custom ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.po_custom_pembayaran ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "auth_all" ON public.po_custom;
CREATE POLICY "auth_all" ON public.po_custom
  TO authenticated
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS "auth_all" ON public.po_custom_pembayaran;
CREATE POLICY "auth_all" ON public.po_custom_pembayaran
  TO authenticated
  USING (true)
  WITH CHECK (true);

GRANT ALL ON TABLE public.po_custom TO anon, authenticated, service_role;
GRANT ALL ON SEQUENCE public.po_custom_id_seq TO anon, authenticated, service_role;
GRANT ALL ON TABLE public.po_custom_pembayaran TO anon, authenticated, service_role;
GRANT ALL ON SEQUENCE public.po_custom_pembayaran_id_seq TO anon, authenticated, service_role;

COMMENT ON TABLE public.po_custom IS 'Pesanan custom pelanggan yang terhubung ke produk inventaris dan pembayaran DP/sisa.';
COMMENT ON COLUMN public.po_custom.atribut_custom IS 'Spesifikasi fleksibel per pesanan, contoh: {"Model":"Minimalis","Ukuran":"80x210","Bahan":"Kayu"}.';
