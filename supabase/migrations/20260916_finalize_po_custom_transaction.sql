-- Finalisasi PO Custom menjadi transaksi penjualan utama.
-- Apply setelah 20260915_add_po_custom.sql.
-- Tujuan:
-- 1) PO Custom tetap menjadi dokumen order/monitoring.
-- 2) Omset/laporan penjualan/laba rugi baru terpengaruh saat PO difinalisasi.
-- 3) Finalisasi dilakukan atomik di PostgreSQL agar nomor transaksi, stok, HPP, dan relasi PO aman.

ALTER TABLE public.po_custom
  ADD COLUMN IF NOT EXISTS id_transaksi_keluar INTEGER REFERENCES public.transaksi_keluar(id),
  ADD COLUMN IF NOT EXISTS finalized_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS finalized_by INTEGER REFERENCES public.pengguna(id);

ALTER TABLE public.transaksi_keluar
  ADD COLUMN IF NOT EXISTS status VARCHAR DEFAULT 'berhasil';

CREATE INDEX IF NOT EXISTS idx_transaksi_keluar_status
  ON public.transaksi_keluar(status);

CREATE UNIQUE INDEX IF NOT EXISTS idx_po_custom_id_transaksi_keluar
  ON public.po_custom(id_transaksi_keluar)
  WHERE id_transaksi_keluar IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_po_custom_finalized_at
  ON public.po_custom(finalized_at)
  WHERE finalized_at IS NOT NULL;

COMMENT ON COLUMN public.po_custom.id_transaksi_keluar IS 'Transaksi penjualan yang dibuat saat PO Custom difinalisasi.';
COMMENT ON COLUMN public.po_custom.finalized_at IS 'Waktu PO Custom difinalisasi menjadi transaksi penjualan.';
COMMENT ON COLUMN public.po_custom.finalized_by IS 'Pengguna yang melakukan finalisasi PO Custom.';

