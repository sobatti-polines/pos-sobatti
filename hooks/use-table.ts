"use client"

import { useState, useMemo } from "react"

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

  const paginatedData = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage
    return sortedData.slice(start, start + itemsPerPage)
  }, [sortedData, currentPage, itemsPerPage])

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
    currentPage,
    setCurrentPage,
    itemsPerPage,
    setItemsPerPage,
    paginatedData,
    total,
    totalPages,
  }
}
