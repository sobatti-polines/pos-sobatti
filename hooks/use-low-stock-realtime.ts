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

export function useLowStockRealtime() {
  const [items, setItems] = useState<LowStockItem[]>([]);

  useEffect(() => {
    let cancelled = false;

    const fetchItems = async () => {
      try {
        const res = await fetch("/api/low-stock");
        if (res.ok && !cancelled) {
          setItems(await res.json());
        } else if (!res.ok && !cancelled) {
          console.warn("Low-stock fetch failed:", res.status, await res.text().catch(() => ""));
        }
      } catch (err) {
        console.warn("Low-stock fetch error:", err);
      }
    };

    fetchItems();

    const supabase = createClient();
    const channel = supabase
      .channel(`low-stock-changes-${crypto.randomUUID()}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "produk" },
        () => fetchItems()
      )
      .subscribe();

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
  }, []);

  return items;
}
