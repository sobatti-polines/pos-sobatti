"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";

export interface LowStockItem {
  id: number;
  nama_produk: string;
  stok: number;
  stok_gudang: number;
  stok_minimum: number | null;
  stok_minimum_gudang: number | null;
  displayLow: boolean;
  gudangLow: boolean;
  satuan: { nama: string } | null;
}

let sharedItems: LowStockItem[] = [];
const listeners = new Set<() => void>();
let subscriptionCount = 0;
let supabaseClient: ReturnType<typeof createClient> | null = null;
let channel: ReturnType<ReturnType<typeof createClient>["channel"]> | null = null;
let refetchTimer: ReturnType<typeof setTimeout> | null = null;

// Satu aksi (checkout, barang masuk, stok opname) mengubah BANYAK baris tabel
// `produk` sekaligus, dan tiap baris memicu satu event realtime. Tanpa
// penggabungan, rentetan itu berubah menjadi rentetan pemindaian ulang
// SELURUH tabel produk. Timer ini menahan event selama ±1,5 detik lalu
// menjalankan satu refetch saja.
const REFETCH_COALESCE_MS = 1500;

function notifyAll() {
  listeners.forEach((l) => l());
}

async function fetchItems() {
  try {
    const res = await fetch("/api/low-stock");
    if (res.ok) {
      sharedItems = await res.json();
      notifyAll();
    }
  } catch {
    // silent
  }
}

function scheduleFetch() {
  if (refetchTimer) clearTimeout(refetchTimer);
  refetchTimer = setTimeout(() => {
    refetchTimer = null;
    // Tidak perlu kerja bila tidak ada komponen yang menampilkan data ini.
    if (subscriptionCount > 0) fetchItems();
  }, REFETCH_COALESCE_MS);
}

function subscribeRealtime() {
  if (channel) return;
  supabaseClient = createClient();
  channel = supabaseClient
    .channel("low-stock-global")
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "produk" },
      () => { scheduleFetch(); }
    )
    .subscribe();
}

function unsubscribeRealtime() {
  if (channel && supabaseClient) {
    supabaseClient.removeChannel(channel);
    channel = null;
    supabaseClient = null;
  }
}

/**
 * Di perangkat kasir tab ini sering dibiarkan terbuka lama. Selama tab tidak
 * terlihat, langganan realtime dan refetch dihentikan supaya tidak memakai
 * kuota jaringan untuk UI yang tidak sedang dilihat; saat tab kembali aktif,
 * data diambil sekali lalu langganan dipasang lagi.
 */
function handleVisibilityChange() {
  if (typeof document === "undefined") return;
  if (document.visibilityState === "visible") {
    if (subscriptionCount > 0 && !channel) {
      fetchItems();
      subscribeRealtime();
    }
  } else {
    unsubscribeRealtime();
    if (refetchTimer) {
      clearTimeout(refetchTimer);
      refetchTimer = null;
    }
  }
}

export function useLowStockRealtime(initialData?: LowStockItem[]) {
  const [items, setItems] = useState<LowStockItem[]>(() => {
    // Hydrate from server-provided initial data to avoid hydration mismatch
    if (initialData && initialData.length > 0 && sharedItems.length === 0) {
      sharedItems = initialData;
    }
    return [...sharedItems];
  });

  useEffect(() => {
    const listener = () => setItems([...sharedItems]);
    listeners.add(listener);

    if (subscriptionCount === 0) {
      fetchItems();
      if (typeof document !== "undefined" && document.visibilityState !== "hidden") {
        subscribeRealtime();
      }
      document.addEventListener("visibilitychange", handleVisibilityChange);
    }
    subscriptionCount++;

    if (sharedItems.length > 0) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setItems([...sharedItems]);
    }

    return () => {
      listeners.delete(listener);
      subscriptionCount--;
      if (subscriptionCount <= 0) {
        unsubscribeRealtime();
        document.removeEventListener("visibilitychange", handleVisibilityChange);
        if (refetchTimer) {
          clearTimeout(refetchTimer);
          refetchTimer = null;
        }
        // sharedItems SENGAJA tidak dikosongkan. Sebelumnya cache dibuang setiap
        // kali pengguna terakhir berhenti berlangganan, sehingga tiap pindah
        // halaman memicu pemindaian ulang penuh. Sekarang data terakhir tetap
        // ditampilkan lebih dulu; refetch tetap dijalankan saat mount berikutnya.
      }
    };
  }, []);

  return items;
}
