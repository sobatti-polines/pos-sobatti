import { create } from "zustand";

export interface Product {
  id: number;
  nama_produk: string;
  id_kategori: number;
  hitung_stok: boolean;
  barcode: string | null;
  harga_modal: number;
  harga_jual_satuan: number;
  harga_jual_grosir: number;
  diskon: number;
  kategori: { nama: string } | null;
}

export interface Customer {
  id: number;
  nama_pelanggan: string;
  alamat: string | null;
  no_hp: string | null;
}

export interface PaymentMethod {
  id: number;
  nama: string;
}

export interface CartItem {
  id_produk: number;
  nama_produk: string;
  kategori: string;
  harga_jual: number;
  qty: number;
  diskon_item: number;
}

interface CheckoutPayload {
  items: { id_produk: number; qty: number; diskon_item: number }[];
  id_pelanggan: number | null;
  id_metode_bayar: number;
  diskon_persen: number;
  bayar: number;
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
  diskonPersen: number;
  checkoutLoading: boolean;
  checkoutError: string | null;

  setProducts: (p: Product[]) => void;
  setCustomers: (c: Customer[]) => void;
  setPaymentMethods: (p: PaymentMethod[]) => void;
  setSearchQuery: (q: string) => void;

  addToCart: (product: Product) => void;
  updateQty: (id_produk: number, delta: number) => void;
  removeItem: (id_produk: number) => void;
  clearCart: () => void;

  numpadPress: (val: string) => void;
  setNumpadValue: (val: string) => void;

  setSelectedCustomer: (c: Customer | null) => void;
  setSelectedPayment: (id: number) => void;

  setActiveCartItemId: (id: number | null) => void;
  setDiskonPersen: (pct: number) => void;
  applyNumpadAsQty: () => void;
  applyNumpadAsDiskon: () => void;
  applyNumpadAsItemDiskon: () => void;
  clearDiskon: () => void;

  checkout: () => Promise<{ success: boolean; no_transaksi?: number }>;
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
  diskonPersen: 0,
  checkoutLoading: false,
  checkoutError: null,

  setProducts: (products) => set({ products }),
  setCustomers: (customers) => set({ customers }),
  setPaymentMethods: (methods) => set({ paymentMethods: methods }),
  setSearchQuery: (query) => set({ searchQuery: query }),

  addToCart: (product) =>
    set((state) => {
      const existing = state.cart.find((i) => i.id_produk === product.id);
      if (existing) {
        return {
          cart: state.cart.map((i) =>
            i.id_produk === product.id ? { ...i, qty: i.qty + 1 } : i
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
            harga_jual: product.harga_jual_satuan,
            qty: 1,
            diskon_item: 0,
          },
        ],
      };
    }),

  updateQty: (id_produk, delta) =>
    set((state) => ({
      cart: state.cart
        .map((item) =>
          item.id_produk === id_produk
            ? { ...item, qty: Math.max(0, item.qty + delta) }
            : item
        )
        .filter((item) => item.qty > 0),
    })),

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

  setDiskonPersen: (pct) => set({ diskonPersen: pct }),

  applyNumpadAsQty: () =>
    set((state) => {
      const id = state.activeCartItemId;
      if (id === null) return {};
      const qty = parseInt(state.numpadValue, 10);
      if (isNaN(qty) || qty <= 0) return { numpadValue: "" };
      return {
        cart: state.cart.map((item) =>
          item.id_produk === id ? { ...item, qty } : item
        ),
        numpadValue: "",
      };
    }),

  applyNumpadAsDiskon: () =>
    set((state) => {
      const pct = parseFloat(state.numpadValue);
      if (isNaN(pct) || pct < 0) return { numpadValue: "" };
      return {
        diskonPersen: Math.min(100, pct),
        numpadValue: "",
      };
    }),

  applyNumpadAsItemDiskon: () =>
    set((state) => {
      const id = state.activeCartItemId;
      if (id === null) return {};
      const discount = parseFloat(state.numpadValue);
      if (isNaN(discount) || discount < 0) return { numpadValue: "" };
      return {
        cart: state.cart.map((item) =>
          item.id_produk === id ? { ...item, diskon_item: discount } : item
        ),
        numpadValue: "",
      };
    }),

  clearDiskon: () => set({ diskonPersen: 0 }),

  checkout: async () => {
    set({ checkoutLoading: true, checkoutError: null });
    try {
      const state = get();
      const numpadAmount = state.numpadValue
        ? Math.round(parseFloat(state.numpadValue))
        : 0;

      const payload: CheckoutPayload = {
        items: state.cart.map((i) => ({
          id_produk: i.id_produk,
          qty: i.qty,
          diskon_item: i.diskon_item,
        })),
        id_pelanggan: state.selectedCustomer?.id ?? null,
        id_metode_bayar: state.selectedPayment,
        diskon_persen: state.diskonPersen,
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

      set({ cart: [], numpadValue: "", activeCartItemId: null, diskonPersen: 0, checkoutLoading: false });
      return { success: true, no_transaksi: data.no_transaksi };
    } catch {
      set({ checkoutError: "Gagal memproses pembayaran", checkoutLoading: false });
      return { success: false };
    }
  },
}));

// test