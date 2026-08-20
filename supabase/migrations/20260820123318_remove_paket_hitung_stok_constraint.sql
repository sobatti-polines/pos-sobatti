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

    -- Removed the exception for hitung_stok = true
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
