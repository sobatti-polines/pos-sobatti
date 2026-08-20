"use client";

import { useEffect } from "react";

export function AutoPrint() {
  useEffect(() => {
    // Beri sedikit jeda agar DOM selesai dirender sepenuhnya sebelum dialog print muncul
    const timer = setTimeout(() => {
      window.print();
    }, 500);
    return () => clearTimeout(timer);
  }, []);

  return null;
}
