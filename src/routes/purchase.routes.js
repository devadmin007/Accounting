const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const db = require('../config/database');
const { authMiddleware } = require('../middleware/auth.middleware');

router.use(authMiddleware);

// GET /api/purchases - Get all purchases
router.get('/', async (req, res) => {
  try {
    const { status, from, to } = req.query;
    let query = `
      SELECT p.*, 
        json_agg(json_build_object(
          'id', pi.id,
          'itemName', pi.item_name,
          'quantity', pi.quantity,
          'price', pi.price,
          'subtotal', pi.subtotal
        )) as items
      FROM purchases p
      LEFT JOIN purchase_items pi ON p.id = pi.purchase_id
      WHERE 1=1
    `;
    const params = [];
    let paramCount = 1;

    if (status) {
      query += ` AND p.status = $${paramCount}`;
      params.push(status);
      paramCount++;
    }

    if (from) {
      query += ` AND p.created_at >= $${paramCount}`;
      params.push(from);
      paramCount++;
    }

    if (to) {
      query += ` AND p.created_at <= $${paramCount}`;
      params.push(to);
      paramCount++;
    }

    query += ' GROUP BY p.id ORDER BY p.created_at DESC';

    const result = await db.query(query, params);
    res.json(result.rows);
  } catch (error) {
    console.error('Get purchases error:', error);
    res.status(500).json({ error: 'Failed to fetch purchases' });
  }
});

// POST /api/purchases - Create new purchase
router.post('/', [
  body('supplierName').notEmpty().trim(),
  body('invoiceNumber').notEmpty().trim(),
  body('purchaseDate').isDate(),
  body('totalAmount').isFloat({ min: 0 }),
  body('amountPaid').isFloat({ min: 0 }),
  body('paymentMode').isIn(['CASH', 'ONLINE', 'CREDIT']),
  body('items').isArray({ min: 1 })
], async (req, res) => {
  const client = await db.pool.connect();

  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    await client.query('BEGIN');

    const {
      supplierName, invoiceNumber, purchaseDate, totalAmount,
      amountPaid, amountPending, paymentMode, dueDate, items, status
    } = req.body;

    // Check for duplicate invoice number
    const existingPurchase = await client.query(
      'SELECT id FROM purchases WHERE invoice_number = $1',
      [invoiceNumber]
    );

    if (existingPurchase.rows.length > 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: `Invoice number ${invoiceNumber} already exists in purchase records` });
    }

    // Insert purchase
    const purchaseResult = await client.query(
      `INSERT INTO purchases 
       (supplier_name, invoice_number, purchase_date, total_amount,
        amount_paid, amount_pending, payment_mode, due_date, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING *`,
      [supplierName, invoiceNumber, purchaseDate, totalAmount,
        amountPaid, amountPending, paymentMode, dueDate, status]
    );

    const purchaseId = purchaseResult.rows[0].id;

    // Insert purchase items
    for (const item of items) {
      await client.query(
        `INSERT INTO purchase_items (purchase_id, item_name, quantity, price, subtotal)
         VALUES ($1, $2, $3, $4, $5)`,
        [purchaseId, item.itemName, item.quantity, item.price, item.subtotal]
      );
    }

    await client.query('COMMIT');

    res.status(201).json({
      ...purchaseResult.rows[0],
      items
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Create purchase error:', error);
    res.status(500).json({ error: 'Failed to create purchase' });
  } finally {
    client.release();
  }
});

// GET /api/purchases/:id - Get single purchase
router.get('/:id', async (req, res) => {
  try {
    const purchaseResult = await db.query('SELECT * FROM purchases WHERE id = $1', [req.params.id]);

    if (purchaseResult.rows.length === 0) {
      return res.status(404).json({ error: 'Purchase not found' });
    }

    const itemsResult = await db.query('SELECT * FROM purchase_items WHERE purchase_id = $1', [req.params.id]);

    res.json({
      ...purchaseResult.rows[0],
      items: itemsResult.rows
    });
  } catch (error) {
    console.error('Get purchase error:', error);
    res.status(500).json({ error: 'Failed to fetch purchase' });
  }
});

// PUT /api/purchases/:id - Update purchase
router.put('/:id', [
  body('supplierName').notEmpty().trim(),
  body('invoiceNumber').notEmpty().trim(),
  body('purchaseDate').isDate(),
  body('totalAmount').isFloat({ min: 0 }),
  body('amountPaid').isFloat({ min: 0 }),
  body('paymentMode').isIn(['CASH', 'ONLINE', 'CREDIT']),
  body('items').isArray({ min: 1 })
], async (req, res) => {
  const client = await db.pool.connect();

  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    await client.query('BEGIN');

    const purchaseId = req.params.id;
    const {
      supplierName, invoiceNumber, purchaseDate, totalAmount,
      amountPaid, amountPending, paymentMode, dueDate, items, status
    } = req.body;

    // Check for duplicate invoice number (excluding current record)
    const existingPurchase = await client.query(
      'SELECT id FROM purchases WHERE invoice_number = $1 AND id != $2',
      [invoiceNumber, purchaseId]
    );

    if (existingPurchase.rows.length > 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: `Invoice number ${invoiceNumber} already exists in another purchase record` });
    }

    // 1. Delete existing items
    await client.query('DELETE FROM purchase_items WHERE purchase_id = $1', [purchaseId]);

    // 2. Update purchase record
    const purchaseResult = await client.query(
      `UPDATE purchases SET
       supplier_name = $1, invoice_number = $2, purchase_date = $3, total_amount = $4,
       amount_paid = $5, amount_pending = $6, payment_mode = $7, due_date = $8, status = $9
       WHERE id = $10
       RETURNING *`,
      [supplierName, invoiceNumber, purchaseDate, totalAmount,
        amountPaid, amountPending, paymentMode, dueDate, status, purchaseId]
    );

    if (purchaseResult.rows.length === 0) {
      throw new Error('Purchase not found');
    }

    // 3. Insert new purchase items
    for (const item of items) {
      await client.query(
        `INSERT INTO purchase_items (purchase_id, item_name, quantity, price, subtotal)
         VALUES ($1, $2, $3, $4, $5)`,
        [purchaseId, item.itemName, item.quantity, item.price, item.subtotal]
      );
    }

    await client.query('COMMIT');

    res.json({
      ...purchaseResult.rows[0],
      items
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Update purchase error:', error);
    res.status(500).json({ error: error.message || 'Failed to update purchase' });
  } finally {
    client.release();
  }
});

module.exports = router;