import { create } from "zustand";

export interface Product {
  id: number;
  nama_produk: string;
  id_kategori: number;
  hitung_stok: boolean;
  stok: number;
  stok_gudang: number;
  barcode: string | null;
  harga_modal: number;
  harga_jual_satuan: number;
  harga_jual_grosir: number;
  harga_jual_promo: number | null;
  diskon: number;
  kategori: { nama: string } | null;
  // Multi-unit sell fields
  satuan: { nama: string } | null;        // base unit name (e.g. "Meter")
  jual_satuan: string | null;             // big sell unit name (e.g. "Roll") or null
  conversion_ratio: number;               // 1 big unit = conversion_ratio base units (same as rasio beli)
  harga_jual_besar_satuan: number | null; // price per big unit — tier Satuan
  harga_jual_besar_grosir: number | null; // price per big unit — tier Grosir
  harga_jual_besar_promo: number | null;  // price per big unit — tier Promo
}

export interface Customer {
  id: number;
  nama_pelanggan: string;
  alamat: string | null;
  no_hp: string | null;
  point: number;
}

export interface PaymentMethod {
  id: number;
  nama: string;
}

export interface CartItem {
  id_produk: number;
  nama_produk: string;
  kategori: string;
  satuan_jual: string | null;  // NULL = base unit, string = big unit name
  qty: number;                 // qty in base units (stock)
  qty_satuan: number;          // qty in sold unit (display)
  harga_jual: number;          // price per sold unit
  diskon_item: number;
  tipe_harga: "Satuan" | "Grosir" | "Promo";
}

interface PosState {
  products: Product[];
  customers: Customer[];
  paymentMethods: PaymentMethod[];
  cart: CartItem[];
  numpadValue: string;
  searchQuery: string;
  selectedCustomer: Customer | null;
  selectedPayment: number;
  activeCartItemId: number | null;
  checkoutLoading: boolean;
  checkoutError: string | null;

  setProducts: (p: Product[]) => void;
  setCustomers: (c: Customer[]) => void;
  setPaymentMethods: (p: PaymentMethod[]) => void;
  setSearchQuery: (q: string) => void;

  addToCart: (product: Product, opts?: { satuan_jual?: string | null }) => void;
  updateQty: (id_produk: number, delta: number) => void;
  removeItem: (id_produk: number) => void;
  clearCart: () => void;

  numpadPress: (val: string) => void;
  setNumpadValue: (val: string) => void;

  setSelectedCustomer: (c: Customer | null) => void;
  setSelectedPayment: (id: number) => void;

  setActiveCartItemId: (id: number | null) => void;
  applyNumpadAsQty: () => void;
  setPriceType: (type: "Satuan" | "Grosir" | "Promo") => void;
  setSellUnit: (satuanJual: string | null) => void;

  checkout: () => Promise<{ success: boolean; id?: number; no_transaksi?: number }>;
}

