-- TASK 1: Buat tabel event_promo
CREATE TABLE event_promo (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    nama varchar NOT NULL,
    tanggal_mulai date NOT NULL,
    tanggal_selesai date NOT NULL,
    tipe_diskon text NOT NULL,
    nilai_diskon numeric NOT NULL,
    aktif bool NOT NULL DEFAULT true,
    keterangan text,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT event_promo_tanggal_check CHECK (tanggal_selesai >= tanggal_mulai),
    CONSTRAINT event_promo_tipe_diskon_check CHECK (tipe_diskon IN ('persen', 'nominal')),
    CONSTRAINT event_promo_nilai_persen_check CHECK (
        (tipe_diskon = 'persen' AND nilai_diskon > 0 AND nilai_diskon <= 100) OR
        (tipe_diskon = 'nominal' AND nilai_diskon > 0)
    )
);

-- TASK 2: Buat tabel relasi event_promo_produk
CREATE TABLE event_promo_produk (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    id_event_promo uuid NOT NULL REFERENCES event_promo(id) ON DELETE CASCADE,
    id_produk int4 NOT NULL REFERENCES produk(id) ON DELETE CASCADE,
    created_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE(id_event_promo, id_produk)
);
