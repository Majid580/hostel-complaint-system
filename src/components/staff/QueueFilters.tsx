"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useState } from "react";
import { Filter, Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge, Input } from "@/components/ui/primitives";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/overlays";
import {
  CATEGORY_OPTIONS,
  HOSTEL_OPTIONS,
  SEVERITIES,
  SEVERITY_META,
  STATUSES,
  STATUS_META,
} from "@/lib/domain/constants";

const ANY = "__any__";

export function QueueFilters({
  basePath,
  showHostel,
}: {
  basePath: string;
  showHostel: boolean;
}) {
  const router = useRouter();
  const params = useSearchParams();
  const [search, setSearch] = useState(params.get("q") ?? "");

  const apply = useCallback(
    (updates: Record<string, string | null>) => {
      const next = new URLSearchParams(params.toString());
      for (const [key, value] of Object.entries(updates)) {
        if (value === null || value === "" || value === ANY) next.delete(key);
        else next.set(key, value);
      }
      next.delete("page");
      router.push(`${basePath}?${next.toString()}`);
    },
    [basePath, params, router],
  );

  const active = [
    params.get("status"),
    params.get("severity"),
    params.get("category"),
    params.get("hostel"),
    params.get("escalated"),
    params.get("disputed"),
    params.get("slaBreached"),
    params.get("q"),
  ].filter(Boolean).length;

  return (
    <div className="space-y-3">
      {/* ---------- Search ---------- */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          apply({ q: search.trim() || null });
        }}
        className="flex gap-2"
      >
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search ticket number, title, room, registration number…"
            className="pl-9"
            aria-label="Search complaints"
          />
        </div>
        <Button type="submit" variant="outline">
          Search
        </Button>
      </form>

      {/* ---------- Quick toggles ---------- */}
      <div className="flex flex-wrap gap-2">
        <Toggle
          label="Needs action"
          active={params.get("view") === "actionRequired"}
          onClick={() =>
            apply({ view: params.get("view") === "actionRequired" ? null : "actionRequired" })
          }
        />
        <Toggle
          label="Escalated"
          tone="danger"
          active={params.get("escalated") === "true"}
          onClick={() => apply({ escalated: params.get("escalated") === "true" ? null : "true" })}
        />
        <Toggle
          label="Disputed"
          tone="danger"
          active={params.get("disputed") === "true"}
          onClick={() => apply({ disputed: params.get("disputed") === "true" ? null : "true" })}
        />
        <Toggle
          label="Past deadline"
          tone="warning"
          active={params.get("slaBreached") === "true"}
          onClick={() =>
            apply({ slaBreached: params.get("slaBreached") === "true" ? null : "true" })
          }
        />
        <Toggle
          label="Closed"
          active={params.get("view") === "closed"}
          onClick={() => apply({ view: params.get("view") === "closed" ? null : "closed" })}
        />
      </div>

      {/* ---------- Dropdowns ---------- */}
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
        {showHostel && (
          <Select value={params.get("hostel") ?? ANY} onValueChange={(v) => apply({ hostel: v })}>
            <SelectTrigger aria-label="Filter by hostel">
              <SelectValue placeholder="All hostels" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ANY}>All hostels</SelectItem>
              {HOSTEL_OPTIONS.map((o) => (
                <SelectItem key={o.value} value={o.value}>
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}

        <Select value={params.get("status") ?? ANY} onValueChange={(v) => apply({ status: v })}>
          <SelectTrigger aria-label="Filter by status">
            <SelectValue placeholder="Any status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ANY}>Any status</SelectItem>
            {STATUSES.map((s) => (
              <SelectItem key={s} value={s}>
                {STATUS_META[s].label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={params.get("severity") ?? ANY} onValueChange={(v) => apply({ severity: v })}>
          <SelectTrigger aria-label="Filter by severity">
            <SelectValue placeholder="Any severity" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ANY}>Any severity</SelectItem>
            {SEVERITIES.map((s) => (
              <SelectItem key={s} value={s}>
                {SEVERITY_META[s].label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={params.get("category") ?? ANY} onValueChange={(v) => apply({ category: v })}>
          <SelectTrigger aria-label="Filter by category">
            <SelectValue placeholder="Any category" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ANY}>Any category</SelectItem>
            {CATEGORY_OPTIONS.map((o) => (
              <SelectItem key={o.value} value={o.value}>
                {o.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={params.get("sort") ?? "priority"} onValueChange={(v) => apply({ sort: v })}>
          <SelectTrigger aria-label="Sort order">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="priority">Highest priority first</SelectItem>
            <SelectItem value="oldest">Oldest first</SelectItem>
            <SelectItem value="newest">Newest first</SelectItem>
            <SelectItem value="dueSoon">Deadline soonest</SelectItem>
            <SelectItem value="severity">Most severe first</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {active > 0 && (
        <div className="flex items-center gap-2">
          <Badge tone="primary">
            <Filter className="size-3" />
            {active} filter{active === 1 ? "" : "s"} active
          </Badge>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setSearch("");
              router.push(basePath);
            }}
          >
            <X />
            Clear all
          </Button>
        </div>
      )}
    </div>
  );
}

function Toggle({
  label,
  active,
  onClick,
  tone,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
  tone?: "danger" | "warning";
}) {
  return (
    <Button
      type="button"
      size="sm"
      variant={active ? (tone === "danger" ? "destructive" : tone === "warning" ? "warning" : "default") : "outline"}
      onClick={onClick}
      aria-pressed={active}
    >
      {label}
    </Button>
  );
}
