'use strict'

const { ApiError } = require('../../../lib/apiResponse')
const { writeEntity } = require('../writer')

describe('writeEntity validation', () => {
  it.each([
    ['accounts', { id: 'not-a-uuid', name: 'Account' }],
    ['categories', { id: 'not-a-uuid', name: 'Category' }],
    ['budgets', { id: 'not-a-uuid', categoryId: 'also-invalid', limitAmount: 100 }],
    [
      'recurring',
      {
        id: 'not-a-uuid',
        type: 'expense',
        amount: 100,
        intervalUnit: 'month',
        nextRunDate: '2026-09-01',
      },
    ],
    [
      'transactions',
      {
        id: 'not-a-uuid',
        type: 'expense',
        amount: 100,
        txnDate: '2026-09-01',
        updatedAt: '2026-09-01T00:00:00.000Z',
      },
    ],
  ])('rejects invalid %s creates before persistence', async (entity, payload) => {
    await expect(writeEntity({}, { entity, action: 'create', payload })).rejects.toMatchObject({
      code: 'VALIDATION_ERROR',
    })
  })

  it('rejects an unknown entity through the same interface', async () => {
    await expect(
      writeEntity({}, { entity: 'unknown', action: 'create', payload: {} }),
    ).rejects.toBeInstanceOf(ApiError)
  })

  it.each(['accounts', 'categories', 'budgets', 'recurring', 'transactions'])(
    'rejects an invalid %s command id before persistence',
    async (entity) => {
      await expect(
        writeEntity({}, { entity, action: 'delete', id: 'bad-id', payload: { id: 'bad-id' } }),
      ).rejects.toMatchObject({ code: 'VALIDATION_ERROR' })
    },
  )
})
