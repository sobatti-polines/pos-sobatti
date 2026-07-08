-- File: 20260601000004_create_kas_dan_laporan.sql

CREATE TABLE saldo_kas_harian (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tanggal         DATE NOT NULL UNIQUE,
  saldo_awal      NUMERIC(15,2) NOT NULL DEFAULT 0,
  total_masuk     NUMERIC(15,2) NOT NULL DEFAULT 0,
  total_keluar    NUMERIC(15,2) NOT NULL DEFAULT 0,
  saldo_akhir     NUMERIC(15,2) GENERATED ALWAYS AS (saldo_awal + total_masuk - total_keluar) STORED,
  uang_aktual     NUMERIC(15,2),
  selisih         NUMERIC(15,2),
  dikonfirmasi    BOOLEAN DEFAULT FALSE,
  id_pengguna     INTEGER REFERENCES pengguna(id),
  created_at      TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE pengaturan_keuangan (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  modal_awal      NUMERIC(15,2) NOT NULL DEFAULT 0,
  tanggal_mulai   DATE NOT NULL,
  nama_pemilik    TEXT,
  npwp            TEXT,
  updated_at      TIMESTAMPTZ DEFAULT now()
);
