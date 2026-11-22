'use strict';

var test = require('node:test');
var assert = require('node:assert/strict');
var pricing = require('../lib/pricing');
var invoice = require('../lib/invoice');
var reports = require('../lib/reports');

test('invoice uses the same HSN slab and total as the billed order', function () {
  var items = [{ id: 1, name: 'Rice', sku: 'RICE-1', hsn: '1006', price: 100, qty: 1 }];
  var billed = pricing.computeTotals(items, '');
  var printed = invoice.computeInvoiceFigures({ items: items, coupon: '' });

  assert.equal(billed.tax, 5);
  assert.equal(billed.total, 105);
  assert.equal(printed.rows[0].gstPercent, 5);
  assert.equal(printed.tax, billed.tax);
  assert.equal(printed.total, billed.total);
});

test('invoice applies the same coupon and post-discount GST as the billed order', function () {
  var items = [{ id: 2, name: 'Rice', sku: 'RICE-2', hsn: '1006', price: 1000, qty: 1 }];
  var billed = pricing.computeTotals(items, 'SAVE10');
  var printed = invoice.computeInvoiceFigures({ items: items, coupon: 'SAVE10' });

  assert.equal(billed.discount, 100);
  assert.equal(billed.tax, 45);
  assert.equal(billed.total, 945);
  assert.equal(printed.discount, billed.discount);
  assert.equal(printed.tax, billed.tax);
  assert.equal(printed.total, billed.total);
});

test('invoice applies coupon max discount exactly as the billed order does', function () {
  var items = [{ id: 3, name: 'Tea', sku: 'TEA-1', hsn: '0902', price: 2000, qty: 1 }];
  var billed = pricing.computeTotals(items, 'SAVE10');
  var printed = invoice.computeInvoiceFigures({ items: items, coupon: 'SAVE10' });

  assert.equal(billed.discount, 150);
  assert.equal(printed.discount, billed.discount);
});

test('invoice line values reflect billed post-discount taxable value and tax', function () {
  var items = [{ id: 4, name: 'Rice', sku: 'RICE-4', hsn: '1006', price: 1000, qty: 1 }];
  var billed = pricing.computeTotals(items, 'SAVE10');
  var order = {
    id: 104,
    date: '22/11/2026',
    customer: 'In-memory customer',
    paymentMode: 'cash',
    status: 'completed',
    items: items,
    coupon: 'SAVE10',
    subtotal: billed.subtotal,
    discount: billed.discount,
    tax: billed.tax,
    total: billed.total
  };
  var figures = invoice.computeInvoiceFigures(order);
  var html = invoice.render(order);

  assert.equal(figures.rows[0].line, 1000);
  assert.equal(figures.rows[0].lineTax, 45);
  assert.doesNotMatch(html, /Accountant Reconciliation Notice/);
  assert.doesNotMatch(html, /differs from Order Ledger recorded total/);
});

test('reconciliation reports matching in-memory billed and invoice figures', function () {
  var items = [{ id: 5, name: 'Rice', sku: 'RICE-5', hsn: '1006', price: 100, qty: 1 }];
  var billed = pricing.computeTotals(items, '');
  var db = {
    orders: [{
      id: 105,
      date: '22/11/2026',
      customer: 'In-memory customer',
      items: items,
      coupon: '',
      subtotal: billed.subtotal,
      discount: billed.discount,
      tax: billed.tax,
      total: billed.total
    }]
  };

  var result = reports.getGstReconciliation(db);
  assert.equal(result.totalChecked, 1);
  assert.equal(result.mismatchCount, 0);
  assert.equal(result.rows[0].ledgerTax, 5);
  assert.equal(result.rows[0].invoiceTax, 5);
  assert.equal(result.rows[0].delta, 0);
  assert.equal(result.rows[0].matched, true);
});

test('invoice matches the known sample order billing totals', function () {
  var order = {
    items: [
      { id: 1, name: 'Rice', sku: 'GRN-001', hsn: '1006', price: 640, qty: 1 },
      { id: 4, name: 'Oil', sku: 'OIL-001', hsn: '1512', price: 190, qty: 2 }
    ],
    coupon: 'SAVE10',
    subtotal: 1020,
    discount: 102,
    tax: 45.9,
    total: 963.9
  };
  var printed = invoice.computeInvoiceFigures(order);

  assert.equal(printed.subtotal, order.subtotal);
  assert.equal(printed.discount, order.discount);
  assert.equal(printed.tax, order.tax);
  assert.equal(printed.total, order.total);
});
