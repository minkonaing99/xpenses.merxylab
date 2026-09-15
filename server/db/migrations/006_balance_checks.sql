ALTER TABLE accounts ADD COLUMN balance_revision BIGINT UNSIGNED NOT NULL DEFAULT 0 AFTER sort_order;

CREATE TABLE balance_checks (
  id CHAR(36) NOT NULL,
  account_id CHAR(36) NOT NULL,
  actual_balance BIGINT NOT NULL,
  tracked_balance BIGINT NOT NULL,
  account_revision BIGINT UNSIGNED NOT NULL,
  checked_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_balance_check_account_time (account_id, checked_at),
  CONSTRAINT fk_balance_check_account FOREIGN KEY (account_id) REFERENCES accounts(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TRIGGER transactions_balance_revision_insert AFTER INSERT ON transactions FOR EACH ROW UPDATE accounts SET balance_revision = balance_revision + 1 WHERE id IN (NEW.account_id, NEW.from_account_id, NEW.to_account_id);

CREATE TRIGGER transactions_balance_revision_update AFTER UPDATE ON transactions FOR EACH ROW UPDATE accounts SET balance_revision = balance_revision + 1 WHERE (NOT (OLD.type <=> NEW.type) OR NOT (OLD.amount <=> NEW.amount) OR NOT (OLD.account_id <=> NEW.account_id) OR NOT (OLD.from_account_id <=> NEW.from_account_id) OR NOT (OLD.to_account_id <=> NEW.to_account_id) OR NOT (OLD.txn_date <=> NEW.txn_date) OR NOT (OLD.deleted_at <=> NEW.deleted_at)) AND id IN (OLD.account_id, OLD.from_account_id, OLD.to_account_id, NEW.account_id, NEW.from_account_id, NEW.to_account_id);

CREATE TRIGGER transactions_balance_revision_delete AFTER DELETE ON transactions FOR EACH ROW UPDATE accounts SET balance_revision = balance_revision + 1 WHERE id IN (OLD.account_id, OLD.from_account_id, OLD.to_account_id);
