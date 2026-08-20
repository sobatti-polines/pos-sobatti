"use client";
import { Clock } from "./clock";


import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  Search,
  Minus,
  Plus,
  Trash2,
  Delete,
  UserCircle,
  X,
  Check,
  ChevronDown,
  Receipt,
  Smartphone,
  Wifi,
  WifiOff,
  LogOut,
  PackageSearch,
  ScanLine,
  UserPlus,
  Phone,
  Award,
  Calculator,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { usePosStore, type Customer, type Product } from "@/stores/pos-store";
import { LowStockBanner } from "@/components/low-stock-banner";
import { Highlight } from "@/components/highlight";

// Harga jual besar (ROLL/LUSIN/dll) SELALU dihitung dari harga kecil × rasio
// (aturan 20260816_harga_jual_besar_otomatis). POS tidak boleh bergantung pada
// kolom DB yang bisa NULL/0 untuk data lama — hitung ulang saat data dimuat.
function normalizeBigPrices(p: Product): Product {
  const ratio = Number(p.conversion_ratio) || 1;
  if (p.jual_satuan && ratio > 0) {
    return {
      ...p,
      harga_jual_besar_satuan: Math.round(Number(p.harga_jual_satuan || 0) * ratio),
      harga_jual_besar_grosir: Math.round(Number(p.harga_jual_grosir || 0) * ratio),
      harga_jual_besar_promo:
        p.harga_jual_promo != null
          ? Math.round(Number(p.harga_jual_promo) * ratio)
          : null,
    };
  }
  return {
    ...p,
    harga_jual_besar_satuan: null,
    harga_jual_besar_grosir: null,
    harga_jual_besar_promo: null,
  };
}

function formatIDR(n: number) {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(n);
}


const categoryColors: Record<string, string> = {
  "Semen & Mortar": "bg-amber-100/50 text-amber-800",
  "Cat & Pelapis": "bg-sky-100/50 text-sky-800",
  "Besi & Baja": "bg-slate-100 text-slate-700",
  "Kayu & Triplek": "bg-amber-100/50 text-amber-800",
  "Pipa & Sambungan": "bg-emerald-100/50 text-emerald-700",
  "Atap & Plafon": "bg-orange-100/50 text-orange-700",
  "Keramik & Lantai": "bg-rose-100/50 text-rose-700",
  "Alat Listrik": "bg-indigo-100/50 text-indigo-700",
  "Alat Pertukangan": "bg-stone-100/50 text-stone-700",
  "Mur & Baut": "bg-gray-100/50 text-gray-700",
  "Peralatan Kamar Mandi": "bg-blue-100/50 text-blue-700",
  "Lem & Perekat": "bg-yellow-100/50 text-yellow-700",
};

// ── Scanner toast ─────────────────────────────────────────────────────────────
interface ScanToast { id: number; text: string; ok: boolean; }

// ── Stock check (hasil scan barcode di modal cek stok) ───────────────────────
interface ScannedStockProduct {
  nama_produk?: string;
  barcode?: string | null;
  stok?: number;
  stok_gudang?: number;
  kategori?: { nama?: string } | string | null;
  satuan?: { nama?: string } | null;
}

