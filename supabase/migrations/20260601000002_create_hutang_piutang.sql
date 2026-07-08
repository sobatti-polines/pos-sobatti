-- File: 20260601000002_create_hutang_piutang.sql

CREATE TABLE hutang_dagang (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  id_barang_masuk     INTEGER REFERENCES barang_masuk(id),
  id_supplier         INTEGER NOT NULL REFERENCES supplier(id),
  tanggal_hutang      DATE NOT NULL,
  tanggal_jatuh_tempo DATE,
  jumlah_awal         NUMERIC(15,2) NOT NULL,
  jumlah_terbayar     NUMERIC(15,2) NOT NULL DEFAULT 0,
  sisa_hutang         NUMERIC(15,2) GENERATED ALWAYS AS (jumlah_awal - jumlah_terbayar) STORED,
  status              TEXT NOT NULL DEFAULT 'belum_lunas'
                        CHECK (status IN ('belum_lunas', 'lunas', 'lewat_jatuh_tempo')),
  catatan             TEXT,
  created_at          TIMESTAMPTZ DEFAULT now(),
  updated_at          TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE pembayaran_hutang (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  id_hutang       UUID NOT NULL REFERENCES hutang_dagang(id),
  tanggal_bayar   DATE NOT NULL,
  jumlah_bayar    NUMERIC(15,2) NOT NULL,
  metode_bayar    TEXT NOT NULL,
  bukti_bayar     TEXT,
  id_pengguna     INTEGER NOT NULL REFERENCES pengguna(id),
  catatan         TEXT,
  created_at      TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE piutang_dagang (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  id_transaksi_keluar   INTEGER REFERENCES transaksi_keluar(id),
  id_pelanggan          INTEGER NOT NULL REFERENCES pelanggan(id),
  tanggal_piutang       DATE NOT NULL,
  tanggal_jatuh_tempo   DATE,
  jumlah_awal           NUMERIC(15,2) NOT NULL,
  jumlah_terbayar       NUMERIC(15,2) NOT NULL DEFAULT 0,
  sisa_piutang          NUMERIC(15,2) GENERATED ALWAYS AS (jumlah_awal - jumlah_terbayar) STORED,
  status                TEXT NOT NULL DEFAULT 'belum_lunas'
                          CHECK (status IN ('belum_lunas', 'lunas', 'lewat_jatuh_tempo', 'macet')),
  catatan               TEXT,
  created_at            TIMESTAMPTZ DEFAULT now(),
  updated_at            TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE pembayaran_piutang (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  id_piutang      UUID NOT NULL REFERENCES piutang_dagang(id),
  tanggal_bayar   DATE NOT NULL,
  jumlah_bayar    NUMERIC(15,2) NOT NULL,
  metode_bayar    TEXT NOT NULL,
  id_pengguna     INTEGER NOT NULL REFERENCES pengguna(id),
  catatan         TEXT,
  created_at      TIMESTAMPTZ DEFAULT now()
);