export const usePosStore = create<PosState>((set, get) => ({
  products: [],
  customers: [],
  paymentMethods: [],
  cart: [],
  numpadValue: "",
  searchQuery: "",
  selectedCustomer: null,
  selectedPayment: 1,
  activeCartItemId: null,
  checkoutLoading: false,
  checkoutError: null,

  setProducts: (products) => set({ products }),
  setCustomers: (customers) => set({ customers }),
  setPaymentMethods: (methods) => set({ paymentMethods: methods }),
  setSearchQuery: (query) => set({ searchQuery: query }),

  addToCart: (product: Product, opts?: { satuan_jual?: string | null }) =>
    set((state) => {
      const satuanJual = opts?.satuan_jual !== undefined ? opts.satuan_jual : null;

      // Determine which price to use based on satuan_jual
      let harga_jual = product.harga_jual_satuan;
      if (satuanJual && product.jual_satuan && satuanJual.toUpperCase() === product.jual_satuan.toUpperCase()) {
        harga_jual = product.harga_jual_besar_satuan ?? 0;
      }

      const ratio = (satuanJual && product.jual_satuan && satuanJual.toUpperCase() === product.jual_satuan.toUpperCase())
        ? (product.conversion_ratio || 1)
        : 1;

      const existing = state.cart.find((i) => i.id_produk === product.id && i.satuan_jual === satuanJual);
      if (existing) {
        return {
          cart: state.cart.map((i) =>
            i.id_produk === product.id && i.satuan_jual === satuanJual
              ? {
                  ...i,
                  qty_satuan: i.qty_satuan + 1,
                  qty: i.qty_satuan * ratio + ratio, // (existing + 1) × ratio
                  harga_jual: i.harga_jual, // keep existing price
                }
              : i
          ),
        };
      }

      return {
        cart: [
          ...state.cart,
          {
            id_produk: product.id,
            nama_produk: product.nama_produk,
            kategori: product.kategori?.nama ?? "",
            satuan_jual: satuanJual,
            qty: 1 * ratio,
            qty_satuan: 1,
            harga_jual,
            diskon_item: product.diskon || 0,
            tipe_harga: "Satuan",
          },
        ],
      };
    }),

  updateQty: (id_produk, delta) =>
    set((state) => {
      return {
        cart: state.cart
          .map((item) => {
            if (item.id_produk !== id_produk) return item;
            const newQtySatuan = item.qty_satuan + delta;
            if (newQtySatuan <= 0) return null;
            // Recompute base qty from qty_satuan and satuan_jual
            const isBig = item.satuan_jual !== null;
            const product = state.products.find((p) => p.id === id_produk);
            const ratio = isBig && product ? (product.conversion_ratio || 1) : 1;
            const newBaseQty = newQtySatuan * ratio;
            return { ...item, qty_satuan: newQtySatuan, qty: newBaseQty };
          })
          .filter((item): item is CartItem => item !== null),
      };
    }),

  removeItem: (id_produk) =>
    set((state) => {
      if (state.activeCartItemId === id_produk) {
        return {
          cart: state.cart.filter((item) => item.id_produk !== id_produk),
          activeCartItemId: null,
        };
      }
      return {
        cart: state.cart.filter((item) => item.id_produk !== id_produk),
      };
    }),

  clearCart: () => set({ cart: [], numpadValue: "", activeCartItemId: null }),

  numpadPress: (val) =>
    set((state) => {
      if (val === "delete") {
        return { numpadValue: state.numpadValue.slice(0, -1) };
      }
      if (val === ".") {
        if (state.numpadValue.includes(".")) return {};
        return { numpadValue: state.numpadValue + "." };
      }
      return { numpadValue: state.numpadValue + val };
    }),

  setNumpadValue: (val) => set({ numpadValue: val }),
  setSelectedCustomer: (c) => set({ selectedCustomer: c }),
  setSelectedPayment: (id) => set({ selectedPayment: id }),

  setActiveCartItemId: (id) =>
    set((state) => ({
      activeCartItemId: state.activeCartItemId === id ? null : id,
    })),

  applyNumpadAsQty: () =>
    set((state) => {
      const id = state.activeCartItemId;
      if (id === null) return {};
      const item = state.cart.find((i) => i.id_produk === id);
      if (!item) return {};
      const qtySatuan = parseInt(state.numpadValue, 10);
      if (isNaN(qtySatuan) || qtySatuan <= 0) return { numpadValue: "" };

      const product = state.products.find((p) => p.id === id);
      const isBig = item.satuan_jual !== null;
      const ratio = isBig && product ? (product.conversion_ratio || 1) : 1;
      const baseQty = qtySatuan * ratio;

      return {
        cart: state.cart.map((i) =>
          i.id_produk === id ? { ...i, qty_satuan: qtySatuan, qty: baseQty } : i
        ),
        numpadValue: "",
      };
    }),

  setPriceType: (type) =>
    set((state) => {
      const id = state.activeCartItemId;
      if (id === null) return {};
      const product = state.products.find((p) => p.id === id);
      if (!product) return {};
      const item = state.cart.find((i) => i.id_produk === id);
      if (!item) return {};
      
      const isBig = item.satuan_jual !== null && product.jual_satuan
        && item.satuan_jual.toUpperCase() === product.jual_satuan.toUpperCase();

      let newPrice = product.harga_jual_satuan;
      if (isBig) {
        // Big unit pricing
        newPrice = product.harga_jual_besar_satuan ?? 0;
        if (type === "Grosir") newPrice = product.harga_jual_besar_grosir ?? newPrice;
        if (type === "Promo" && product.harga_jual_besar_promo != null) newPrice = product.harga_jual_besar_promo;
      } else {
        // Base unit pricing
        newPrice = product.harga_jual_satuan;
        if (type === "Grosir") newPrice = product.harga_jual_grosir;
        if (type === "Promo" && product.harga_jual_promo != null) newPrice = product.harga_jual_promo;
      }

      return {
        cart: state.cart.map((i) =>
          i.id_produk === id ? { ...i, tipe_harga: type, harga_jual: newPrice } : i
        ),
      };
    }),

  setSellUnit: (satuanJual) =>
    set((state) => {
      const id = state.activeCartItemId;
      if (id === null) return {};
      const product = state.products.find((p) => p.id === id);
      if (!product) return {};
      const item = state.cart.find((i) => i.id_produk === id);
      if (!item) return {};

      const isBig = satuanJual !== null
        && product.jual_satuan !== null
        && satuanJual.toUpperCase() === product.jual_satuan.toUpperCase();

      const ratio = isBig ? (product.conversion_ratio || 1) : 1;

      // Pick price based on current tier + new unit
      let newPrice: number;
      if (isBig) {
        newPrice = product.harga_jual_besar_satuan ?? 0;
        if (item.tipe_harga === "Grosir") newPrice = product.harga_jual_besar_grosir ?? newPrice;
        if (item.tipe_harga === "Promo" && product.harga_jual_besar_promo != null) newPrice = product.harga_jual_besar_promo;
      } else {
        newPrice = product.harga_jual_satuan;
        if (item.tipe_harga === "Grosir") newPrice = product.harga_jual_grosir;
        if (item.tipe_harga === "Promo" && product.harga_jual_promo != null) newPrice = product.harga_jual_promo;
      }

      // Recompute base qty from current qty_satuan and new ratio
      const newBaseQty = item.qty_satuan * ratio;

      return {
        cart: state.cart.map((i) =>
          i.id_produk === id
            ? { ...i, satuan_jual: satuanJual, harga_jual: newPrice, qty: newBaseQty }
            : i
        ),
      };
    }),

  checkout: async () => {
    set({ checkoutLoading: true, checkoutError: null });
    try {
      const state = get();
      const numpadAmount = state.numpadValue
        ? Math.round(parseFloat(state.numpadValue))
        : 0;

      const payload = {
        items: state.cart.map((i) => ({
          id_produk: i.id_produk,
          qty: i.qty,                 // base qty (for stock)
          qty_satuan: i.qty_satuan,   // qty in sold unit (for display)
          satuan_jual: i.satuan_jual, // sold unit name (null = base)
          diskon_item: i.diskon_item,
          tipe_harga: i.tipe_harga,
        })),
        id_pelanggan: state.selectedCustomer?.id ?? null,
        id_metode_bayar: state.selectedPayment,
        diskon_persen: 0,
        bayar: numpadAmount || 0,
      };

      const res = await fetch("/api/pos/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (!res.ok) {
        set({ checkoutError: data.error, checkoutLoading: false });
        return { success: false };
      }

      set({ cart: [], numpadValue: "", activeCartItemId: null, checkoutLoading: false });
      return { success: true, id: data.id, no_transaksi: data.no_transaksi };
    } catch {
      set({ checkoutError: "Gagal memproses pembayaran", checkoutLoading: false });
      return { success: false };
    }
  },
}));
