# UI Conventions

This document defines the standard patterns for pages and components in the Veraha Security client.

## Page shell (SidebarLayout routes)

```tsx
<div className="space-y-6">
  <PageHeader title="..." description="..." actions={...} />
  {error && <FormErrorAlert message={...} onRetry={...} />}
  {stats && <ListPageStatGrid items={[...]} />}
  <FilterBar ... />
  {isLoading ? <TableSkeleton /> : <DataTable ... />}
  <Pagination ... />
</div>
```

## Detail pages

Use `DetailPageHeader` with:

- `backTo` route
- optional `parentLabel` (e.g. "Policies")
- `title`, `description`, `actions`
- optional `meta` for badges and secondary metadata

Prefer shadcn `Tabs` with `TabsList className="h-auto flex-wrap"` for 3+ tabs.

## Loading, error, and empty states

| State | Component |
|-------|-----------|
| Loading (tables) | `TableSkeleton` |
| Loading (settings/forms) | `Skeleton` blocks |
| Fetch error | `FormErrorAlert` with optional `onRetry` |
| Empty list | `EmptyState` with icon, title, description, optional action |

## Tables

- Wrap multi-column tables in `overflow-x-auto`
- Add `min-w-[NNpx]` on inner table when columns must not collapse
- Prefer `DataTable` over raw `<table>` for list pages

## Filters

Use `FilterBar` or match its conventions:

- `flex-wrap` container
- Search: `min-w-[200px] flex-1 max-w-sm`
- Selects: `w-full sm:w-auto` (no fixed pixel widths on mobile)

## Status and colors

- Use `StatusBadge`, `EnumBadge`, or maps in `lib/constants.ts`
- Semantic tones: `--color-success`, `--color-error`, `--color-warning` via `SEMANTIC_BADGE_SOFT`
- Avoid raw Tailwind palette classes (`green-600`, `red-500`, etc.) in feature code

## Typography

- Page titles: `PageHeader` (`font-heading text-2xl`)
- Body/UI: Poppins (`font-sans`)
- Do not use ad-hoc `text-3xl font-bold` for page titles

## Theme

- Theme toggle uses `next-themes` via shared `ThemeToggle`
- Do not manually toggle `document.documentElement.classList`

## Responsive checks

Smoke test at **375px** and **1024px** before merging page changes.
