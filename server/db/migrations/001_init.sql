-- xpenses schema — see docs/SCHEMA.md for the authoritative field-by-field spec.
-- Engine InnoDB, charset utf8mb4. Money = BIGINT satang, never floats.
-- Validation (amount > 0, per-type required fields, etc.) lives at the API
-- boundary (zod), not as DB CHECK constraints — see docs/SCHEMA.md "Application-
-- level invariants" for the MySQL-version-portability rationale.

CREATE TABLE accounts (
  id                CHAR(36)     NOT NULL,
  name              VARCHAR(80)  NOT NULL,
  type              VARCHAR(32)  NOT NULL DEFAULT 'cash',
  starting_balance  BIGINT       NOT NULL DEFAULT 0,
  sort_order        INT          NOT NULL DEFAULT 0,
  created_at        DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at        DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  deleted_at        DATETIME     NULL,
  PRIMARY KEY (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE categories (
  id          CHAR(36)     NOT NULL,
  name        VARCHAR(80)  NOT NULL,
  icon        VARCHAR(40)  NULL,
  sort_order  INT          NOT NULL DEFAULT 0,
  created_at  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  deleted_at  DATETIME     NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_categories_name (name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE transactions (
  id                CHAR(36)     NOT NULL,
  type              VARCHAR(16)  NOT NULL,
  amount            BIGINT       NOT NULL,
  note              VARCHAR(255) NULL,
  category_id       CHAR(36)     NULL,
  account_id        CHAR(36)     NULL,
  from_account_id   CHAR(36)     NULL,
  to_account_id     CHAR(36)     NULL,
  txn_date          DATE         NOT NULL,
  created_at        DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at        DATETIME     NOT NULL,
  deleted_at        DATETIME     NULL,
  PRIMARY KEY (id),
  KEY idx_txn_date (txn_date),
  KEY idx_txn_type (type),
  KEY idx_txn_category (category_id),
  KEY idx_txn_account (account_id),
  KEY idx_txn_updated_at (updated_at),
  CONSTRAINT fk_txn_category FOREIGN KEY (category_id) REFERENCES categories (id),
  CONSTRAINT fk_txn_account FOREIGN KEY (account_id) REFERENCES accounts (id),
  CONSTRAINT fk_txn_from_account FOREIGN KEY (from_account_id) REFERENCES accounts (id),
  CONSTRAINT fk_txn_to_account FOREIGN KEY (to_account_id) REFERENCES accounts (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE budgets (
  id            CHAR(36) NOT NULL,
  category_id   CHAR(36) NOT NULL,
  limit_amount  BIGINT   NOT NULL,
  created_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  deleted_at    DATETIME NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_budgets_category (category_id),
  CONSTRAINT fk_budget_category FOREIGN KEY (category_id) REFERENCES categories (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE recurring_rules (
  id                CHAR(36)     NOT NULL,
  type              VARCHAR(16)  NOT NULL,
  amount            BIGINT       NOT NULL,
  note              VARCHAR(255) NULL,
  category_id       CHAR(36)     NULL,
  account_id        CHAR(36)     NULL,
  from_account_id   CHAR(36)     NULL,
  to_account_id     CHAR(36)     NULL,
  interval_unit     VARCHAR(8)   NOT NULL,
  interval_count    INT          NOT NULL DEFAULT 1,
  next_run_date     DATE         NOT NULL,
  active            TINYINT(1)   NOT NULL DEFAULT 1,
  created_at        DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at        DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  deleted_at        DATETIME     NULL,
  PRIMARY KEY (id),
  KEY idx_rule_due (active, next_run_date),
  CONSTRAINT fk_rule_category FOREIGN KEY (category_id) REFERENCES categories (id),
  CONSTRAINT fk_rule_account FOREIGN KEY (account_id) REFERENCES accounts (id),
  CONSTRAINT fk_rule_from_account FOREIGN KEY (from_account_id) REFERENCES accounts (id),
  CONSTRAINT fk_rule_to_account FOREIGN KEY (to_account_id) REFERENCES accounts (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE recurring_runs (
  rule_id         CHAR(36) NOT NULL,
  run_date        DATE     NOT NULL,
  transaction_id  CHAR(36) NOT NULL,
  created_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (rule_id, run_date),
  CONSTRAINT fk_run_rule FOREIGN KEY (rule_id) REFERENCES recurring_rules (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
