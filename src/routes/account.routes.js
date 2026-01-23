const express = require('express');
const router = express.Router();
const db = require('../config/database');
const { authMiddleware } = require('../middleware/auth.middleware');

router.use(authMiddleware);

// GET /api/accounts/pending-payments - Get all pending payments
router.get('/pending-payments', async (req, res) => {
  try {
    const result = await db.query(`
      SELECT 
        'SALE' as type,
        id,
        invoice_number,
        customer_name as party_name,
        customer_mobile as contact,
        amount_pending,
        due_date,
        created_at,
        status
      FROM sales
      WHERE status IN ('PENDING', 'PARTIAL')
      UNION ALL
      SELECT 
        'PURCHASE' as type,
        id,
        invoice_number,
        supplier_name as party_name,
        NULL as contact,
        amount_pending,
        due_date,
        created_at,
        status
      FROM purchases
      WHERE status IN ('PENDING', 'PARTIAL')
      ORDER BY due_date ASC
    `);

    res.json(result.rows);
  } catch (error) {
    console.error('Get pending payments error:', error);
    res.status(500).json({ error: 'Failed to fetch pending payments' });
  }
});

// GET /api/accounts/customer-outstanding - Get customer outstanding
router.get('/customer-outstanding', async (req, res) => {
  try {
    const result = await db.query(`
      SELECT 
        customer_name,
        customer_mobile,
        SUM(amount_pending) as total_outstanding,
        COUNT(*) as pending_invoices
      FROM sales
      WHERE status IN ('PENDING', 'PARTIAL')
      GROUP BY customer_name, customer_mobile
      ORDER BY total_outstanding DESC
    `);

    res.json(result.rows);
  } catch (error) {
    console.error('Get customer outstanding error:', error);
    res.status(500).json({ error: 'Failed to fetch customer outstanding' });
  }
});

// GET /api/accounts/supplier-outstanding - Get supplier outstanding
router.get('/supplier-outstanding', async (req, res) => {
  try {
    const result = await db.query(`
      SELECT 
        supplier_name,
        SUM(amount_pending) as total_outstanding,
        COUNT(*) as pending_invoices
      FROM purchases
      WHERE status IN ('PENDING', 'PARTIAL')
      GROUP BY supplier_name
      ORDER BY total_outstanding DESC
    `);

    res.json(result.rows);
  } catch (error) {
    console.error('Get supplier outstanding error:', error);
    res.status(500).json({ error: 'Failed to fetch supplier outstanding' });
  }
});

module.exports = router;