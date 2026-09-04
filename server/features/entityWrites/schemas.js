'use strict'

const { z } = require('zod')

const TXN_TYPES = ['expense', 'income', 'transfer']
const uuidOrNull = z.string().uuid().nullable().optional()
const entityIdSchema = z.string().uuid()
const nonEmptyPatch = { message: 'at least one field is required' }

const accountCreateSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1).max(80),
  type: z.enum(['cash', 'bank', 'other']).optional(),
  startingBalance: z.number().int().optional(),
  sortOrder: z.number().int().optional(),
})

const accountUpdateSchema = z
  .object({
    name: z.string().min(1).max(80).optional(),
    type: z.enum(['cash', 'bank', 'other']).optional(),
    startingBalance: z.number().int().optional(),
    sortOrder: z.number().int().optional(),
  })
  .refine((patch) => Object.keys(patch).length > 0, nonEmptyPatch)

const budgetCreateSchema = z.object({
  id: z.string().uuid(),
  categoryId: z.string().uuid(),
  limitAmount: z.number().int().positive(),
})

const budgetUpdateSchema = z
  .object({ limitAmount: z.number().int().positive().optional() })
  .refine((patch) => Object.keys(patch).length > 0, nonEmptyPatch)

const categoryCreateSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1).max(80),
  icon: z.string().max(40).optional(),
  sortOrder: z.number().int().optional(),
})

const categoryUpdateSchema = z
  .object({
    name: z.string().min(1).max(80).optional(),
    icon: z.string().max(40).optional(),
    sortOrder: z.number().int().optional(),
  })
  .refine((patch) => Object.keys(patch).length > 0, nonEmptyPatch)

const recurringCreateSchema = z.object({
  id: z.string().uuid(),
  type: z.enum(TXN_TYPES),
  amount: z.number().int().positive(),
  note: z.string().max(255).optional(),
  categoryId: uuidOrNull,
  accountId: uuidOrNull,
  fromAccountId: uuidOrNull,
  toAccountId: uuidOrNull,
  intervalUnit: z.enum(['day', 'week', 'month']),
  intervalCount: z.number().int().positive().optional(),
  nextRunDate: z.string().date(),
})

const recurringUpdateSchema = z
  .object({
    amount: z.number().int().positive().optional(),
    note: z.string().max(255).optional(),
    categoryId: uuidOrNull,
    accountId: uuidOrNull,
    fromAccountId: uuidOrNull,
    toAccountId: uuidOrNull,
    intervalUnit: z.enum(['day', 'week', 'month']).optional(),
    intervalCount: z.number().int().positive().optional(),
    nextRunDate: z.string().date().optional(),
    active: z.boolean().optional(),
  })
  .refine((patch) => Object.keys(patch).length > 0, nonEmptyPatch)

const transactionCreateSchema = z.object({
  id: z.string().uuid(),
  type: z.enum(TXN_TYPES),
  amount: z.number().int().positive(),
  note: z.string().max(255).nullable().optional(),
  categoryId: uuidOrNull,
  accountId: uuidOrNull,
  fromAccountId: uuidOrNull,
  toAccountId: uuidOrNull,
  txnDate: z.string().date(),
  updatedAt: z.string().datetime(),
})

const transactionUpdateSchema = z
  .object({
    amount: z.number().int().positive().optional(),
    note: z.string().max(255).nullable().optional(),
    categoryId: uuidOrNull,
    accountId: uuidOrNull,
    fromAccountId: uuidOrNull,
    toAccountId: uuidOrNull,
    txnDate: z.string().date().optional(),
    updatedAt: z.string().datetime(),
  })
  .refine((patch) => Object.keys(patch).length > 1, {
    message: 'at least one field besides updatedAt is required',
  })

const transactionDeleteSchema = z.object({ updatedAt: z.string().datetime() })

module.exports = {
  accountCreateSchema,
  accountUpdateSchema,
  budgetCreateSchema,
  budgetUpdateSchema,
  categoryCreateSchema,
  categoryUpdateSchema,
  entityIdSchema,
  recurringCreateSchema,
  recurringUpdateSchema,
  transactionCreateSchema,
  transactionUpdateSchema,
  transactionDeleteSchema,
}
