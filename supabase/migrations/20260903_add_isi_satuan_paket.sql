-- 20260903_add_isi_satuan_paket.sql
-- Tambah kolom isi_satuan: satuan isi per paket (opsional, contoh: PCS, MTR, LBR)
-- Hanya boleh diisi untuk produk paket, non-paket harus NULL

-- 1) Kolom isi_satuan
ALTER TABLE produk ADD COLUMN IF NOT EXISTS isi_satuan TEXT;

-- 2) Update guard trigger: isi_satuan hanya boleh diisi produk paket
CREATE OR REPLACE FUNCTION guard_produk_paket()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.id_produk_master IS NOT NULL THEN
    IF NEW.id_produk_master = NEW.id THEN
      RAISE EXCEPTION 'Produk tidak boleh menjadi master dirinya sendiri';
    END IF;

    IF EXISTS (SELECT 1 FROM produk WHERE id = NEW.id_produk_master AND id_produk_master IS NOT NULL) THEN
      RAISE EXCEPTION 'Master tidak boleh berupa produk paket';
    END IF;

    IF NEW.qty_per_unit IS NULL OR NEW.qty_per_unit <= 0 THEN
      RAISE EXCEPTION 'qty_per_unit wajib diisi dan lebih dari 0 untuk produk paket';
    END IF;

    IF NEW.jenis_isi_paket IS NULL THEN
      RAISE EXCEPTION 'Jenis isi paket wajib dipilih (FIXED_RATIO atau ACTUAL_WEIGHT)';
    END IF;

    IF NOT NEW.hitung_stok THEN
      RAISE EXCEPTION 'Produk paket wajib hitung_stok = true';
    END IF;
  ELSE
    IF NEW.qty_per_unit IS NOT NULL THEN
      RAISE EXCEPTION 'qty_per_unit hanya boleh diisi untuk produk paket';
    END IF;
    IF NEW.jenis_isi_paket IS NOT NULL THEN
      RAISE EXCEPTION 'jenis_isi_paket hanya boleh diisi untuk produk paket';
    END IF;
    IF NEW.isi_satuan IS NOT NULL THEN
      RAISE EXCEPTION 'isi_satuan hanya boleh diisi untuk produk paket';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_guard_produk_paket ON produk;
CREATE TRIGGER trg_guard_produk_paket
BEFORE INSERT OR UPDATE OF id_produk_master, qty_per_unit, hitung_stok, jenis_isi_paket, isi_satuan
ON produk
FOR EACH ROW
EXECUTE FUNCTION guard_produk_paket();
