"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";

export interface LowStockItem {
  id: number;
  nama_produk: string;
  stok: number;
  stok_minimum: number;
  satuan: { nama: string } | null;
}

let sharedItems: LowStockItem[] = [];
const listeners = new Set<() => void>();
let subscriptionCount = 0;
let channel: ReturnType<ReturnType<typeof createClient>["channel"]> | null = null;

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

function subscribeRealtime() {
  const supabase = createClient();
  channel = supabase
    .channel("low-stock-global")
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "produk" },
      () => { fetchItems(); }
    )
    .subscribe();
}

function unsubscribeRealtime() {
  if (channel) {
    const supabase = createClient();
    supabase.removeChannel(channel);
    channel = null;
  }
}

export function useLowStockRealtime() {
  const [items, setItems] = useState<LowStockItem[]>(() => [...sharedItems]);

  useEffect(() => {
    const listener = () => setItems([...sharedItems]);
    listeners.add(listener);

    if (subscriptionCount === 0) {
      fetchItems();
      subscribeRealtime();
    }
    subscriptionCount++;

    if (sharedItems.length > 0) {
      setItems([...sharedItems]);
    }

    return () => {
      listeners.delete(listener);
      subscriptionCount--;
      if (subscriptionCount <= 0) {
        unsubscribeRealtime();
        sharedItems = [];
      }
    };
  }, []);

  return items;
}
