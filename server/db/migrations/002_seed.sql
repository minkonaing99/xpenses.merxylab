-- Starter accounts + categories per docs/SCHEMA.md "Seed Data".
-- IDs are fixed UUIDs so this migration is reproducible.

INSERT INTO accounts (id, name, type, starting_balance, sort_order) VALUES
  ('ed38905b-d95a-4fb3-a57c-827cd630e92a', 'Cash', 'cash', 0, 0),
  ('1e71faa4-7c84-469c-8e90-c49a1bc63ab8', 'Bank', 'bank', 0, 1);

INSERT INTO categories (id, name, sort_order) VALUES
  ('b211c0e9-693f-4e03-b2a9-a108606409d0', 'Food', 0),
  ('0121e2da-0d0d-4c93-aa47-dcc102353c2e', 'Groceries', 1),
  ('fc0be279-3ebf-4ab6-96c5-0beff516e712', 'Transport', 2),
  ('00ed6037-2a41-450a-a588-d61a8d8a76b1', 'Bills', 3),
  ('861cfe26-a9df-4a3b-97bd-3b12d2bd28dc', 'Shopping', 4),
  ('e52b8cab-4ef9-411a-a8e5-1caae31a590a', 'Health', 5),
  ('37515686-8400-4f52-9c32-71786453d275', 'Entertainment', 6),
  ('52ab9c9b-bead-4330-b9a1-55aecb3440b2', 'Rent', 7),
  ('52c7a80c-da03-49ed-bfa7-cef7a3ee1694', 'Salary', 8),
  ('b58a7ba3-4c0a-46f6-a71e-f9085978a2aa', 'Other', 9);
