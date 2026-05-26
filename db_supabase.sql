-- WARNING: This schema is for context only and is not meant to be run.
-- Table order and constraints may not be valid for execution.

CREATE TABLE public.barang_masuk (
  id integer NOT NULL DEFAULT nextval('barang_masuk_id_seq'::regclass),
  tgl_masuk date NOT NULL DEFAULT CURRENT_DATE,
  id_supplier integer,
  id_produk integer NOT NULL,
  harga_beli numeric NOT NULL DEFAULT 0,
  jumlah numeric NOT NULL DEFAULT 0,
  total numeric NOT NULL DEFAULT 0,
  created_at timestamp without time zone NOT NULL DEFAULT now(),
  keterangan text,
  CONSTRAINT barang_masuk_pkey PRIMARY KEY (id),
  CONSTRAINT barang_masuk_id_supplier_fkey FOREIGN KEY (id_supplier) REFERENCES public.supplier(id),
  CONSTRAINT barang_masuk_id_produk_fkey FOREIGN KEY (id_produk) REFERENCES public.produk(id)
);
CREATE TABLE public.detail_transaksi_keluar (
  id integer NOT NULL DEFAULT nextval('detail_transaksi_keluar_id_seq'::regclass),
  id_transaksi integer NOT NULL,
  id_produk integer NOT NULL,
  type_harga_jual character varying,
  harga_modal numeric NOT NULL DEFAULT 0,
  harga_jual numeric NOT NULL DEFAULT 0,
  diskon_item numeric NOT NULL DEFAULT 0,
  qty numeric NOT NULL DEFAULT 0,
  jumlah numeric NOT NULL DEFAULT 0,
  kas_masuk numeric NOT NULL DEFAULT 0,
  profit numeric NOT NULL DEFAULT 0,
  CONSTRAINT detail_transaksi_keluar_pkey PRIMARY KEY (id),
  CONSTRAINT detail_transaksi_keluar_id_transaksi_fkey FOREIGN KEY (id_transaksi) REFERENCES public.transaksi_keluar(id),
  CONSTRAINT detail_transaksi_keluar_id_produk_fkey FOREIGN KEY (id_produk) REFERENCES public.produk(id)
);
CREATE TABLE public.kategori (
  id integer NOT NULL DEFAULT nextval('kategori_id_seq'::regclass),
  nama character varying NOT NULL UNIQUE,
  CONSTRAINT kategori_pkey PRIMARY KEY (id)
);
CREATE TABLE public.metode_bayar (
  id integer NOT NULL DEFAULT nextval('metode_bayar_id_seq'::regclass),
  nama character varying NOT NULL UNIQUE,
  CONSTRAINT metode_bayar_pkey PRIMARY KEY (id)
);
CREATE TABLE public.pelanggan (
  id integer NOT NULL DEFAULT nextval('pelanggan_id_seq'::regclass),
  nama_pelanggan character varying NOT NULL,
  alamat text,
  no_hp character varying,
  email character varying,
  keterangan text,
  created_at timestamp without time zone NOT NULL DEFAULT now(),
  CONSTRAINT pelanggan_pkey PRIMARY KEY (id)
);
CREATE TABLE public.pengaturan (
  id integer NOT NULL DEFAULT 1 CHECK (id = 1),
  nama_toko character varying,
  alamat text,
  telepon character varying,
  email character varying,
  nama_kasir_aktif character varying,
  metode_diskon character varying DEFAULT 'Nominal'::character varying,
  bank1_nama character varying,
  bank1_rekening character varying,
  bank1_atas_nama character varying,
  bank2_nama character varying,
  bank2_rekening character varying,
  bank2_atas_nama character varying,
  footer_struk_1 character varying,
  footer_struk_2 character varying,
  footer_struk_3 character varying,
  footer_invoice_1 character varying,
  footer_invoice_2 character varying,
  footer_invoice_3 character varying,
  updated_at timestamp without time zone NOT NULL DEFAULT now(),
  pajak_persen numeric DEFAULT 0,
  jenis_nota text DEFAULT 'Invoice'::text,
  metode_cetak text DEFAULT 'Preview'::text,
  logo_nota boolean DEFAULT false,
  hormat_kami_nama text,
  CONSTRAINT pengaturan_pkey PRIMARY KEY (id)
);
CREATE TABLE public.pengguna (
  id integer NOT NULL DEFAULT nextval('pengguna_id_seq'::regclass),
  username character varying NOT NULL UNIQUE,
  password character varying NOT NULL,
  level character varying NOT NULL DEFAULT 'KASIR'::character varying,
  aktif boolean NOT NULL DEFAULT true,
  created_at timestamp without time zone NOT NULL DEFAULT now(),
  nama text,
  CONSTRAINT pengguna_pkey PRIMARY KEY (id)
);
CREATE TABLE public.produk (
  id integer NOT NULL DEFAULT nextval('produk_id_seq'::regclass),
  nama_produk character varying NOT NULL UNIQUE,
  id_kategori integer,
  id_satuan integer,
  hitung_stok boolean NOT NULL DEFAULT true,
  harga_modal numeric NOT NULL DEFAULT 0,
  harga_jual_satuan numeric NOT NULL DEFAULT 0,
  harga_jual_grosir numeric,
  harga_jual_promo numeric,
  diskon numeric NOT NULL DEFAULT 0,
  created_at timestamp without time zone NOT NULL DEFAULT now(),
  updated_at timestamp without time zone NOT NULL DEFAULT now(),
  stok_minimum integer NOT NULL DEFAULT 10,
  barcode text UNIQUE,
  CONSTRAINT produk_pkey PRIMARY KEY (id),
  CONSTRAINT produk_id_kategori_fkey FOREIGN KEY (id_kategori) REFERENCES public.kategori(id),
  CONSTRAINT produk_id_satuan_fkey FOREIGN KEY (id_satuan) REFERENCES public.satuan(id)
);
CREATE TABLE public.satuan (
  id integer NOT NULL DEFAULT nextval('satuan_id_seq'::regclass),
  nama character varying NOT NULL UNIQUE,
  CONSTRAINT satuan_pkey PRIMARY KEY (id)
);
CREATE TABLE public.stok_opname (
  id integer NOT NULL DEFAULT nextval('stok_opname_id_seq'::regclass),
  tgl_opname date NOT NULL DEFAULT CURRENT_DATE,
  id_produk integer NOT NULL,
  stok_sistem numeric NOT NULL DEFAULT 0,
  stok_fisik numeric NOT NULL DEFAULT 0,
  selisih numeric NOT NULL DEFAULT 0,
  keterangan text,
  created_at timestamp without time zone NOT NULL DEFAULT now(),
  CONSTRAINT stok_opname_pkey PRIMARY KEY (id),
  CONSTRAINT stok_opname_id_produk_fkey FOREIGN KEY (id_produk) REFERENCES public.produk(id)
);
CREATE TABLE public.supplier (
  id integer NOT NULL DEFAULT nextval('supplier_id_seq'::regclass),
  nama_supplier character varying NOT NULL,
  alamat text,
  telepon character varying,
  email character varying,
  keterangan text,
  created_at timestamp without time zone NOT NULL DEFAULT now(),
  CONSTRAINT supplier_pkey PRIMARY KEY (id)
);
CREATE TABLE public.transaksi_keluar (
  id integer NOT NULL DEFAULT nextval('transaksi_keluar_id_seq'::regclass),
  no_transaksi bigint NOT NULL UNIQUE,
  tgl_transaksi timestamp without time zone NOT NULL DEFAULT now(),
  id_kasir integer NOT NULL,
  id_pelanggan integer,
  id_metode_bayar integer,
  subtotal numeric NOT NULL DEFAULT 0,
  diskon_persen numeric NOT NULL DEFAULT 0,
  diskon_nominal numeric NOT NULL DEFAULT 0,
  pajak_persen numeric NOT NULL DEFAULT 0,
  pajak_nominal numeric NOT NULL DEFAULT 0,
  total numeric NOT NULL DEFAULT 0,
  bayar numeric NOT NULL DEFAULT 0,
  kembali numeric NOT NULL DEFAULT 0,
  dp numeric NOT NULL DEFAULT 0,
  sisa numeric NOT NULL DEFAULT 0,
  created_at timestamp without time zone NOT NULL DEFAULT now(),
  CONSTRAINT transaksi_keluar_pkey PRIMARY KEY (id),
  CONSTRAINT transaksi_keluar_id_kasir_fkey FOREIGN KEY (id_kasir) REFERENCES public.pengguna(id),
  CONSTRAINT transaksi_keluar_id_pelanggan_fkey FOREIGN KEY (id_pelanggan) REFERENCES public.pelanggan(id),
  CONSTRAINT transaksi_keluar_id_metode_bayar_fkey FOREIGN KEY (id_metode_bayar) REFERENCES public.metode_bayar(id)
);