const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const db = require('../config/database');
const { authMiddleware } = require('../middleware/auth.middleware');

// Apply auth middleware to all routes
router.use(authMiddleware);

// GET /api/products - Get all products
router.get('/', async (req, res) => {
  try {
    const { active, category, search } = req.query;
    let query = 'SELECT * FROM products WHERE 1=1';
    const params = [];
    let paramCount = 1;

    if (active !== undefined) {
      query += ` AND is_active = $${paramCount}`;
      params.push(active === 'true');
      paramCount++;
    }

    if (category) {
      query += ` AND category = $${paramCount}`;
      params.push(category);
      paramCount++;
    }

    if (search) {
      query += ` AND (name ILIKE $${paramCount} OR make ILIKE $${paramCount})`;
      params.push(`%${search}%`);
      paramCount++;
    }

    query += ' ORDER BY created_at DESC';

    const result = await db.query(query, params);
    res.json(result.rows);
  } catch (error) {
    console.error('Get products error:', error);
    res.status(500).json({ error: 'Failed to fetch products' });
  }
});

// GET /api/products/:id - Get single product
router.get('/:id', async (req, res) => {
  try {
    const result = await db.query('SELECT * FROM products WHERE id = $1', [req.params.id]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Product not found' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Get product error:', error);
    res.status(500).json({ error: 'Failed to fetch product' });
  }
});

// POST /api/products - Create new product
router.post('/', [
  body('name').notEmpty().trim(),
  body('mfgDate').isDate(),
  body('expDate').isDate(),
  body('stockQuantity').isInt({ min: 0 }),
  body('make').notEmpty().trim(),
  body('unitPrice').isFloat({ min: 0 }),
  body('costPrice').isFloat({ min: 0 })
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const {
      name, mfgDate, expDate, stockQuantity, make, description,
      unitPrice, costPrice, category, batchNumber, gstPercentage, notes
    } = req.body;

    const result = await db.query(
      `INSERT INTO products 
       (name, mfg_date, exp_date, stock_quantity, make, description, 
        unit_price, cost_price, category, batch_number, gst_percentage, notes)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
       RETURNING *`,
      [name, mfgDate, expDate, stockQuantity, make, description,
       unitPrice, costPrice, category, batchNumber, gstPercentage, notes]
    );

    // Log stock history
    if (stockQuantity > 0) {
      await db.query(
        'INSERT INTO stock_history (product_id, quantity_added, user_id, notes) VALUES ($1, $2, $3, $4)',
        [result.rows[0].id, stockQuantity, req.user.id, 'Initial stock']
      );
    }

    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Create product error:', error);
    res.status(500).json({ error: 'Failed to create product' });
  }
});

// PUT /api/products/:id - Update product
router.put('/:id', async (req, res) => {
  try {
    const {
      name, mfgDate, expDate, stockQuantity, make, description,
      unitPrice, costPrice, category, batchNumber, gstPercentage, notes, isActive
    } = req.body;

    // Get current stock
    const currentProduct = await db.query('SELECT stock_quantity FROM products WHERE id = $1', [req.params.id]);
    if (currentProduct.rows.length === 0) {
      return res.status(404).json({ error: 'Product not found' });
    }

    const result = await db.query(
      `UPDATE products SET
       name = $1, mfg_date = $2, exp_date = $3, stock_quantity = $4, make = $5,
       description = $6, unit_price = $7, cost_price = $8, category = $9,
       batch_number = $10, gst_percentage = $11, notes = $12, is_active = $13,
       updated_at = CURRENT_TIMESTAMP
       WHERE id = $14
       RETURNING *`,
      [name, mfgDate, expDate, stockQuantity, make, description,
       unitPrice, costPrice, category, batchNumber, gstPercentage, notes, isActive, req.params.id]
    );

    // Log stock change
    const stockDiff = stockQuantity - currentProduct.rows[0].stock_quantity;
    if (stockDiff !== 0) {
      await db.query(
        'INSERT INTO stock_history (product_id, quantity_added, user_id, notes) VALUES ($1, $2, $3, $4)',
        [req.params.id, stockDiff, req.user.id, 'Stock updated']
      );
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Update product error:', error);
    res.status(500).json({ error: 'Failed to update product' });
  }
});

// DELETE /api/products/:id - Delete product
router.delete('/:id', async (req, res) => {
  try {
    const result = await db.query('DELETE FROM products WHERE id = $1 RETURNING id', [req.params.id]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Product not found' });
    }

    res.json({ message: 'Product deleted successfully' });
  } catch (error) {
    console.error('Delete product error:', error);
    res.status(500).json({ error: 'Failed to delete product' });
  }
});

// GET /api/products/:id/stock-history - Get stock history
router.get('/:id/stock-history', async (req, res) => {
  try {
    const result = await db.query(
      `SELECT sh.*, u.username 
       FROM stock_history sh
       LEFT JOIN users u ON sh.user_id = u.id
       WHERE sh.product_id = $1
       ORDER BY sh.date DESC`,
      [req.params.id]
    );

    res.json(result.rows);
  } catch (error) {
    console.error('Get stock history error:', error);
    res.status(500).json({ error: 'Failed to fetch stock history' });
  }
});

module.exports = router;