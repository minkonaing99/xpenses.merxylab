ALTER TABLE transactions ADD COLUMN kind VARCHAR(16) NOT NULL DEFAULT 'ordinary' AFTER type;

ALTER TABLE balance_checks ADD COLUMN adjustment_transaction_id CHAR(36) NULL AFTER account_revision, ADD UNIQUE KEY uq_balance_check_adjustment (adjustment_transaction_id), ADD CONSTRAINT fk_balance_check_adjustment FOREIGN KEY (adjustment_transaction_id) REFERENCES transactions(id);
