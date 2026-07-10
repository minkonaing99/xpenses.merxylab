-- Same bug pattern fixed in migration 003 for categories.name: UNIQUE(category_id)
-- would permanently block creating a new budget for a category whose old
-- budget was soft-deleted. Uniqueness among non-deleted budgets is enforced
-- at the app layer instead (see features/budgets/router.js).
-- fk_budget_category needs *an* index on category_id, so add a plain one
-- before dropping the unique index that currently serves that purpose.
ALTER TABLE budgets ADD INDEX idx_budgets_category (category_id);
ALTER TABLE budgets DROP INDEX uq_budgets_category;
