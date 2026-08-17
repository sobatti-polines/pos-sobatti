"use client"

import { useState, useMemo, useEffect, useRef } from "react"

function getNestedValue(obj: unknown, path: string): unknown {
  return path.split(".").reduce((current: unknown, key: string) => {
    if (current && typeof current === "object" && key in current) {
      return (current as Record<string, unknown>)[key]
    }
    return undefined
  }, obj)
}

export interface SortConfig {
  key: string
  direction: "asc" | "desc"
}

export interface UseTableOptions<T> {
  data: T[]
  defaultSortKey?: string
  defaultSortDir?: "asc" | "desc"
  defaultItemsPerPage?: number
}

export function useTable<T>({
  data,
  defaultSortKey,
  defaultSortDir = "asc",
  defaultItemsPerPage = 25,
}: UseTableOptions<T>) {
  const [sortConfig, setSortConfig] = useState<SortConfig | null>(
    defaultSortKey ? { key: defaultSortKey, direction: defaultSortDir } : null
  )
  const [currentPage, setCurrentPage] = useState(1)
  const [itemsPerPage, setItemsPerPage] = useState(defaultItemsPerPage)

  // Reset ke halaman 1 SETIAP KALI data berubah (mis. pencarian/filter baru).
  // TANPA ini, user yang sedang di halaman belakang lalu mengetik kata kunci
  // akan tetap berada di halaman lama → hasil filter jadi slice kosong →
  // produk yang jelas ada di DB tidak pernah muncul ("tidak ditemukan").
  const prevData = useRef(data)
  useEffect(() => {
    if (prevData.current !== data) {
      prevData.current = data
      setCurrentPage(1)
    }
  }, [data])

  const sortedData = useMemo(() => {
    if (!sortConfig) return data
    return [...data].sort((a, b) => {
      const aVal = getNestedValue(a, sortConfig.key) ?? ""
      const bVal = getNestedValue(b, sortConfig.key) ?? ""
      if (aVal < bVal) return sortConfig.direction === "asc" ? -1 : 1
      if (aVal > bVal) return sortConfig.direction === "asc" ? 1 : -1
      return 0
    })
  }, [data, sortConfig])

  const total = sortedData.length
  const totalPages = Math.max(1, Math.ceil(total / itemsPerPage))

  // Pengaman: jangan pernah melewati halaman terakhir (data bisa menyusut
  // saat filter diterapkan).
  const safePage = Math.min(currentPage, totalPages)

  const paginatedData = useMemo(() => {
    const start = (safePage - 1) * itemsPerPage
    return sortedData.slice(start, start + itemsPerPage)
  }, [sortedData, safePage, itemsPerPage])

  const handleSort = (key: string) => {
    setSortConfig((prev) => {
      if (prev && prev.key === key && prev.direction === "asc") {
        return { key, direction: "desc" }
      }
      return { key, direction: "asc" }
    })
    setCurrentPage(1)
  }

  return {
    sortConfig,
    handleSort,
    currentPage: safePage,
    setCurrentPage,
    itemsPerPage,
    setItemsPerPage,
    paginatedData,
    total,
    totalPages,
  }
}
