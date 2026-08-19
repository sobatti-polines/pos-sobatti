-- =====================================================================
-- SCRIPT: FORCE DELETE PRODUK BESERTA RIWAYAT BARANG MASUK & AVCO
-- =====================================================================
-- PERHATIAN: 
-- Ganti angka 9999 di bawah ini dengan ID PRODUK yang ingin Anda hapus.
-- Script ini akan menghapus permanen data riwayat produk terkait.
-- Jika produk tersebut pernah dijual di kasir, script akan menolak 
-- penghapusan secara otomatis untuk menjaga integritas data akuntansi.
-- =====================================================================

BEGIN;

DO $$
DECLARE
    -- >>> UBAH ANGKA DI BAWAH INI SESUAI ID PRODUK YANG INGIN DIHAPUS <<<
    TARGET_PRODUK_ID INT := 9999; 
    
    v_count_sales INT;
    v_count_retur INT;
    v_count_paket INT;
BEGIN
    -- 1. Validasi: Jangan hapus jika ada penjualan
    SELECT COUNT(*) INTO v_count_sales FROM detail_transaksi_keluar WHERE id_produk = TARGET_PRODUK_ID;
    IF v_count_sales > 0 THEN
        RAISE EXCEPTION 'Produk % memiliki riwayat penjualan. DIBATALKAN!', TARGET_PRODUK_ID;
    END IF;

    -- 2. Validasi: Jangan hapus jika ada retur pembelian
    SELECT COUNT(*) INTO v_count_retur FROM retur_pembelian_detail WHERE id_produk = TARGET_PRODUK_ID;
    IF v_count_retur > 0 THEN
        RAISE EXCEPTION 'Produk % memiliki riwayat retur pembelian. DIBATALKAN!', TARGET_PRODUK_ID;
    END IF;

    -- 3. Validasi: Jangan hapus jika menjadi master produk paket
    SELECT COUNT(*) INTO v_count_paket FROM produk WHERE id_produk_master = TARGET_PRODUK_ID;
    IF v_count_paket > 0 THEN
        RAISE EXCEPTION 'Produk % adalah master dari produk paket. DIBATALKAN!', TARGET_PRODUK_ID;
    END IF;

    -- 4. Hapus secara berurutan dari bawah (child to parent)
    DELETE FROM event_promo_produk WHERE id_produk = TARGET_PRODUK_ID;
    DELETE FROM stok_opname_sesi_detail WHERE id_produk = TARGET_PRODUK_ID;
    DELETE FROM stok_opname WHERE id_produk = TARGET_PRODUK_ID;
    DELETE FROM barang_masuk WHERE id_produk = TARGET_PRODUK_ID;
    DELETE FROM riwayat_avco WHERE id_produk = TARGET_PRODUK_ID;
    
    -- 5. Terakhir, Hapus produk itu sendiri
    DELETE FROM produk WHERE id = TARGET_PRODUK_ID;

    RAISE NOTICE 'Produk % beserta semua riwayat (barang masuk & avco) BERHASIL dihapus.', TARGET_PRODUK_ID;
END $$;

COMMIT;
