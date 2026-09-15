-- Apply automatically through server/db/migrate.js. Kept as deployment reference.
CREATE TABLE planned_purchases (
  id                       CHAR(36)     NOT NULL,
  name                     VARCHAR(255) NOT NULL,
  amount                   BIGINT       NOT NULL,
  account_id               CHAR(36)     NOT NULL,
  category_id              CHAR(36)     NOT NULL,
  planned_date             DATE         NOT NULL,
  wait_days                TINYINT UNSIGNED NOT NULL DEFAULT 7,
  wait_until               DATE         NOT NULL,
  status                   VARCHAR(16)  NOT NULL DEFAULT 'planned',
  confirmed_transaction_id CHAR(36)     NULL,
  created_at               DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at               DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_plan_confirmed_transaction (confirmed_transaction_id),
  KEY idx_plan_status_date (status, planned_date),
  KEY idx_plan_account_status (account_id, status),
  KEY idx_plan_category_status (category_id, status),
  CONSTRAINT fk_plan_account FOREIGN KEY (account_id) REFERENCES accounts (id),
  CONSTRAINT fk_plan_category FOREIGN KEY (category_id) REFERENCES categories (id),
  CONSTRAINT fk_plan_transaction FOREIGN KEY (confirmed_transaction_id) REFERENCES transactions (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Add purchase reflections to existing Plans installations.
ALTER TABLE planned_purchases
  ADD COLUMN reflection VARCHAR(16) NULL,
  ADD COLUMN reflection_note VARCHAR(255) NULL;

-- Apply manually before deploying Savings Pots code.
CREATE TABLE savings_pots (
  id            CHAR(36)     NOT NULL,
  name          VARCHAR(80)  NOT NULL,
  target_amount BIGINT       NOT NULL,
  account_id    CHAR(36)     NOT NULL,
  archived_at   DATETIME     NULL,
  created_at    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_pot_account_archive (account_id, archived_at),
  KEY idx_pot_archive_created (archived_at, created_at),
  CONSTRAINT fk_pot_account FOREIGN KEY (account_id) REFERENCES accounts (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE savings_pot_movements (
  id         CHAR(36)     NOT NULL,
  pot_id     CHAR(36)     NOT NULL,
  type       VARCHAR(16)  NOT NULL,
  amount     BIGINT       NOT NULL,
  note       VARCHAR(255) NULL,
  created_at DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_pot_movement_history (pot_id, created_at),
  CONSTRAINT fk_pot_movement_pot FOREIGN KEY (pot_id) REFERENCES savings_pots (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE savings_pot_purchases (
  transaction_id CHAR(36) NOT NULL,
  pot_id         CHAR(36) NOT NULL,
  created_at     DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (transaction_id),
  KEY idx_pot_purchase_history (pot_id, created_at),
  CONSTRAINT fk_pot_purchase_transaction FOREIGN KEY (transaction_id) REFERENCES transactions (id),
  CONSTRAINT fk_pot_purchase_pot FOREIGN KEY (pot_id) REFERENCES savings_pots (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Balance check/reconciliation.
ALTER TABLE accounts ADD COLUMN balance_revision BIGINT UNSIGNED NOT NULL DEFAULT 0 AFTER sort_order;

CREATE TABLE balance_checks (
  id CHAR(36) NOT NULL PRIMARY KEY,
  account_id CHAR(36) NOT NULL,
  actual_balance BIGINT NOT NULL,
  tracked_balance BIGINT NOT NULL,
  account_revision BIGINT UNSIGNED NOT NULL,
  checked_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_balance_check_account_time (account_id, checked_at),
  CONSTRAINT fk_balance_check_account FOREIGN KEY (account_id) REFERENCES accounts(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TRIGGER transactions_balance_revision_insert AFTER INSERT ON transactions FOR EACH ROW UPDATE accounts SET balance_revision = balance_revision + 1 WHERE id IN (NEW.account_id, NEW.from_account_id, NEW.to_account_id);
CREATE TRIGGER transactions_balance_revision_update AFTER UPDATE ON transactions FOR EACH ROW UPDATE accounts SET balance_revision = balance_revision + 1 WHERE (NOT (OLD.type <=> NEW.type) OR NOT (OLD.amount <=> NEW.amount) OR NOT (OLD.account_id <=> NEW.account_id) OR NOT (OLD.from_account_id <=> NEW.from_account_id) OR NOT (OLD.to_account_id <=> NEW.to_account_id) OR NOT (OLD.txn_date <=> NEW.txn_date) OR NOT (OLD.deleted_at <=> NEW.deleted_at)) AND id IN (OLD.account_id, OLD.from_account_id, OLD.to_account_id, NEW.account_id, NEW.from_account_id, NEW.to_account_id);
CREATE TRIGGER transactions_balance_revision_delete AFTER DELETE ON transactions FOR EACH ROW UPDATE accounts SET balance_revision = balance_revision + 1 WHERE id IN (OLD.account_id, OLD.from_account_id, OLD.to_account_id);

-- Reconciliation adjustments.
ALTER TABLE transactions ADD COLUMN kind VARCHAR(16) NOT NULL DEFAULT 'ordinary' AFTER type;
ALTER TABLE balance_checks ADD COLUMN adjustment_transaction_id CHAR(36) NULL AFTER account_revision, ADD UNIQUE KEY uq_balance_check_adjustment (adjustment_transaction_id), ADD CONSTRAINT fk_balance_check_adjustment FOREIGN KEY (adjustment_transaction_id) REFERENCES transactions(id);