CREATE OR REPLACE FUNCTION public.finalize_po_custom(
  p_id_po BIGINT,
  p_id_pengguna INTEGER,
  p_id_metode_bayar INTEGER
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_po public.po_custom%ROWTYPE;
  v_produk RECORD;
  v_total_dibayar NUMERIC := 0;
  v_prefix TEXT;
  v_last BIGINT;
  v_seq INTEGER;
  v_no_transaksi BIGINT;
  v_tx_id INTEGER;
  v_qty NUMERIC;
  v_harga_jual NUMERIC;
  v_hpp_satuan NUMERIC;
  v_total_hpp NUMERIC;
  v_laba_kotor NUMERIC;
  v_stok_total_sebelum NUMERIC;
  v_stok_total_sesudah NUMERIC;
  v_new_stok NUMERIC;
  v_new_stok_gudang NUMERIC;
BEGIN
  IF p_id_po IS NULL OR p_id_po <= 0 THEN
    RAISE EXCEPTION 'PO custom tidak valid';
  END IF;

  IF p_id_pengguna IS NULL OR p_id_pengguna <= 0 THEN
    RAISE EXCEPTION 'Pengguna tidak valid';
  END IF;

  PERFORM 1
  FROM public.pengguna
  WHERE id = p_id_pengguna
    AND level IN ('ADMIN', 'OWNER');

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Anda tidak memiliki izin untuk finalisasi PO custom';
  END IF;

  IF p_id_metode_bayar IS NULL OR p_id_metode_bayar <= 0 THEN
    RAISE EXCEPTION 'Metode bayar transaksi wajib dipilih';
  END IF;

  PERFORM pg_advisory_xact_lock(987654321);

  SELECT *
  INTO v_po
  FROM public.po_custom
  WHERE id = p_id_po
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'PO custom tidak ditemukan';
  END IF;

  IF v_po.id_transaksi_keluar IS NOT NULL THEN
    RAISE EXCEPTION 'PO custom sudah pernah difinalisasi';
  END IF;

  IF v_po.status = 'BATAL' THEN
    RAISE EXCEPTION 'PO custom batal tidak bisa difinalisasi';
  END IF;

  IF v_po.id_produk IS NULL THEN
    RAISE EXCEPTION 'Produk inventaris wajib dipilih sebelum finalisasi';
  END IF;

  IF COALESCE(v_po.harga_total, 0) <= 0 THEN
    RAISE EXCEPTION 'Harga total PO wajib lebih dari 0';
  END IF;

  v_qty := COALESCE(v_po.qty, 0);
  IF v_qty <= 0 THEN
    RAISE EXCEPTION 'Qty PO wajib lebih dari 0';
  END IF;

  SELECT COALESCE(SUM(jumlah_bayar), 0)
  INTO v_total_dibayar
  FROM public.po_custom_pembayaran
  WHERE id_po = v_po.id;

  IF v_total_dibayar < v_po.harga_total THEN
    RAISE EXCEPTION 'PO custom harus lunas sebelum finalisasi. Sisa pembayaran: %',
      v_po.harga_total - v_total_dibayar;
  END IF;

  PERFORM 1 FROM public.metode_bayar WHERE id = p_id_metode_bayar;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Metode bayar tidak ditemukan';
  END IF;

  SELECT id, nama_produk, hitung_stok, stok, stok_gudang,
         harga_modal, harga_pokok_avco, nilai_persediaan
  INTO v_produk
  FROM public.produk
  WHERE id = v_po.id_produk
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Produk inventaris PO tidak ditemukan';
  END IF;

  IF COALESCE(v_produk.hitung_stok, TRUE) THEN
    IF v_qty > COALESCE(v_produk.stok, 0) + COALESCE(v_produk.stok_gudang, 0) THEN
      RAISE EXCEPTION 'Stok tidak mencukupi untuk produk "%" (tersedia %, diminta %)',
        v_produk.nama_produk,
        COALESCE(v_produk.stok, 0) + COALESCE(v_produk.stok_gudang, 0),
        v_qty;
    END IF;
  END IF;

  v_prefix := to_char(now() AT TIME ZONE 'Asia/Jakarta', 'YYYYMM');

  SELECT COALESCE(MAX(no_transaksi), 0)
  INTO v_last
  FROM public.transaksi_keluar
  WHERE no_transaksi::text LIKE v_prefix || '%';

  IF v_last = 0 THEN
    v_seq := 1;
  ELSE
    v_seq := (v_last % 10000)::INTEGER + 1;
  END IF;

  v_no_transaksi := (v_prefix || lpad(v_seq::TEXT, 4, '0'))::BIGINT;
  v_harga_jual := ROUND(v_po.harga_total / v_qty, 2);
  v_hpp_satuan := COALESCE(NULLIF(v_produk.harga_pokok_avco, 0), v_produk.harga_modal, 0);
  v_total_hpp := ROUND(v_hpp_satuan * v_qty, 2);
  v_laba_kotor := v_po.harga_total - v_total_hpp;

  INSERT INTO public.transaksi_keluar (
    no_transaksi,
    tgl_transaksi,
    id_kasir,
    id_pelanggan,
    id_metode_bayar,
    subtotal,
    diskon_persen,
    diskon_nominal,
    pajak_persen,
    pajak_nominal,
    total,
    bayar,
    kembali,
    dp,
    sisa,
    total_hpp,
    laba_kotor,
    status
  ) VALUES (
    v_no_transaksi,
    now(),
    p_id_pengguna,
    v_po.id_pelanggan,
    p_id_metode_bayar,
    v_po.harga_total,
    0,
    0,
    0,
    0,
    v_po.harga_total,
    v_po.harga_total,
    0,
    0,
    0,
    v_total_hpp,
    v_laba_kotor,
    'berhasil'
  )
  RETURNING id INTO v_tx_id;

  INSERT INTO public.detail_transaksi_keluar (
    id_transaksi,
    id_produk,
    type_harga_jual,
    harga_modal,
    harga_jual,
    diskon_item,
    qty,
    satuan_jual,
    qty_satuan,
    jual_ratio,
    jumlah,
    kas_masuk,
    profit,
    harga_pokok_satuan,
    total_harga_pokok
  ) VALUES (
    v_tx_id,
    v_po.id_produk,
    'SATUAN',
    COALESCE(v_produk.harga_modal, 0),
    v_harga_jual,
    0,
    v_qty,
    NULL,
    NULL,
    1,
    v_po.harga_total,
    v_po.harga_total,
    v_laba_kotor,
    v_hpp_satuan,
    v_total_hpp
  );

  IF COALESCE(v_produk.hitung_stok, TRUE) THEN
    v_stok_total_sebelum := COALESCE(v_produk.stok, 0) + COALESCE(v_produk.stok_gudang, 0);
    v_stok_total_sesudah := v_stok_total_sebelum - v_qty;
    v_new_stok := GREATEST(COALESCE(v_produk.stok, 0) - v_qty, 0);
    v_new_stok_gudang := COALESCE(v_produk.stok_gudang, 0)
      - (v_qty - (COALESCE(v_produk.stok, 0) - v_new_stok));

    INSERT INTO public.riwayat_avco (
      id_produk,
      jenis_mutasi,
      id_referensi,
      qty_keluar,
      harga_satuan_transaksi,
      stok_sebelum,
      avco_sebelum,
      stok_sesudah,
      avco_sesudah,
      nilai_persediaan_sesudah
    ) VALUES (
      v_po.id_produk,
      'penjualan',
      v_tx_id,
      v_qty,
      v_hpp_satuan,
      v_stok_total_sebelum,
      COALESCE(v_produk.harga_pokok_avco, 0),
      v_stok_total_sesudah,
      COALESCE(v_produk.harga_pokok_avco, 0),
      v_stok_total_sesudah * COALESCE(v_produk.harga_pokok_avco, 0)
    );

    UPDATE public.produk
    SET stok = v_new_stok,
        stok_gudang = v_new_stok_gudang,
        nilai_persediaan = v_stok_total_sesudah * COALESCE(harga_pokok_avco, 0)
    WHERE id = v_po.id_produk;
  END IF;

  UPDATE public.po_custom
  SET id_transaksi_keluar = v_tx_id,
      finalized_at = now(),
      finalized_by = p_id_pengguna,
      status = 'SELESAI'
  WHERE id = v_po.id;

  RETURN jsonb_build_object(
    'success', true,
    'id_transaksi_keluar', v_tx_id,
    'no_transaksi', v_no_transaksi,
    'total', v_po.harga_total
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.finalize_po_custom(BIGINT, INTEGER, INTEGER)
  TO authenticated, service_role;
