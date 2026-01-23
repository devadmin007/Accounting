const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const db = require('../config/database');
const { authMiddleware } = require('../middleware/auth.middleware');

router.use(authMiddleware);

// GET /api/sales - Get all sales
router.get('/', async (req, res) => {
  try {
    const { status, from, to } = req.query;
    let query = `
      SELECT s.*, 
        json_agg(json_build_object(
          'id', si.id,
          'productId', si.product_id,
          'productName', si.product_name,
          'quantity', si.quantity,
          'price', si.price,
          'subtotal', si.subtotal
        )) as items
      FROM sales s
      LEFT JOIN sale_items si ON s.id = si.sale_id
      WHERE 1=1
    `;
    const params = [];
    let paramCount = 1;

    if (status) {
      query += ` AND s.status = $${paramCount}`;
      params.push(status);
      paramCount++;
    }

    if (from) {
      query += ` AND s.created_at >= $${paramCount}`;
      params.push(from);
      paramCount++;
    }

    if (to) {
      query += ` AND s.created_at <= $${paramCount}`;
      params.push(to);
      paramCount++;
    }

    query += ' GROUP BY s.id ORDER BY s.created_at DESC';

    const result = await db.query(query, params);
    res.json(result.rows);
  } catch (error) {
    console.error('Get sales error:', error);
    res.status(500).json({ error: 'Failed to fetch sales' });
  }
});

// GET /api/sales/:id - Get single sale
router.get('/:id', async (req, res) => {
  try {
    const saleResult = await db.query('SELECT * FROM sales WHERE id = $1', [req.params.id]);
    
    if (saleResult.rows.length === 0) {
      return res.status(404).json({ error: 'Sale not found' });
    }

    const itemsResult = await db.query('SELECT * FROM sale_items WHERE sale_id = $1', [req.params.id]);

    res.json({
      ...saleResult.rows[0],
      items: itemsResult.rows
    });
  } catch (error) {
    console.error('Get sale error:', error);
    res.status(500).json({ error: 'Failed to fetch sale' });
  }
});

// POST /api/sales - Create new sale
router.post('/', [
  body('invoiceNumber').notEmpty().trim(),
  body('customerName').notEmpty().trim(),
  body('totalAmount').isFloat({ min: 0 }),
  body('amountReceived').isFloat({ min: 0 }),
  body('paymentMode').isIn(['CASH', 'ONLINE', 'MIXED']),
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
      invoiceNumber, customerName, customerMobile, customerAddress,
      totalAmount, amountReceived, amountPending, paymentMode,
      cashAmount, onlineAmount, dueDate, items, status
    } = req.body;

    // Insert sale
    const saleResult = await client.query(
      `INSERT INTO sales 
       (invoice_number, customer_name, customer_mobile, customer_address,
        total_amount, amount_received, amount_pending, payment_mode,
        cash_amount, online_amount, due_date, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
       RETURNING *`,
      [invoiceNumber, customerName, customerMobile, customerAddress,
       totalAmount, amountReceived, amountPending, paymentMode,
       cashAmount, onlineAmount, dueDate, status]
    );

    const saleId = saleResult.rows[0].id;

    // Insert sale items and update stock
    for (const item of items) {
      await client.query(
        `INSERT INTO sale_items (sale_id, product_id, product_name, quantity, price, subtotal)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [saleId, item.productId, item.productName, item.quantity, item.price, item.subtotal]
      );

      // Update product stock
      await client.query(
        'UPDATE products SET stock_quantity = stock_quantity - $1 WHERE id = $2',
        [item.quantity, item.productId]
      );
    }

    await client.query('COMMIT');

    res.status(201).json({
      ...saleResult.rows[0],
      items
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Create sale error:', error);
    res.status(500).json({ error: 'Failed to create sale' });
  } finally {
    client.release();
  }
});

module.exports = router;