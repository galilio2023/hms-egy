"use client";

import React, { useState } from "react";
import { useLocale } from "next-intl";
import {
  ColumnDef,
  flexRender,
  getCoreRowModel,
  getPaginationRowModel,
  getFilteredRowModel,
  useReactTable,
} from "@tanstack/react-table";
import { 
  ChevronLeft, 
  ChevronRight, 
  Search,
  SlidersHorizontal 
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface DataTableProps<TData, TValue> {
  columns: ColumnDef<TData, TValue>[];
  data: TData[];
  searchKey?: string;
  searchPlaceholder?: string;
  onRowClick?: (row: TData) => void;
}

export function DataTable<TData, TValue>({
  columns,
  data,
  searchKey,
  searchPlaceholder,
  onRowClick,
}: DataTableProps<TData, TValue>) {
  const locale = useLocale();
  const isRtl = locale === "ar";
  const [globalFilter, setGlobalFilter] = useState("");

  const table = useReactTable({
    data,
    columns,
    state: {
      globalFilter: globalFilter,
    },
    onGlobalFilterChange: setGlobalFilter,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    globalFilterFn: "auto",
  });

  const LeftArrow = isRtl ? ChevronRight : ChevronLeft;
  const RightArrow = isRtl ? ChevronLeft : ChevronRight;

  return (
    <div className="w-full space-y-4">
      {/* Search Input bar */}
      {searchKey && (
        <div className="flex items-center justify-between gap-4">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute top-[13px] start-4 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder={searchPlaceholder || (isRtl ? "بحث..." : "Search...")}
              value={globalFilter}
              onChange={(e) => setGlobalFilter(e.target.value)}
              className="ps-11"
            />
          </div>
          <Button variant="outline" size="sm" className="hidden sm:flex gap-2">
            <SlidersHorizontal className="h-4 w-4" />
            <span>{isRtl ? "تصفية" : "Filter"}</span>
          </Button>
        </div>
      )}

      {/* Table grid wrapper */}
      <div className="rounded-2xl border border-border/40 bg-card text-card-foreground shadow-xs overflow-hidden">
        <div className="w-full overflow-x-auto scrollbar-thin">
          <table className="w-full border-collapse text-sm">
            <thead>
              {table.getHeaderGroups().map((headerGroup) => (
                <tr 
                  key={headerGroup.id} 
                  className="border-b border-border/40 bg-muted/40 text-muted-foreground font-semibold"
                >
                  {headerGroup.headers.map((header) => (
                    <th
                      key={header.id}
                      className={cn(
                        "p-4 text-start select-none font-bold text-xs uppercase tracking-wider",
                        isRtl ? "first:rounded-tr-2xl last:rounded-tl-2xl" : "first:rounded-tl-2xl last:rounded-tr-2xl"
                      )}
                    >
                      {header.isPlaceholder
                        ? null
                        : flexRender(
                            header.column.columnDef.header,
                            header.getContext()
                          )}
                    </th>
                  ))}
                </tr>
              ))}
            </thead>
            <tbody>
              {table.getRowModel().rows?.length ? (
                table.getRowModel().rows.map((row) => (
                  <tr
                    key={row.id}
                    onClick={() => onRowClick && onRowClick(row.original)}
                    className={cn(
                      "border-b border-border/10 hover:bg-muted/30 transition-colors duration-150 last:border-b-0",
                      onRowClick && "cursor-pointer"
                    )}
                  >
                    {row.getVisibleCells().map((cell) => (
                      <td key={cell.id} className="p-4 align-middle font-medium">
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </td>
                    ))}
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={columns.length} className="h-24 text-center text-muted-foreground">
                    {isRtl ? "لا توجد نتائج." : "No results."}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pagination Actions control */}
      <div className="flex items-center justify-between px-2 py-1 text-xs text-muted-foreground font-semibold">
        <div>
          {isRtl 
            ? `عرض الصفحة ${table.getState().pagination.pageIndex + 1} من أصل ${table.getPageCount() || 1}`
            : `Showing page ${table.getState().pagination.pageIndex + 1} of ${table.getPageCount() || 1}`
          }
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="xs"
            onClick={() => table.previousPage()}
            disabled={!table.getCanPreviousPage()}
            className="h-8 w-8 p-0"
          >
            <LeftArrow className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            size="xs"
            onClick={() => table.nextPage()}
            disabled={!table.getCanNextPage()}
            className="h-8 w-8 p-0"
          >
            <RightArrow className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