export function PosClient() {
  const router = useRouter();
  const supabase = createClient();
  const [cashier, setCashier] = useState<{ name: string; username: string } | null>(null);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.refresh();
    router.push("/");
  };
  const products = usePosStore((s) => s.products);
  const customers = usePosStore((s) => s.customers);
  const paymentMethods = usePosStore((s) => s.paymentMethods);
  const cart = usePosStore((s) => s.cart);
  const searchQuery = usePosStore((s) => s.searchQuery);
  const numpadValue = usePosStore((s) => s.numpadValue);
  const selectedCustomer = usePosStore((s) => s.selectedCustomer);
  const selectedPayment = usePosStore((s) => s.selectedPayment);
  const activeCartItemId = usePosStore((s) => s.activeCartItemId);
  const checkoutLoading = usePosStore((s) => s.checkoutLoading);
  const checkoutError = usePosStore((s) => s.checkoutError);

  const setProducts = usePosStore((s) => s.setProducts);
  const setCustomers = usePosStore((s) => s.setCustomers);
  const setPaymentMethods = usePosStore((s) => s.setPaymentMethods);
  const setSearchQuery = usePosStore((s) => s.setSearchQuery);
  const addToCart = usePosStore((s) => s.addToCart);
  const updateQty = usePosStore((s) => s.updateQty);
  const removeItem = usePosStore((s) => s.removeItem);
  const numpadPress = usePosStore((s) => s.numpadPress);
  const setNumpadValue = usePosStore((s) => s.setNumpadValue);
  const setSelectedCustomer = usePosStore((s) => s.setSelectedCustomer);
  const setSelectedPayment = usePosStore((s) => s.setSelectedPayment);
  const setActiveCartItemId = usePosStore((s) => s.setActiveCartItemId);
  const applyNumpadAsQty = usePosStore((s) => s.applyNumpadAsQty);
  const setPriceType = usePosStore((s) => s.setPriceType);
  const setSellUnit = usePosStore((s) => s.setSellUnit);
  const checkout = usePosStore((s) => s.checkout);
  const clearCart = usePosStore((s) => s.clearCart);

  // ── User state ─────────────────────────────────────────────────────────────
  useEffect(() => {
    const fetchUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const username = user.user_metadata?.username || user.email?.split("@")[0] || "Cashier";
        
        // Fetch detailed name from pengguna table
        const { data: pengguna } = await supabase
          .from("pengguna")
          .select("nama")
          .eq("username", username)
          .maybeSingle();
        
        setCashier({
          name: pengguna?.nama || username,
          username: username
        });
      }
    };
    fetchUser();
  }, [supabase]);

  const [taxRate, setTaxRate] = useState(0);
  const [jenisNota, setJenisNota] = useState("Invoice");
  const [metodeCetak, setMetodeCetak] = useState("Preview");

  // ── Server-side search state ─────────────────────────────────────────────
  const [serverSearch, setServerSearch] = useState<{ q: string; data: Product[] } | null>(null);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);

  // ── Phone scanner state ───────────────────────────────────────────────────
  const [sessionId] = useState(() => crypto.randomUUID());
  const [scannerOpen, setScannerOpen] = useState(false);
  const [scannerConnected, setScannerConnected] = useState(false);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [scanToasts, setScanToasts] = useState<ScanToast[]>([]);
  const toastIdRef = useRef(0);

  // ── Stock Check State ─────────────────────────────────────────────────────
  const stockCheckOpenRef = useRef(false);
  const [stockCheckOpen, setStockCheckOpen] = useState(false);
  const [scannedStockProduct, setScannedStockProduct] = useState<ScannedStockProduct | null>(null);

  // ── Member Point System ───────────────────────────────────────────────────
  const [memberSearchOpen, setMemberSearchOpen] = useState(false);
  const [memberSearchQuery, setMemberSearchQuery] = useState("");
  const [memberSearchResult, setMemberSearchResult] = useState<Customer | "not_found" | null>(null);
  const [memberSearchLoading, setMemberSearchLoading] = useState(false);

  const [memberRegOpen, setMemberRegOpen] = useState(false);
  const [memberRegName, setMemberRegName] = useState("");
  const [memberRegPhone, setMemberRegPhone] = useState("");
  const [memberRegLoading, setMemberRegLoading] = useState(false);
  const [memberRegError, setMemberRegError] = useState("");

  // ── Add Item Dialog State (4A: search click → choose unit) ──────────────
  const [addItemOpen, setAddItemOpen] = useState(false);
  const [addItemProduct, setAddItemProduct] = useState<Product | null>(null);
  const [addItemSatuan, setAddItemSatuan] = useState<string | null>(null); // null = base
  const [addItemQty, setAddItemQty] = useState(1);

  const openAddItemDialog = (product: Product) => {
    if (!product.jual_satuan) {
      // No big unit → add directly
      addToCart(product);
      setSearchQuery("");
      return;
    }
    setAddItemProduct(normalizeBigPrices(product));
    setAddItemSatuan(null); // default base unit
    setAddItemQty(1);
    setAddItemOpen(true);
  };

  const handleAddItemConfirm = () => {
    if (!addItemProduct) return;
    // Add with chosen unit
    addToCart(addItemProduct, { satuan_jual: addItemSatuan });

    // If qty > 1, set it after item is added
    if (addItemQty > 1) {
      setTimeout(() => {
        const state = usePosStore.getState();
        const product = state.products.find((p) => p.id === addItemProduct.id);
        const isBig = addItemSatuan !== null && product?.jual_satuan
          && addItemSatuan.toUpperCase() === product.jual_satuan.toUpperCase();
        const ratio = isBig && product ? (product.conversion_ratio || 1) : 1;

        usePosStore.setState({
          activeCartItemId: addItemProduct.id,
          cart: state.cart.map((i) =>
            i.id_produk === addItemProduct.id && i.satuan_jual === addItemSatuan
              ? { ...i, qty_satuan: addItemQty, qty: addItemQty * ratio }
              : i
          ),
        });
      }, 0);
    }
    setAddItemOpen(false);
    setAddItemProduct(null);
    setSearchQuery("");
  };

  const pushToast = useCallback((text: string, ok: boolean) => {
    const id = ++toastIdRef.current;
    setScanToasts((t) => [...t.slice(-2), { id, text, ok }]);
    setTimeout(() => setScanToasts((t) => t.filter((x) => x.id !== id)), 3000);
  }, []);

  // SSE connection to receive barcodes from phone
  useEffect(() => {
    const es = new EventSource(`/api/scanner/${sessionId}/events`);
    es.onopen = () => setScannerConnected(true);
    es.onerror = () => setScannerConnected(false);
    es.onmessage = async (e) => {
      const { barcode } = JSON.parse(e.data);
      // Look up product
      const res = await fetch(`/api/pos/barcode?code=${encodeURIComponent(barcode)}`);
      if (res.ok) {
        const { product } = await res.json();
        if (product) {
          const normalized = normalizeBigPrices(product);
          if (stockCheckOpenRef.current) {
            setScannedStockProduct(normalized);
          } else {
            addToCart(normalized);
            pushToast(product.nama_produk, true);
          }
        } else {
          pushToast(`Produk "${barcode}" tidak ditemukan`, false);
        }
      }
    };
    return () => es.close();
  }, [sessionId, addToCart, pushToast]);

  // Generate QR code when modal opens
  useEffect(() => {
    if (!scannerOpen || qrDataUrl) return;
    
    const generateQr = async () => {
      try {
        const res = await fetch('/api/network-ip');
        const { ip } = await res.json();
        
        // Force https protocol because navigator.mediaDevices requires a secure context
        const protocol = "https:";
        const port = window.location.port ? `:${window.location.port}` : '';
        const origin = `${protocol}//${ip}${port}`;
        
        const url = `${origin}/scanner/${sessionId}`;
        const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(url)}&bgcolor=ffffff&color=0a0a0a&margin=2`;
        setQrDataUrl(qrUrl);
      } catch (err) {
        console.error("Failed to fetch network IP:", err);
      }
    };

    generateQr();
  }, [scannerOpen, sessionId, qrDataUrl]);

  useEffect(() => {
    const load = async () => {
      const [prodRes, custRes, pmRes, settingsRes] = await Promise.all([
        fetch("/api/pos/products"),
        fetch("/api/pos/customers"),
        fetch("/api/pos/payment-methods"),
        supabase.from("pengaturan").select("pajak_persen, jenis_nota, metode_cetak").eq("id", 1).single()
      ]);
      const prodJson = await prodRes.json();
      let data = prodJson.data ?? prodJson ?? [];
      
      const pIds = data.map((p: any) => p.id);
      if (pIds.length > 0) {
        try {
          const res = await fetch("/api/event-promo/efektif", {
            method: "POST", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ id_produk: pIds })
          });
          if (res.ok) {
            const promo = await res.json();
            const promoMap = new Map<number, any>(promo.map((p: any) => [p.id_produk, p]));
            data = data.map((p: any) => {
              const pr = promoMap.get(p.id);
              if (pr && pr.id_event_promo) {
                return {
                  ...p,
                  harga_asli_satuan: p.harga_jual_satuan,
                  harga_asli_besar_satuan: p.harga_jual_besar_satuan,
                  harga_jual_satuan: pr.harga_jual_satuan,
                  harga_jual_grosir: pr.harga_jual_grosir,
                  harga_jual_promo: pr.harga_jual_promo,
                  harga_jual_besar_satuan: pr.harga_jual_besar_satuan,
                  harga_jual_besar_grosir: pr.harga_jual_besar_grosir,
                  harga_jual_besar_promo: pr.harga_jual_besar_promo,
                  nama_event_promo: pr.nama_event
                };
              }
              return p;
            });
          }
        } catch (e) {
          console.error("Failed to fetch promo", e);
        }
      }
      setProducts(data.map(normalizeBigPrices));
      setCustomers(await custRes.json());
      setPaymentMethods(await pmRes.json());
      
      if (settingsRes.data) {
        setTaxRate(settingsRes.data.pajak_persen || 0);
        setJenisNota(settingsRes.data.jenis_nota || "Invoice");
        setMetodeCetak(settingsRes.data.metode_cetak || "Preview");
      }
    };
    load();
  }, [setProducts, setCustomers, setPaymentMethods, supabase]);

  // ── Debounced server-side search ──────────────────────────────────────────
  // Pencarian lokal hanya menjangkau 500 produk pertama yang dimuat. Untuk
  // menjangkau seluruh katalog (1000+ produk), query dikirim ke server.
  useEffect(() => {
    const q = searchQuery.trim();
    if (!q) return;
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      setSearchLoading(true);
      try {
        const res = await fetch(`/api/pos/products?search=${encodeURIComponent(q)}`, {
          signal: controller.signal,
        });
        if (!res.ok) return;
        const json = await res.json();
        let sdata = json.data ?? [];
        
        const spIds = sdata.map((p: any) => p.id);
        if (spIds.length > 0) {
          try {
            const pres = await fetch("/api/event-promo/efektif", {
              method: "POST", headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ id_produk: spIds })
            });
            if (pres.ok) {
              const promo = await pres.json();
              const promoMap = new Map<number, any>(promo.map((p: any) => [p.id_produk, p]));
              sdata = sdata.map((p: any) => {
                const pr = promoMap.get(p.id);
                if (pr && pr.id_event_promo) {
                  return {
                    ...p,
                    harga_asli_satuan: p.harga_jual_satuan,
                    harga_asli_besar_satuan: p.harga_jual_besar_satuan,
                    harga_jual_satuan: pr.harga_jual_satuan,
                    harga_jual_grosir: pr.harga_jual_grosir,
                    harga_jual_promo: pr.harga_jual_promo,
                    harga_jual_besar_satuan: pr.harga_jual_besar_satuan,
                    harga_jual_besar_grosir: pr.harga_jual_besar_grosir,
                    harga_jual_besar_promo: pr.harga_jual_besar_promo,
                    nama_event_promo: pr.nama_event
                  };
                }
                return p;
              });
            }
          } catch (e) {}
        }

        setServerSearch({ q, data: sdata.map(normalizeBigPrices) });
      } catch (err) {
        if ((err as Error).name !== "AbortError") {
          setServerSearch(null);
        }
      } finally {
        setSearchLoading(false);
      }
    }, 300);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [searchQuery]);

  const barcodeBufferRef = useRef<string>("");
  const lastKeyTimeRef = useRef<number>(0);

  useEffect(() => {
    async function handleKeyDown(e: KeyboardEvent) {
      // ── Global Barcode Scanner Detection ──
      // Ignore modifier keys
      if (!e.ctrlKey && !e.altKey && !e.metaKey) {
        const now = Date.now();
        
        // If more than 150ms since last key, assume human typing and reset buffer
        if (now - lastKeyTimeRef.current > 150) {
          barcodeBufferRef.current = "";
        }
        
        // If Enter is pressed and we have a buffer (likely a scanner)
        if (e.key === "Enter" && barcodeBufferRef.current.length > 3) {
          e.preventDefault();
          const barcode = barcodeBufferRef.current;
          barcodeBufferRef.current = "";
          
          let product = products.find(p => p.barcode === barcode);
          if (!product) {
            // Produk mungkin berada di luar 500 pertama yang dimuat di memori
            const res = await fetch(`/api/pos/barcode?code=${encodeURIComponent(barcode)}`);
            if (res.ok) {
              const { product: serverProduct } = await res.json();
              if (serverProduct) product = normalizeBigPrices(serverProduct);
            }
          }
          if (product) {
            if (stockCheckOpenRef.current) {
              setScannedStockProduct(product);
            } else {
              addToCart(product);
              pushToast(product.nama_produk, true);
              setSearchQuery(""); // Clear search field if it got typed there
            }
          } else {
            pushToast(`Produk "${barcode}" tidak ditemukan`, false);
          }
          return;
        }
        
        // Accumulate printable characters
        if (e.key.length === 1) {
          barcodeBufferRef.current += e.key;
          lastKeyTimeRef.current = now;
        }
      }

      // ── Numpad Controls ──
      const numpadMap: Record<string, string> = {
        Numpad0: "0", Numpad1: "1", Numpad2: "2", Numpad3: "3",
        Numpad4: "4", Numpad5: "5", Numpad6: "6", Numpad7: "7",
        Numpad8: "8", Numpad9: "9", NumpadDecimal: ".",
      };
      const mapped = numpadMap[e.code];
      if (mapped) {
        e.preventDefault();
        numpadPress(mapped);
        return;
      }
      if (e.code === "NumpadSubtract" || (e.code === "Backspace" && e.location === 3)) {
        e.preventDefault();
        numpadPress("delete");
        return;
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [numpadPress, products, addToCart, pushToast, setSearchQuery]);

  const serverResultsActive = serverSearch !== null && serverSearch.q === searchQuery.trim();

  const filteredProducts = useMemo(() => {
    const sortByName = (arr: Product[]) =>
      [...arr].sort((a, b) =>
        a.nama_produk.localeCompare(b.nama_produk, "id", { sensitivity: "base" })
      );
    if (serverResultsActive && serverSearch) return sortByName(serverSearch.data);
    if (!searchQuery.trim()) return sortByName(products);
    const q = searchQuery.toLowerCase();
    return sortByName(
      products.filter(
        (p) =>
          p.nama_produk.toLowerCase().includes(q) ||
          p.sku?.toLowerCase().includes(q) ||
          p.merk?.nama?.toLowerCase().includes(q) ||
          p.kategori?.nama?.toLowerCase().includes(q) ||
          (p.barcode && p.barcode.includes(q))
      )
    );
  }, [products, searchQuery, serverSearch, serverResultsActive]);

  const subtotal = cart.reduce((sum, item) => sum + (item.harga_jual - item.diskon_item) * item.qty_satuan, 0);
  const tax = subtotal * (taxRate / 100);
  const total = subtotal + tax;
  const numpadAmount = numpadValue
    ? Math.round(parseFloat(numpadValue))
    : 0;
  
  const selectedPaymentMethod = paymentMethods.find(pm => pm.id === selectedPayment);
  const isDP = selectedPaymentMethod?.nama.toUpperCase() === "DP";
  
  const change = !isDP ? Math.max(0, numpadAmount - total) : 0;
  const sisaDP = isDP ? Math.max(0, total - numpadAmount) : 0;
  // Bayar kurang hanya dicegah untuk pembayaran non-DP (DP sengaja boleh sebagian)
  const isBayarKurang = !isDP && numpadAmount > 0 && numpadAmount < total;
  const isBayarKosong = !isDP && numpadAmount <= 0 && cart.length > 0;

  const handleCheckout = async () => {
    const result = await checkout();
    if (result.success && result.id) {
      setNumpadValue("");
      let url = `/pos/invoice/${result.id}`;
      const isAutoPrint = metodeCetak === "Direct" ? "&print=auto" : "";
      
      if (jenisNota === "Struk") {
        url = `/pos/invoice/${result.id}/receipt?mode=struk${isAutoPrint}`;
      } else if (jenisNota === "Faktur") {
        url = `/pos/invoice/${result.id}?type=faktur${isAutoPrint}`;
      } else {
        url = `/pos/invoice/${result.id}?type=invoice${isAutoPrint}`;
      }
      
      router.push(url);
    }
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-background">
      <header className="shrink-0 flex flex-col md:flex-row items-center justify-between px-4 lg:px-10 py-3 md:py-5 border-b border-border bg-background relative z-50 gap-3 md:gap-0">
        <div className="flex items-center justify-between w-full md:w-auto min-w-0">
          <div className="flex items-center gap-3 md:gap-4 min-w-0">
            <div className="w-8 h-8 md:w-10 md:h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary shrink-0">
              <UserCircle className="w-5 h-5 md:w-6 md:h-6" />
            </div>
            <div className="min-w-0">
              <h1 className="text-lg md:text-xl font-medium tracking-tight text-foreground leading-none mb-0.5 md:mb-1 truncate">
                {cashier?.name || "Loading..."}
              </h1>
              <p className="text-xs md:text-sm text-muted-foreground leading-none truncate">
                @{cashier?.username || "..."}
              </p>
            </div>
          </div>
          
          {/* Mobile Right Actions */}
          <div className="flex md:hidden items-center gap-2">
            <button
              type="button"
              onClick={() => router.push("/dashboard/tutup-kasir")}
              className="flex items-center justify-center w-auto px-3 h-10 rounded-full border border-border bg-background hover:bg-muted/40 transition-colors text-xs font-medium text-muted-foreground"
              title="Kas Kasir"
            >
              <Calculator className="w-4 h-4 mr-1" />
              Kas
            </button>
            <button
              type="button"
              onClick={() => router.push("/dashboard/attendance/scan")}
              className="flex items-center justify-center w-auto px-3 h-10 rounded-full border border-border bg-background hover:bg-muted/40 transition-colors text-xs font-medium text-muted-foreground"
              title="Absen"
            >
              Absen
            </button>
            <button
              type="button"
              onClick={() => { setStockCheckOpen(true); stockCheckOpenRef.current = true; setScannedStockProduct(null); }}
              className="flex items-center justify-center w-10 h-10 rounded-full border border-border bg-background hover:bg-muted/40 transition-colors text-muted-foreground"
              title="Cek Stok"
            >
              <PackageSearch className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => setScannerOpen(true)}
              className="flex items-center justify-center w-10 h-10 rounded-full border border-border bg-background hover:bg-muted/40 transition-colors"
            >
              {scannerConnected ? (
                <Wifi className="w-4 h-4 text-emerald-500 absolute -top-1 -right-1" />
              ) : null}
              <Smartphone className="w-4 h-4 text-muted-foreground" />
            </button>
            <button
              type="button"
              id="logout-btn-mobile"
              onClick={handleLogout}
              className="flex items-center justify-center w-10 h-10 rounded-full border border-border bg-background hover:bg-destructive/10 hover:border-destructive/30 hover:text-destructive transition-colors text-muted-foreground"
              title="Keluar"
              aria-label="Keluar"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="w-full md:max-w-2xl lg:max-w-3xl md:mx-4 lg:mx-8 relative flex-1">
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground pointer-events-none" />
            <Input
              type="text"
              placeholder="Cari produk atau scan barcode..."
              className="pl-12 pr-12 h-14 text-lg bg-muted/30 focus-visible:bg-background transition-all rounded-full"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onFocus={() => setSearchOpen(true)}
              onBlur={() => setTimeout(() => setSearchOpen(false), 150)}
              autoFocus
            />
            {searchQuery && (
              <button
                type="button"
                className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground flex items-center justify-center p-1 rounded-full transition-colors"
                onClick={() => setSearchQuery("")}
              >
                <X className="w-5 h-5" />
              </button>
            )}
          </div>

          {(searchOpen || searchQuery.trim()) && (
            <div className="absolute top-full left-0 right-0 mt-3 bg-background border border-border rounded-2xl shadow-xl overflow-hidden z-50 max-h-[60vh] flex flex-col">
              <div className="overflow-y-auto p-2">
                {products.length === 0 ? (
                  <div className="p-8 text-center text-sm text-muted-foreground">Memuat produk...</div>
                ) : searchLoading && !serverResultsActive ? (
                  <div className="p-8 text-center text-sm text-muted-foreground">Mencari produk...</div>
                ) : filteredProducts.length === 0 ? (
                  <div className="p-8 text-center text-sm text-muted-foreground">
                    Produk <span className="font-medium text-foreground">&quot;{searchQuery}&quot;</span> tidak ditemukan
                  </div>
                ) : (
                  <div className="flex flex-col gap-1">
                    {filteredProducts.map((product, index) => {
                      const cat = product.kategori?.nama ?? "";
                      const merk = product.merk?.nama ?? "";
                      return (
                        <button
                          key={product.id}
                          type="button"
                          className="flex items-center justify-between gap-3 p-3 rounded-xl hover:bg-muted/50 transition-colors text-left group"
                          onClick={() => {
                            openAddItemDialog(product);
                          }}
                        >
                          {/* Nomor urut murni visual (bukan dari database), memudahkan kasir merujuk produk */}
                          <div className="w-8 h-8 rounded-full bg-muted text-muted-foreground flex items-center justify-center text-xs font-semibold tabular-nums shrink-0 group-hover:bg-primary/10 group-hover:text-primary transition-colors">
                            {index + 1}
                          </div>
                          <div className="flex flex-col gap-1 items-start min-w-0 flex-1">
                            <span className="text-base font-medium text-foreground group-hover:text-primary transition-colors">
                              <Highlight text={product.nama_produk} query={searchQuery} />
                            </span>
                            <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-muted-foreground">
                              {product.sku && (
                                <span className="tabular-nums font-medium">SKU: {product.sku}</span>
                              )}
                              {product.barcode && (
                                <span className="tabular-nums">BC: {product.barcode}</span>
                              )}
                              {merk && <span>{merk}</span>}
                              {cat && (
                                <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full w-fit ${categoryColors[cat] ?? "bg-muted text-muted-foreground"}`}>
                                  {cat}
                                </span>
                              )}
                              {product.nama_event_promo && (
                                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-red-100 text-red-600 border border-red-200">
                                  {product.nama_event_promo}
                                </span>
                              )}
                            </div>
                          </div>
                          <div className="flex flex-col items-end justify-center gap-1 pr-2 shrink-0">
                            <span className="text-xs tabular-nums text-muted-foreground">
                              Gudang: <span className="font-medium text-foreground">{product.stok_gudang ?? 0}</span>
                            </span>
                            {product.nama_event_promo && (
                              <span className="text-xs text-muted-foreground line-through tabular-nums -mb-1">
                                {formatIDR(product.harga_asli_satuan ?? product.harga_jual_satuan)}
                              </span>
                            )}
                            <span className="text-base tabular-nums text-foreground font-medium">
                              {formatIDR(product.harga_jual_satuan)}
                            </span>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        <div className="hidden md:flex items-center gap-3">
          <button
            type="button"
            onClick={() => router.push("/dashboard/tutup-kasir")}
            className="flex items-center gap-2 h-10 px-4 rounded-full border border-border bg-background hover:bg-muted/40 transition-colors text-sm font-medium text-muted-foreground"
          >
            <Calculator className="w-4 h-4" />
            Kas Kasir
          </button>
          <button
            type="button"
            onClick={() => router.push("/dashboard/attendance/scan")}
            className="flex items-center gap-2 h-10 px-4 rounded-full border border-border bg-background hover:bg-muted/40 transition-colors text-sm font-medium text-muted-foreground"
          >
            Absen
          </button>
          <button
            type="button"
            onClick={() => { setStockCheckOpen(true); stockCheckOpenRef.current = true; setScannedStockProduct(null); }}
            className="flex items-center gap-2 h-10 px-4 rounded-full border border-border bg-background hover:bg-muted/40 transition-colors text-sm font-medium text-muted-foreground"
          >
            <PackageSearch className="w-4 h-4" />
            Cek Stok
          </button>
          <button
            type="button"
            id="scanner-btn"
            onClick={() => setScannerOpen(true)}
            className="flex items-center gap-2 h-10 px-4 rounded-full border border-border bg-background hover:bg-muted/40 transition-colors text-sm font-medium"
          >
            {scannerConnected ? (
              <Wifi className="w-4 h-4 text-emerald-500" />
            ) : (
              <WifiOff className="w-4 h-4 text-muted-foreground" />
            )}
            <Smartphone className="w-4 h-4 text-muted-foreground" />
          </button>
          <Clock />
          <button
            type="button"
            id="logout-btn"
            onClick={handleLogout}
            className="flex items-center gap-2 h-10 px-4 rounded-full border border-border bg-background hover:bg-destructive/10 hover:border-destructive/30 hover:text-destructive transition-colors text-sm font-medium text-muted-foreground"
            aria-label="Keluar"
          >
            <LogOut className="w-4 h-4" />
            Keluar
          </button>
        </div>
      </header>

      <LowStockBanner />

      <div className="flex-1 flex flex-col lg:flex-row overflow-y-auto lg:overflow-hidden">
        <div className="flex-1 flex flex-col min-w-0 bg-background shrink-0">
          <div className="flex-1 lg:overflow-y-scroll overflow-x-hidden px-4 lg:px-10 py-4 lg:py-6">
            <Table>
              <TableHeader className="hidden md:table-header-group">
                <TableRow>
                  <TableHead className="px-0">Item</TableHead>
                  <TableHead className="text-center w-[140px]">Qty</TableHead>
                  <TableHead className="text-right w-[140px]">Harga</TableHead>
                  <TableHead className="text-right w-[160px]">Jumlah</TableHead>
                  <TableHead className="w-[52px] px-0"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {cart.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-16 block md:table-cell border-b-0">
                      <div className="flex flex-col items-center gap-3">
                        <Receipt className="w-12 h-12 text-muted-foreground/40" />
                        <p className="text-base">Keranjang kosong</p>
                        <p className="text-sm text-center">Cari produk untuk memulai transaksi</p>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  cart.map((item) => {
                    const isActive = activeCartItemId === item.id_produk;
                    return (
                      <TableRow
                        key={item.id_produk}
                        className={`border-b border-border/40 transition-colors group cursor-pointer flex flex-col md:table-row p-4 md:p-0 gap-2 md:gap-0 ${isActive
                          ? "bg-primary/5 hover:bg-primary/10"
                          : "hover:bg-muted/30"
                          }`}
                        onClick={() => setActiveCartItemId(item.id_produk)}
                      >
                        <TableCell className="px-0 truncate block md:table-cell p-0 md:p-4 border-none md:border-b">
                          <p className="font-medium text-foreground text-sm truncate">{item.nama_produk}</p>
                          <p className="text-xs text-muted-foreground mt-0.5 truncate">
                            {item.kategori}
                            <span className="ml-2 inline-flex items-center rounded-sm bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
                              {item.tipe_harga}
                            </span>
                            {item.satuan_jual && (
                              <span className="ml-2 inline-flex items-center rounded-sm bg-primary/10 text-primary px-1.5 py-0.5 text-[10px] font-medium">
                                {item.satuan_jual}
                              </span>
                            )}
                            {item.diskon_item > 0 && (
                              <span className="text-destructive ml-2 font-medium">- {formatIDR(item.diskon_item)}</span>
                            )}
                          </p>
                        </TableCell>
                        <TableCell className="block md:table-cell p-0 md:p-4 border-none md:border-b mt-2 md:mt-0">
                          <div className="flex items-center justify-between md:justify-center w-full">
                            <div className="flex items-center gap-4">
                              <Button
                                variant="outline"
                                size="icon"
                                type="button"
                                className="w-11 h-11 md:w-9 md:h-9 rounded-full border-border hover:bg-background shadow-sm transition-all"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  updateQty(item.id_produk, -1);
                                }}
                              >
                                <Minus className="w-3.5 h-3.5" />
                              </Button>
                              <span className="w-8 text-center tabular-nums text-lg font-medium">{item.qty_satuan}</span>
                              <Button
                                variant="outline"
                                size="icon"
                                type="button"
                                className="w-11 h-11 md:w-9 md:h-9 rounded-full border-border hover:bg-background shadow-sm transition-all"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  updateQty(item.id_produk, 1);
                                }}
                              >
                                <Plus className="w-3.5 h-3.5" />
                              </Button>
                            </div>
                            
                            {/* Mobile Jumlah & Delete */}
                            <div className="flex md:hidden items-center gap-3">
                              <span className="font-medium text-base tabular-nums">{formatIDR((item.harga_jual - item.diskon_item) * item.qty_satuan)}</span>
                              <Button
                                variant="ghost"
                                size="icon"
                                type="button"
                                className="w-11 h-11 text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  removeItem(item.id_produk);
                                }}
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="text-right hidden md:table-cell">
                          {formatIDR(item.harga_jual)}
                        </TableCell>
                        <TableCell className="text-right hidden md:table-cell">
                          {formatIDR((item.harga_jual - item.diskon_item) * item.qty_satuan)}
                        </TableCell>
                        <TableCell className="px-0 text-right hidden md:table-cell">
                          <Button
                            variant="ghost"
                            size="icon"
                            type="button"
                            className="w-9 h-9 text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                            onClick={(e) => {
                              e.stopPropagation();
                              removeItem(item.id_produk);
                            }}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>

          <div className="shrink-0 px-4 lg:px-10 py-4 border-t border-border flex justify-between items-center bg-background min-h-[69px] sticky bottom-0 z-10 lg:static">
            <span className="text-sm font-medium text-muted-foreground uppercase tracking-widest">Total Item</span>
            <span className="text-xl font-light tabular-nums text-foreground">
              {cart.reduce((sum, item) => sum + item.qty_satuan, 0)}
            </span>
          </div>
        </div>

        <div className="w-full lg:w-[400px] xl:w-[480px] shrink-0 bg-muted/20 border-t lg:border-t-0 lg:border-l border-border flex flex-col lg:overflow-hidden h-auto lg:h-full">
          <div className="px-4 lg:px-10 pt-6 lg:pt-8 pb-4 border-b border-border space-y-4">
            <div>
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-medium text-muted-foreground uppercase tracking-widest">Pelanggan</span>
                <div className="flex items-center gap-2">
                  {selectedCustomer && selectedCustomer.point > 0 && (
                    <span className="flex items-center gap-1 text-[11px] font-semibold text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full">
                      <Award className="w-3 h-3" />
                      {selectedCustomer.point} Poin
                    </span>
                  )}
                  <button
                    type="button"
                    className="text-xs text-muted-foreground hover:text-primary flex items-center gap-1"
                    onClick={() => { setMemberSearchOpen(true); setMemberSearchQuery(""); setMemberSearchResult(null); }}
                  >
                    <Search className="w-3.5 h-3.5" />
                    <span>Cari Member</span>
                  </button>
                  {selectedCustomer && (
                    <button
                      type="button"
                      className="text-xs text-muted-foreground hover:text-foreground"
                      onClick={() => setSelectedCustomer(null)}
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>
              <div className="relative">
                <select value={selectedCustomer?.id ?? ""}
                  className="appearance-none flex h-10 w-full min-w-0 rounded-md border border-input bg-background px-3 py-2 text-[15px] shadow-sm transition-colors outline-none focus-visible:border-primary focus-visible:ring-1 focus-visible:ring-primary/20 disabled:opacity-50"
                  onChange={(e) => {
                    const id = Number(e.target.value);
                    const c = customers.find((c) => c.id === id);
                    setSelectedCustomer(c ?? null);
                  }}
                >
                  <option value="">Umum (tanpa pelanggan)</option>
                  {customers.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.nama_pelanggan}
                    </option>
                  ))}
                </select>
                <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
              </div>
            </div>
            <div>
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-medium text-muted-foreground uppercase tracking-widest">Pembayaran</span>
              </div>
              <div className="relative">
                <select value={selectedPayment}
                  className="appearance-none flex h-10 w-full min-w-0 rounded-md border border-input bg-background px-3 py-2 text-[15px] shadow-sm transition-colors outline-none focus-visible:border-primary focus-visible:ring-1 focus-visible:ring-primary/20 disabled:opacity-50"
                  onChange={(e) => setSelectedPayment(Number(e.target.value))}
                >
                  {paymentMethods.map((pm) => (
                    <option key={pm.id} value={pm.id}>
                      {pm.nama}
                    </option>
                  ))}
                </select>
                <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
              </div>
            </div>
          </div>

          <div className="flex-1 min-h-0 lg:overflow-y-auto px-4 lg:px-10 py-6 flex flex-col">
            <div className="lg:my-auto flex flex-col">
              <div className="bg-background rounded-lg border-2 border-primary/20 h-20 shrink-0 flex items-center justify-end px-6 mb-6 shadow-sm">
                <span className="text-4xl font-light tabular-nums text-foreground tracking-tight">
                  {numpadValue || "0"}
                </span>
              </div>

              <div className="grid grid-cols-3 gap-3">
                {["7", "8", "9", "4", "5", "6", "1", "2", "3"].map((num) => (
                  <button
                    key={num}
                    type="button"
                    className="h-14 text-2xl font-light rounded-lg bg-background border border-border hover:bg-muted/80 hover:border-muted-foreground/30 transition-colors shadow-sm select-none"
                    onClick={() => numpadPress(num)}
                  >
                    {num}
                  </button>
                ))}
                <button
                  type="button"
                  className="h-14 text-2xl font-light rounded-lg bg-background border border-border hover:bg-muted/80 transition-colors shadow-sm select-none"
                  onClick={() => numpadPress(".")}
                >
                  .
                </button>
                <button
                  type="button"
                  className="h-14 text-2xl font-light rounded-lg bg-background border border-border hover:bg-muted/80 transition-colors shadow-sm select-none"
                  onClick={() => numpadPress("0")}
                >
                  0
                </button>
                <button
                  type="button"
                  className="h-14 rounded-lg bg-background border border-border hover:bg-destructive/10 hover:text-destructive hover:border-destructive/30 transition-colors shadow-sm text-muted-foreground flex items-center justify-center select-none"
                  onClick={() => numpadPress("delete")}
                >
                  <Delete className="w-6 h-6" />
                </button>
              </div>

              <div className="grid grid-cols-1 gap-3 mt-4">
                <button
                  type="button"
                  className="h-12 rounded-lg font-medium bg-background border border-border hover:bg-primary/5 hover:border-primary/30 transition-colors shadow-sm text-sm text-foreground disabled:opacity-40 disabled:cursor-not-allowed"
                  onClick={applyNumpadAsQty}
                  disabled={activeCartItemId === null || !numpadValue}
                >
                  Set Qty
                </button>
              </div>
              {(() => {
                const activeItem = cart.find((i) => i.id_produk === activeCartItemId);
                const activeProduct = products.find((p) => p.id === activeCartItemId);
                if (activeItem && activeProduct?.jual_satuan) {
                  const baseName = activeProduct.satuan?.nama ?? "Stok";
                  const bigName = activeProduct.jual_satuan;
                  const isBig = activeItem.satuan_jual !== null
                    && activeItem.satuan_jual.toUpperCase() === bigName.toUpperCase();
                  return (
                    <div className="grid grid-cols-2 gap-2 mt-3">
                      <button
                        type="button"
                        className={`h-10 rounded-lg font-medium border transition-colors text-[10px] uppercase tracking-wider disabled:opacity-40 disabled:cursor-not-allowed ${
                          !isBig
                            ? "bg-primary text-primary-foreground border-primary"
                            : "bg-background text-muted-foreground border-border hover:bg-muted"
                        }`}
                        onClick={() => setSellUnit(null)}
                      >
                        {baseName}
                      </button>
                      <button
                        type="button"
                        className={`h-10 rounded-lg font-medium border transition-colors text-[10px] uppercase tracking-wider disabled:opacity-40 disabled:cursor-not-allowed ${
                          isBig
                            ? "bg-primary text-primary-foreground border-primary"
                            : "bg-background text-muted-foreground border-border hover:bg-muted"
                        }`}
                        onClick={() => setSellUnit(bigName)}
                      >
                        {bigName}
                      </button>
                    </div>
                  );
                }
                return null;
              })()}
              <div className="grid grid-cols-3 gap-2 mt-3">
                <button
                  type="button"
                  className="h-10 rounded-lg font-medium bg-background border border-border hover:bg-primary/5 transition-colors text-[10px] uppercase tracking-wider text-foreground disabled:opacity-40 disabled:cursor-not-allowed"
                  onClick={() => setPriceType("Satuan")}
                  disabled={activeCartItemId === null}
                >
                  Satuan
                </button>
                <button
                  type="button"
                  className="h-10 rounded-lg font-medium bg-background border border-border hover:bg-primary/5 transition-colors text-[10px] uppercase tracking-wider text-foreground disabled:opacity-40 disabled:cursor-not-allowed"
                  onClick={() => setPriceType("Grosir")}
                  disabled={activeCartItemId === null}
                >
                  Grosir
                </button>
                <button
                  type="button"
                  className="h-10 rounded-lg font-medium bg-background border border-border hover:bg-primary/5 transition-colors text-[10px] uppercase tracking-wider text-foreground disabled:opacity-40 disabled:cursor-not-allowed"
                  onClick={() => setPriceType("Promo")}
                  disabled={activeCartItemId === null}
                >
                  Promo
                </button>
              </div>
              {activeCartItemId === null && numpadValue && (
                <p className="text-xs text-muted-foreground mt-2 text-center">
                  Pilih item di keranjang untuk mengatur qty
                </p>
              )}
              {cart.length > 0 && (
                <button
                  type="button"
                  className="w-full mt-3 h-12 rounded-lg text-sm text-muted-foreground bg-background border border-border hover:text-destructive hover:border-destructive/30 transition-colors flex items-center justify-center gap-2"
                  onClick={clearCart}
                >
                  <Trash2 className="w-4 h-4" />
                  Batal
                </button>
              )}
            </div>
          </div>

          <div className="px-4 lg:px-10 pb-6 lg:pb-8 pt-6 shrink-0 border-t border-border bg-background shadow-[0_-4px_24px_-12px_rgba(0,0,0,0.05)] relative z-10 sticky bottom-0 lg:static">
            {checkoutError && (
              <div className="mb-4 p-3 rounded-lg bg-destructive/10 text-destructive text-sm">
                {checkoutError}
              </div>
            )}

            <div className="flex flex-col gap-3 mb-6">
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Subtotal</span>
                <span className="text-sm tabular-nums font-medium text-foreground">{formatIDR(subtotal)}</span>
              </div>
              {taxRate > 0 && (
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Pajak ({taxRate}%)</span>
                  <span className="text-sm tabular-nums font-medium text-foreground">{formatIDR(tax)}</span>
                </div>
              )}
              {numpadAmount > 0 && (
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">{isDP ? "DP" : "Dibayar"}</span>
                  <span className="text-sm tabular-nums font-medium text-foreground">{formatIDR(numpadAmount)}</span>
                </div>
              )}
              {change > 0 && !isDP && (
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Kembali</span>
                  <span className="text-sm tabular-nums font-medium text-emerald-600">{formatIDR(change)}</span>
                </div>
              )}
              {isDP && (
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Sisa</span>
                  <span className="text-sm tabular-nums font-medium text-destructive">{formatIDR(sisaDP)}</span>
                </div>
              )}
            </div>

            <div className="flex justify-between items-end mb-6">
              <p className="text-sm font-medium text-muted-foreground uppercase tracking-widest pb-1">Total</p>
              <div className="text-3xl leading-none font-light tracking-tight tabular-nums text-foreground">
                {formatIDR(total)}
              </div>
            </div>

            {isBayarKurang && (
              <div className="flex items-center justify-between gap-2 mb-3 px-4 py-2.5 rounded-xl bg-destructive/10 border border-destructive/20">
                <span className="text-sm text-destructive font-medium">Jumlah bayar kurang</span>
                <span className="text-sm tabular-nums font-semibold text-destructive">
                  - {formatIDR(total - numpadAmount)}
                </span>
              </div>
            )}
            {isBayarKosong && (
              <div className="flex items-center justify-center gap-2 mb-3 px-4 py-2.5 rounded-xl bg-amber-50 border border-amber-200">
                <span className="text-sm text-amber-700 font-medium">Masukkan jumlah bayar terlebih dahulu</span>
              </div>
            )}

            <Button
              className="w-full h-16 rounded-full bg-primary hover:bg-primary/90 text-primary-foreground text-xl font-medium shadow-lg transition-transform active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed"
              type="button"
              disabled={cart.length === 0 || checkoutLoading || (!isDP && numpadAmount < total)}
              onClick={handleCheckout}
            >
              {checkoutLoading ? (
                <span className="flex items-center gap-2">
                  <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Memproses
                </span>
              ) : (
                <span className="flex items-center gap-2">
                  Bayar
                </span>
              )}
            </Button>
          </div>
        </div>
      </div>

      {/* ── Scanner QR Modal ─────────────────────────────────────────────── */}
      {scannerOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-overlay/40 backdrop-blur-sm animate-in fade-in duration-200"
          onClick={() => setScannerOpen(false)}
        >
          <div
            className="relative bg-background border border-border shadow-[0_8px_24px_rgba(0,55,112,0.08),0_2px_6px_rgba(0,55,112,0.04)] rounded-[12px] p-6 sm:p-8 flex flex-col items-center gap-5 sm:gap-6 w-[340px] max-w-[calc(100vw-32px)] animate-in zoom-in-95 duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={() => setScannerOpen(false)}
              className="absolute top-4 right-4 text-muted-foreground hover:text-foreground transition-colors"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex flex-col items-center gap-1 text-center">
              <p className="text-base font-semibold text-foreground">Scan dengan HP</p>
              <p className="text-sm text-muted-foreground">Buka kamera HP dan scan QR ini</p>
            </div>

            <div className="bg-white p-3 rounded-xl shadow-inner">
              {qrDataUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={qrDataUrl} alt="Scanner QR code" width={220} height={220} className="w-full max-w-[220px] h-auto" />
              ) : (
                <div className="w-full max-w-[220px] aspect-square animate-pulse bg-muted rounded-lg" />
              )}
            </div>

            <div className="flex items-center gap-2 text-sm">
              <span
                className={`w-2 h-2 rounded-full ${scannerConnected ? "bg-emerald-500 animate-pulse" : "bg-muted-foreground"}`}
              />
              <span className="text-muted-foreground">
                {scannerConnected ? "Terhubung" : "Menunggu koneksi..."}
              </span>
            </div>

            <p className="text-xs text-muted-foreground text-center leading-relaxed">
              Gunakan Chrome di Android · Sesi aktif selama halaman ini terbuka
            </p>
          </div>
        </div>
      )}

      {/* ── Check Stock Modal ─────────────────────────────────────────────── */}
      {stockCheckOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-overlay/40 backdrop-blur-sm animate-in fade-in duration-200"
          onClick={() => { setStockCheckOpen(false); stockCheckOpenRef.current = false; }}
        >
          <div
            className="relative bg-background border border-border shadow-xl rounded-[12px] p-6 flex flex-col items-center gap-4 w-[400px] max-w-[calc(100vw-32px)] animate-in zoom-in-95 duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={() => { setStockCheckOpen(false); stockCheckOpenRef.current = false; }}
              className="absolute top-4 right-4 text-muted-foreground hover:text-foreground transition-colors"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex flex-col items-center gap-1 text-center w-full">
              <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center text-primary mb-2">
                <PackageSearch className="w-6 h-6" />
              </div>
              <p className="text-lg font-semibold text-foreground">Cek Stok Produk</p>
              <p className="text-sm text-muted-foreground">Scan barcode produk untuk melihat sisa stok</p>
            </div>

            <div className="w-full mt-2 min-h-[160px] flex flex-col items-center justify-center border-2 border-dashed border-border rounded-xl p-6 bg-muted/20">
              {scannedStockProduct ? (
                <div className="text-center w-full animate-in fade-in zoom-in-95 duration-300">
                  <div className="inline-block px-3 py-1 bg-muted rounded-full text-xs font-medium text-muted-foreground mb-3">
                    {scannedStockProduct.kategori && typeof scannedStockProduct.kategori === "object"
                      ? scannedStockProduct.kategori.nama
                      : scannedStockProduct.kategori || "Umum"}
                  </div>
                  <h3 className="text-lg font-medium text-foreground mb-1 leading-tight line-clamp-2">{scannedStockProduct.nama_produk}</h3>
                  <p className="text-xs text-muted-foreground mb-4">Barcode: {scannedStockProduct.barcode}</p>
                  
                  <div className="flex gap-3">
                    <div className="flex-1 bg-background rounded-lg border border-border p-3 shadow-sm">
                      <p className="text-xs text-muted-foreground mb-1">Stok Display</p>
                      <div className="text-2xl font-semibold tabular-nums text-primary tracking-tight">
                        {scannedStockProduct.stok}
                      </div>
                    </div>
                    <div className="flex-1 bg-background rounded-lg border border-border p-3 shadow-sm">
                      <p className="text-xs text-muted-foreground mb-1">Stok Gudang</p>
                      <div className="text-2xl font-semibold tabular-nums text-muted-foreground tracking-tight">
                        {scannedStockProduct.stok_gudang ?? 0}
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="text-center text-muted-foreground flex flex-col items-center gap-3 opacity-60">
                  <ScanLine className="w-10 h-10 animate-pulse" />
                  <p className="text-sm">Menunggu scan barcode...</p>
                </div>
              )}
            </div>
            
            {scannedStockProduct && (
              <button
                type="button"
                onClick={() => setScannedStockProduct(null)}
                className="w-full mt-2 h-10 rounded-lg border border-border bg-background hover:bg-muted/40 transition-colors text-sm font-medium text-muted-foreground"
              >
                Scan Produk Lain
              </button>
            )}
          </div>
        </div>
      )}

      {/* ── Member Search Modal ──────────────────────────────────────────── */}
      {memberSearchOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-in fade-in duration-200"
          onClick={() => { setMemberSearchOpen(false); setMemberSearchResult(null); }}
        >
          <div
            className="relative bg-background border border-border shadow-xl rounded-xl p-6 flex flex-col gap-5 w-[400px] max-w-[calc(100vw-32px)] animate-in zoom-in-95 duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={() => { setMemberSearchOpen(false); setMemberSearchResult(null); }}
              className="absolute top-4 right-4 text-muted-foreground hover:text-foreground transition-colors"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex flex-col items-center gap-1.5 text-center pt-2">
              <div className="w-11 h-11 rounded-full bg-primary/10 flex items-center justify-center text-primary">
                <UserCircle className="w-5 h-5" />
              </div>
              <p className="text-base font-semibold text-foreground tracking-tight">Cari Member</p>
              <p className="text-xs text-muted-foreground leading-relaxed">Masukkan nomor HP untuk mencari atau mendaftarkan member</p>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (!memberSearchQuery.trim() || memberSearchLoading) return;
                setMemberSearchLoading(true);
                setMemberSearchResult(null);
                fetch(`/api/pos/member-search?no_hp=${encodeURIComponent(memberSearchQuery.trim())}`)
                  .then((r) => r.json())
                  .then((json) => setMemberSearchResult(json.found ? json.customer : "not_found"))
                  .catch(() => setMemberSearchResult("not_found"))
                  .finally(() => setMemberSearchLoading(false));
              }}
              className="flex gap-2"
            >
              <input
                type="tel"
                autoFocus
                placeholder="Nomor HP"
                value={memberSearchQuery}
                onChange={(e) => setMemberSearchQuery(e.target.value)}
                className="flex h-10 w-full min-w-0 rounded-md border border-input bg-background px-3 py-2 text-[15px] shadow-sm transition-colors outline-none focus-visible:border-primary focus-visible:ring-1 focus-visible:ring-primary/20"
              />
              <button
                type="submit"
                disabled={!memberSearchQuery.trim() || memberSearchLoading}
                className="h-10 px-5 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-40 shrink-0"
              >
                {memberSearchLoading ? (
                  <span className="flex items-center gap-2">
                    <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  </span>
                ) : (
                  "Cari"
                )}
              </button>
            </form>

            {memberSearchResult === "not_found" && (
              <div className="flex flex-col items-center gap-3 p-5 border border-border rounded-xl bg-muted/20">
                <Phone className="w-8 h-8 text-muted-foreground/50" />
                <p className="text-sm text-muted-foreground text-center leading-relaxed">
                  Nomor <span className="font-medium text-foreground">{memberSearchQuery}</span> belum terdaftar sebagai member
                </p>
                <button
                  type="button"
                  onClick={() => {
                    setMemberSearchOpen(false);
                    setMemberSearchResult(null);
                    setMemberRegName("");
                    setMemberRegPhone(memberSearchQuery);
                    setMemberRegError("");
                    setMemberRegOpen(true);
                  }}
                  className="inline-flex items-center gap-2 h-10 px-5 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors"
                >
                  <UserPlus className="w-4 h-4" />
                  Daftarkan Member Baru
                </button>
              </div>
            )}

            {memberSearchResult && memberSearchResult !== "not_found" && (
              <div className="border border-border rounded-xl overflow-hidden">
                <div className="p-4 bg-muted/20">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary shrink-0">
                      <UserCircle className="w-5 h-5" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-foreground truncate">{memberSearchResult.nama_pelanggan}</p>
                      <p className="text-xs text-muted-foreground tabular-nums">{memberSearchResult.no_hp || "-"}</p>
                    </div>
                  </div>
                </div>
                <div className="flex items-center justify-between px-4 py-3 border-t border-border">
                  <span className="text-xs text-muted-foreground">Total Poin</span>
                  <span className="text-base font-semibold tabular-nums flex items-center gap-1.5">
                    <Award className="w-4 h-4 text-primary" />
                    {memberSearchResult.point}
                  </span>
                </div>
                <div className="px-4 pb-4">
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedCustomer(memberSearchResult);
                      setMemberSearchOpen(false);
                      setMemberSearchResult(null);
                    }}
                    className="w-full h-10 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors"
                  >
                    Pilih Member
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Member Registration Modal ─────────────────────────────────────── */}
      {memberRegOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-in fade-in duration-200"
          onClick={() => setMemberRegOpen(false)}
        >
          <div
            className="relative bg-background border border-border shadow-xl rounded-xl p-6 flex flex-col gap-5 w-[400px] max-w-[calc(100vw-32px)] animate-in zoom-in-95 duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={() => setMemberRegOpen(false)}
              className="absolute top-4 right-4 text-muted-foreground hover:text-foreground transition-colors"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex flex-col items-center gap-1.5 text-center pt-2">
              <div className="w-11 h-11 rounded-full bg-primary/10 flex items-center justify-center text-primary">
                <UserPlus className="w-5 h-5" />
              </div>
              <p className="text-base font-semibold text-foreground tracking-tight">Daftar Member Baru</p>
              <p className="text-xs text-muted-foreground leading-relaxed">Lengkapi data berikut untuk mendaftarkan pelanggan sebagai member</p>
            </div>

            <form
              onSubmit={async (e) => {
                e.preventDefault();
                if (!memberRegName.trim() || memberRegPhone.trim().length < 10 || memberRegLoading) return;
                setMemberRegLoading(true);
                setMemberRegError("");
                try {
                  const res = await fetch("/api/pos/member-register", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                      nama_pelanggan: memberRegName.trim(),
                      no_hp: memberRegPhone.trim(),
                    }),
                  });
                  const json = await res.json();
                  if (!res.ok) {
                    setMemberRegError(json.error || "Gagal mendaftarkan member");
                    return;
                  }
                  setSelectedCustomer(json);
                  setCustomers([...usePosStore.getState().customers, json]);
                  setMemberRegOpen(false);
                  setMemberRegName("");
                  setMemberRegPhone("");
                  setMemberRegError("");
                } catch {
                  setMemberRegError("Gagal terhubung ke server");
                } finally {
                  setMemberRegLoading(false);
                }
              }}
              className="space-y-4"
            >
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-foreground">Nama Pelanggan</label>
                <input
                  type="text"
                  autoFocus
                  placeholder="Nama lengkap"
                  value={memberRegName}
                  onChange={(e) => setMemberRegName(e.target.value)}
                  className="flex h-10 w-full min-w-0 rounded-md border border-input bg-background px-3 py-2 text-[15px] shadow-sm transition-colors outline-none focus-visible:border-primary focus-visible:ring-1 focus-visible:ring-primary/20"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-foreground">Nomor HP</label>
                <input
                  type="tel"
                  placeholder="Nomor HP"
                  value={memberRegPhone}
                  onChange={(e) => setMemberRegPhone(e.target.value)}
                  className="flex h-10 w-full min-w-0 rounded-md border border-input bg-background px-3 py-2 text-[15px] shadow-sm transition-colors outline-none focus-visible:border-primary focus-visible:ring-1 focus-visible:ring-primary/20"
                />
              </div>

              {memberRegError && (
                <div className="p-3 rounded-lg bg-destructive/10 text-destructive text-sm leading-relaxed">
                  {memberRegError}
                </div>
              )}

              <button
                type="submit"
                disabled={!memberRegName.trim() || memberRegPhone.trim().length < 10 || memberRegLoading}
                className="w-full h-11 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center"
              >
                {memberRegLoading ? (
                  <span className="flex items-center gap-2">
                    <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Mendaftarkan...
                  </span>
                ) : (
                  <span className="flex items-center gap-2">
                    <UserPlus className="w-4 h-4" />
                    Daftar & Pilih
                  </span>
                )}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* ── Add Item Dialog (4A: choose unit on search click) ──────────────── */}
      {addItemOpen && addItemProduct && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-in fade-in duration-200"
          onClick={() => { setAddItemOpen(false); setAddItemProduct(null); }}
        >
          <div
            className="relative bg-background border border-border shadow-xl rounded-xl p-6 flex flex-col gap-5 w-[380px] max-w-[calc(100vw-32px)] animate-in zoom-in-95 duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={() => { setAddItemOpen(false); setAddItemProduct(null); }}
              className="absolute top-4 right-4 text-muted-foreground hover:text-foreground transition-colors"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex flex-col gap-1 pt-1">
              <p className="text-base font-semibold text-foreground tracking-tight">{addItemProduct.nama_produk}</p>
              <p className="text-xs text-muted-foreground">{addItemProduct.kategori?.nama ?? ""}</p>
            </div>

            {/* Unit selector */}
            <div className="flex flex-col gap-1.5">
              <label className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Satuan</label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  className={`h-11 rounded-lg font-medium border transition-colors text-sm ${
                    addItemSatuan === null
                      ? "bg-primary text-primary-foreground border-primary"
                      : "bg-background text-muted-foreground border-border hover:bg-muted"
                  }`}
                  onClick={() => setAddItemSatuan(null)}
                >
                  {addItemProduct.satuan?.nama ?? "Stok"}
                </button>
                {addItemProduct.jual_satuan && (
                  <button
                    type="button"
                    className={`h-11 rounded-lg font-medium border transition-colors text-sm ${
                      addItemSatuan !== null
                        ? "bg-primary text-primary-foreground border-primary"
                        : "bg-background text-muted-foreground border-border hover:bg-muted"
                    }`}
                    onClick={() => setAddItemSatuan(addItemProduct!.jual_satuan)}
                  >
                    {addItemProduct.jual_satuan}
                  </button>
                )}
              </div>
            </div>

            {/* Price preview */}
            <div className="flex items-center justify-between bg-muted/40 rounded-lg px-4 py-3">
              <span className="text-xs text-muted-foreground">Harga</span>
              <span className="text-sm font-medium tabular-nums text-foreground">
                {(() => {
                  const isBig = addItemSatuan !== null
                    && addItemProduct.jual_satuan !== null
                    && addItemSatuan.toUpperCase() === addItemProduct.jual_satuan.toUpperCase();
                  if (isBig) return formatIDR(addItemProduct.harga_jual_besar_satuan ?? 0);
                  return formatIDR(addItemProduct.harga_jual_satuan);
                })()}
              </span>
            </div>

            {/* Qty */}
            <div className="flex flex-col gap-1.5">
              <label className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Jumlah</label>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  className="w-10 h-10 rounded-full border border-border bg-background hover:bg-muted/80 flex items-center justify-center text-lg"
                  onClick={() => setAddItemQty((q) => Math.max(1, q - 1))}
                >
                  -
                </button>
                <span className="w-12 text-center text-lg font-medium tabular-nums">{addItemQty}</span>
                <button
                  type="button"
                  className="w-10 h-10 rounded-full border border-border bg-background hover:bg-muted/80 flex items-center justify-center text-lg"
                  onClick={() => setAddItemQty((q) => q + 1)}
                >
                  +
                </button>
              </div>
            </div>

            {/* Total */}
            <div className="flex items-center justify-between border-t border-border pt-4">
              <span className="text-sm font-medium text-muted-foreground">Jumlah</span>
              <span className="text-lg font-medium tabular-nums text-foreground">
                {(() => {
                  const isBig = addItemSatuan !== null
                    && addItemProduct.jual_satuan !== null
                    && addItemSatuan.toUpperCase() === addItemProduct.jual_satuan.toUpperCase();
                  const price = isBig
                    ? (addItemProduct.harga_jual_besar_satuan ?? 0)
                    : addItemProduct.harga_jual_satuan;
                  return formatIDR(price * addItemQty);
                })()}
              </span>
            </div>

            <button
              type="button"
              className="w-full h-12 rounded-full bg-primary hover:bg-primary/90 text-primary-foreground font-medium shadow-sm transition-colors"
              onClick={handleAddItemConfirm}
            >
              Tambah ke Keranjang
            </button>
          </div>
        </div>
      )}

      {/* ── Scan toast stack ─────────────────────────────────────────────── */}
      <div className="fixed bottom-6 left-1/2 -translate-x-1/2 flex flex-col gap-2 z-50 pointer-events-none">
        {scanToasts.map((t) => (
          <div
            key={t.id}
            className={`flex items-center gap-3 px-4 py-3 rounded-full shadow-lg border text-sm font-medium animate-in slide-in-from-bottom-2 duration-200 max-w-[calc(100vw-32px)] ${t.ok
              ? "bg-background border-emerald-200 text-emerald-700"
              : "bg-background border-destructive/20 text-destructive"
              }`}
          >
            {t.ok ? <Check className="w-4 h-4 shrink-0" /> : <X className="w-4 h-4 shrink-0" />}
            <span className="truncate">{t.text}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
