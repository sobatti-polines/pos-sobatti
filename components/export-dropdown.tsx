"use client"

import { ChevronDown, Download, FileSpreadsheet, FileText } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { cn } from "@/lib/utils"

interface ExportDropdownProps {
  onExportCSV?: () => void
  onExportPDF?: () => void
  className?: string
  size?: "default" | "sm"
  disabled?: boolean
}

export function ExportDropdown({
  onExportCSV,
  onExportPDF,
  className,
  size = "default",
  disabled = false,
}: ExportDropdownProps) {
  if (onExportCSV && !onExportPDF) {
    return (
      <Button
        variant="outline"
        size={size}
        className={cn("gap-2", className)}
        onClick={onExportCSV}
        disabled={disabled}
      >
        <Download className="w-4 h-4" />
        Export
      </Button>
    )
  }

  if (onExportPDF && !onExportCSV) {
    return (
      <Button
        variant="outline"
        size={size}
        className={cn("gap-2", className)}
        onClick={onExportPDF}
        disabled={disabled}
      >
        <Download className="w-4 h-4" />
        Export
      </Button>
    )
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size={size}
          className={cn("gap-2", className)}
          disabled={disabled}
        >
          <Download className="w-4 h-4" />
          Export
          <ChevronDown className="w-4 h-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {onExportCSV && (
          <DropdownMenuItem onSelect={onExportCSV}>
            <FileSpreadsheet className="w-4 h-4" />
            Export CSV
          </DropdownMenuItem>
        )}
        {onExportPDF && (
          <DropdownMenuItem onSelect={onExportPDF}>
            <FileText className="w-4 h-4" />
            Export PDF
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
