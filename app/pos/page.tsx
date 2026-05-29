"use client";

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
import { usePosStore } from "@/stores/pos-store";

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

export default function PosPage() {
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
  const checkout = usePosStore((s) => s.checkout);
  const clearCart = usePosStore((s) => s.clearCart);

  // ── User state ─────────────────────────────────────────────────────────────
  useEffect(() => {
    const fetchUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const role = user.user_metadata?.role;
        if (role === "ADMIN" || role === "OWNER") {
          router.push("/dashboard");
          return;
        }

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

  const [currentTime, setCurrentTime] = useState(new Date());
  const [taxRate, setTaxRate] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // ── Phone scanner state ───────────────────────────────────────────────────
  const [sessionId] = useState(() => crypto.randomUUID());
  const [scannerOpen, setScannerOpen] = useState(false);
  const [scannerConnected, setScannerConnected] = useState(false);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [scanToasts, setScanToasts] = useState<ScanToast[]>([]);
  const toastIdRef = useRef(0);

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
          addToCart(product);
          pushToast(product.nama_produk, true);
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
        supabase.from("pengaturan").select("pajak_persen").eq("id", 1).single()
      ]);
      setProducts(await prodRes.json());
      setCustomers(await custRes.json());
      setPaymentMethods(await pmRes.json());
      
      if (settingsRes.data) {
        setTaxRate(settingsRes.data.pajak_persen || 0);
      }
    };
    load();
  }, [setProducts, setCustomers, setPaymentMethods, supabase]);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
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
  }, [numpadPress]);

  const filteredProducts = useMemo(() => {
    if (!searchQuery.trim()) return products;
    const q = searchQuery.toLowerCase();
    return products.filter(
      (p) =>
        p.nama_produk.toLowerCase().includes(q) ||
        p.kategori?.nama?.toLowerCase().includes(q) ||
        String(p.id).includes(q) ||
        (p.barcode && p.barcode.includes(q))
    );
  }, [products, searchQuery]);

  const subtotal = cart.reduce((sum, item) => sum + (item.harga_jual - item.diskon_item) * item.qty, 0);
  const tax = subtotal * (taxRate / 100);
  const total = subtotal + tax;
  const numpadAmount = numpadValue
    ? Math.round(parseFloat(numpadValue))
    : 0;
  
  const selectedPaymentMethod = paymentMethods.find(pm => pm.id === selectedPayment);
  const isDP = selectedPaymentMethod?.nama.toUpperCase() === "DP";
  
  const change = !isDP ? Math.max(0, numpadAmount - total) : 0;
  const sisaDP = isDP ? Math.max(0, total - numpadAmount) : 0;

  const handleCheckout = async () => {
    const result = await checkout();
    if (result.success && result.id) {
      setNumpadValue("");
      router.push(`/pos/invoice/${result.id}`);
    }
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-background">
      <header className="shrink-0 flex flex-col md:flex-row items-center justify-between px-4 lg:px-10 py-3 md:py-5 border-b border-border bg-background relative z-50 gap-3 md:gap-0">
        <div className="flex items-center justify-between w-full md:w-auto">
          <div className="flex items-center gap-3 md:gap-4">
            <div className="w-8 h-8 md:w-10 md:h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary">
              <UserCircle className="w-5 h-5 md:w-6 md:h-6" />
            </div>
            <div>
              <h1 className="text-lg md:text-xl font-medium tracking-tight text-foreground leading-none mb-0.5 md:mb-1">
                {cashier?.name || "Loading..."}
              </h1>
              <p className="text-xs md:text-sm text-muted-foreground leading-none">
                @{cashier?.username || "..."}
              </p>
            </div>
          </div>
          
          {/* Mobile Right Actions */}
          <div className="flex md:hidden items-center gap-2">
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

        <div className="w-full md:max-w-xl lg:max-w-2xl md:mx-4 lg:mx-8 relative flex-1">
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground pointer-events-none" />
            <Input
              type="text"
              placeholder="Cari produk atau scan barcode..."
              className="pl-12 pr-12 h-14 text-lg bg-muted/30 focus-visible:bg-background transition-all rounded-full"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
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

          {searchQuery.trim() && (
            <div className="absolute top-full left-0 right-0 mt-3 bg-background border border-border rounded-2xl shadow-xl overflow-hidden z-50 max-h-[60vh] flex flex-col">
              <div className="overflow-y-auto p-2">
                {products.length === 0 ? (
                  <div className="p-8 text-center text-sm text-muted-foreground">Memuat produk...</div>
                ) : filteredProducts.length === 0 ? (
                  <div className="p-8 text-center text-sm text-muted-foreground">
                    Produk <span className="font-medium text-foreground">&quot;{searchQuery}&quot;</span> tidak ditemukan
                  </div>
                ) : (
                  <div className="flex flex-col gap-1">
                    {filteredProducts.slice(0, 20).map((product) => {
                      const cat = product.kategori?.nama ?? "";
                      const colorClass = categoryColors[cat] ?? "bg-muted text-muted-foreground";
                      return (
                        <button
                          key={product.id}
                          type="button"
                          className="flex items-center justify-between p-3 rounded-xl hover:bg-muted/50 transition-colors text-left group"
                          onClick={() => {
                            addToCart(product);
                            setSearchQuery("");
                          }}
                        >
                          <div className="flex flex-col gap-1">
                            <span className="text-base font-medium text-foreground group-hover:text-primary transition-colors">
                              {product.nama_produk}
                            </span>
                            <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full w-fit ${colorClass}`}>
                              {cat}
                            </span>
                          </div>
                          <span className="text-base tabular-nums text-foreground font-medium pr-2">
                            {formatIDR(product.harga_jual_satuan)}
                          </span>
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
          <div className="w-24 text-right">
            <p className="text-xl font-light tracking-tight tabular-nums text-foreground">
              {currentTime.toLocaleTimeString("id-ID", { 
                hour: "2-digit", 
                minute: "2-digit",
                timeZone: "Asia/Jakarta"
              })}
            </p>
          </div>
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

      <div className="flex-1 flex flex-col lg:flex-row overflow-y-auto lg:overflow-hidden">
        <div className="flex-1 flex flex-col min-w-0 bg-background shrink-0">
          <div className="flex-1 lg:overflow-y-scroll overflow-x-hidden px-4 lg:px-10 py-4 lg:py-6">
            <Table>
              <TableHeader>
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
                    <TableCell colSpan={5} className="text-center py-16">
                      <div className="flex flex-col items-center gap-3">
                        <Receipt className="w-12 h-12 text-muted-foreground/40" />
                        <p className="text-base">Keranjang kosong</p>
                        <p className="text-sm">Cari produk untuk memulai transaksi</p>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  cart.map((item) => {
                    const isActive = activeCartItemId === item.id_produk;
                    return (
                      <TableRow
                        key={item.id_produk}
                        className={`border-b border-border/40 transition-colors group cursor-pointer ${isActive
                          ? "bg-primary/5 hover:bg-primary/10"
                          : "hover:bg-muted/30"
                          }`}
                        onClick={() => setActiveCartItemId(item.id_produk)}
                      >
                        <TableCell className="px-0 truncate">
                          <p className="font-medium text-foreground text-sm truncate">{item.nama_produk}</p>
                          <p className="text-xs text-muted-foreground mt-0.5 truncate">
                            {item.kategori}
                            <span className="ml-2 inline-flex items-center rounded-sm bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
                              {item.tipe_harga}
                            </span>
                            {item.diskon_item > 0 && (
                              <span className="text-destructive ml-2 font-medium">- {formatIDR(item.diskon_item)}</span>
                            )}
                          </p>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center justify-center gap-4">
                            <Button
                              variant="outline"
                              size="icon"
                              type="button"
                              className="w-9 h-9 rounded-full border-border hover:bg-background shadow-sm transition-all"
                              onClick={(e) => {
                                e.stopPropagation();
                                updateQty(item.id_produk, -1);
                              }}
                            >
                              <Minus className="w-3.5 h-3.5" />
                            </Button>
                            <span className="w-8 text-center tabular-nums text-lg font-medium">{item.qty}</span>
                            <Button
                              variant="outline"
                              size="icon"
                              type="button"
                              className="w-9 h-9 rounded-full border-border hover:bg-background shadow-sm transition-all"
                              onClick={(e) => {
                                e.stopPropagation();
                                updateQty(item.id_produk, 1);
                              }}
                            >
                              <Plus className="w-3.5 h-3.5" />
                            </Button>
                          </div>
                        </TableCell>
                        <TableCell className="text-right">
                          {formatIDR(item.harga_jual)}
                        </TableCell>
                        <TableCell className="text-right">
                          {formatIDR((item.harga_jual - item.diskon_item) * item.qty)}
                        </TableCell>
                        <TableCell className="px-0 text-right">
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
              {cart.reduce((sum, item) => sum + item.qty, 0)}
            </span>
          </div>
        </div>

        <div className="w-full lg:w-[400px] xl:w-[480px] shrink-0 bg-muted/20 border-t lg:border-t-0 lg:border-l border-border flex flex-col lg:overflow-hidden h-auto lg:h-full">
          <div className="px-4 lg:px-10 pt-6 lg:pt-8 pb-4 border-b border-border space-y-4">
            <div>
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-medium text-muted-foreground uppercase tracking-widest">Pelanggan</span>
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

            <Button
              className="w-full h-16 rounded-full bg-primary hover:bg-primary/90 text-primary-foreground text-xl font-medium shadow-lg transition-transform active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed"
              type="button"
              disabled={cart.length === 0 || checkoutLoading}
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
            className="relative bg-background border border-border shadow-[0_8px_24px_rgba(0,55,112,0.08),0_2px_6px_rgba(0,55,112,0.04)] rounded-[12px] p-8 flex flex-col items-center gap-6 w-[340px] animate-in zoom-in-95 duration-200"
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
                <img src={qrDataUrl} alt="Scanner QR code" width={220} height={220} />
              ) : (
                <div className="w-[220px] h-[220px] animate-pulse bg-muted rounded-lg" />
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

      {/* ── Scan toast stack ─────────────────────────────────────────────── */}
      <div className="fixed bottom-6 left-1/2 -translate-x-1/2 flex flex-col gap-2 z-50 pointer-events-none">
        {scanToasts.map((t) => (
          <div
            key={t.id}
            className={`flex items-center gap-3 px-4 py-3 rounded-full shadow-lg border text-sm font-medium animate-in slide-in-from-bottom-2 duration-200 ${t.ok
              ? "bg-background border-emerald-200 text-emerald-700"
              : "bg-background border-destructive/20 text-destructive"
              }`}
          >
            {t.ok ? <Check className="w-4 h-4" /> : <X className="w-4 h-4" />}
            {t.text}
          </div>
        ))}
      </div>
    </div>
  );
}
