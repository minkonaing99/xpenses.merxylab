'use strict'

const { toCsv, escapeField } = require('../csv')

describe('reports csv', () => {
  describe('escapeField', () => {
    it('leaves plain values untouched', () => {
      expect(escapeField('Coffee')).toBe('Coffee')
    })

    it('quotes and doubles embedded quotes', () => {
      expect(escapeField('a "b" c')).toBe('"a ""b"" c"')
    })

    it('quotes values with commas or newlines', () => {
      expect(escapeField('a,b')).toBe('"a,b"')
      expect(escapeField('a\nb')).toBe('"a\nb"')
    })

    it('renders null/undefined as empty', () => {
      expect(escapeField(null)).toBe('')
      expect(escapeField(undefined)).toBe('')
    })
  })

  describe('toCsv', () => {
    it('emits a header row even with no data', () => {
      expect(toCsv([])).toBe('date,type,category,account,amount_thb,note')
    })

    it('formats satang as baht with 2 decimals', () => {
      const csv = toCsv([
        { txn_date: '2026-07-05', type: 'expense', category_name: 'Food', account_name: 'Cash', amount: 4250, note: 'lunch' },
      ])
      const [, row] = csv.split('\r\n')
      expect(row).toBe('2026-07-05,expense,Food,Cash,42.50,lunch')
    })

    it('renders a transfer account as from -> to and no category', () => {
      const csv = toCsv([
        {
          txn_date: '2026-07-06',
          type: 'transfer',
          category_name: null,
          from_account_name: 'Cash',
          to_account_name: 'Bank',
          amount: 100000,
          note: null,
        },
      ])
      const [, row] = csv.split('\r\n')
      expect(row).toBe('2026-07-06,transfer,,Cash -> Bank,1000.00,')
    })

    it('quotes a note containing a comma', () => {
      const csv = toCsv([
        { txn_date: '2026-07-07', type: 'expense', category_name: 'Food', account_name: 'Cash', amount: 500, note: 'a, b' },
      ])
      const [, row] = csv.split('\r\n')
      expect(row).toBe('2026-07-07,expense,Food,Cash,5.00,"a, b"')
    })
  })
})
