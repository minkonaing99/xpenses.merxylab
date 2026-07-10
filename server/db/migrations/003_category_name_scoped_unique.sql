-- The original UNIQUE(name) blocks reusing a category name forever once
-- soft-deleted (deleted_at IS NULL is not part of a MySQL unique index).
-- MySQL has no partial/filtered unique index, so uniqueness among
-- non-deleted rows is enforced at the app layer instead (see
-- features/categories/router.js) — consistent with this project's existing
-- "app-level invariants, not DB CHECK" convention (docs/SCHEMA.md).
ALTER TABLE categories DROP INDEX uq_categories_name;
