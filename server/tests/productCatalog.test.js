import assert from 'node:assert/strict'
import test from 'node:test'
import { formatINR, productCatalog } from '../../shared/productCatalog.js'

test('the approved subscription and one-time prices remain unchanged', () => {
  const prices = Object.fromEntries(productCatalog.map((product) => [product.id, product.amountPaise ?? product.startingAmountPaise]))
  assert.deepEqual(prices, {
    starter: 149900,
    professional: 399900,
    business: 999900,
    enterprise: 2499900,
    'data-setup': 299900,
  })
})

test('subscription intervals and the setup service billing interval are explicit', () => {
  assert.ok(productCatalog.filter((product) => product.type === 'subscription').every((product) => product.billingInterval === 'month'))
  assert.equal(productCatalog.find((product) => product.id === 'data-setup').billingInterval, 'one-time')
  assert.equal(productCatalog.find((product) => product.id === 'enterprise').pricingType, 'custom')
})

test('INR formatting uses Indian digit grouping', () => {
  assert.equal(formatINR(149900), '₹1,499')
  assert.equal(formatINR(2499900), '₹24,999')
})