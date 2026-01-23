const express = require('express');
const router = express.Router();
const db = require('../config/database');
const { authMiddleware } = require('../middleware/auth.middleware');

router.use(authMiddleware);

// GET /api/dashboard/metrics - Get dashboard metrics
router.get('/metrics', async (req, res) => {
  try {
    const { from, to } = req.query;
    let dateFilter = '';
    const params = [];
    
    if (from && to) {
      dateFilter = 'WHERE created_at BETWEEN $1 AND $2';
      params.push(from, to);
    }

    // Total selling
    const salesResult = await db.query(
      `SELECT COALESCE(SUM(total_amount), 0) as total_selling FROM sales ${dateFilter}`,
      params
    );

    // Total purchase
    const purchaseResult = await db.query(
      `SELECT COALESCE(SUM(total_amount), 0) as total_purchase FROM purchases ${dateFilter}`,
      params
    );

    // Total online received
    const onlineResult = await db.query(
      `SELECT COALESCE(SUM(online_amount), 0) as total_online 
       FROM sales 
       WHERE payment_mode IN ('ONLINE', 'MIXED') ${dateFilter ? 'AND ' + dateFilter.substring(6) : ''}`,
      params
    );

    // Total cash received
    const cashResult = await db.query(
      `SELECT COALESCE(SUM(cash_amount), 0) as total_cash 
       FROM sales 
       WHERE payment_mode IN ('CASH', 'MIXED') ${dateFilter ? 'AND ' + dateFilter.substring(6) : ''}`,
      params
    );

    // Top selling product
    const topProductResult = await db.query(
      `SELECT si.product_name as name, SUM(si.quantity) as quantity
       FROM sale_items si
       JOIN sales s ON si.sale_id = s.id
       ${dateFilter}
       GROUP BY si.product_name
       ORDER BY quantity DESC
       LIMIT 1`,
      params
    );

    res.json({
      totalSelling: parseFloat(salesResult.rows[0].total_selling),
      totalPurchase: parseFloat(purchaseResult.rows[0].total_purchase),
      totalOnlineReceived: parseFloat(onlineResult.rows[0].total_online),
      totalCashReceived: parseFloat(cashResult.rows[0].total_cash),
      topSellingProduct: topProductResult.rows[0] || null
    });
  } catch (error) {
    console.error('Get dashboard metrics error:', error);
    res.status(500).json({ error: 'Failed to fetch dashboard metrics' });
  }
});

// GET /api/dashboard/sales-chart - Get sales chart data
router.get('/sales-chart', async (req, res) => {
  try {
    const { from, to } = req.query;
    const params = [];
    let dateFilter = '';
    
    if (from && to) {
      dateFilter = 'WHERE created_at BETWEEN $1 AND $2';
      params.push(from, to);
    }

    const result = await db.query(
      `SELECT 
        DATE(created_at) as date,
        COUNT(*) as sales_count,
        SUM(total_amount) as total_amount
       FROM sales
       ${dateFilter}
       GROUP BY DATE(created_at)
       ORDER BY date ASC`,
      params
    );

    res.json(result.rows);
  } catch (error) {
    console.error('Get sales chart error:', error);
    res.status(500).json({ error: 'Failed to fetch sales chart data' });
  }
});

// GET /api/dashboard/low-stock - Get low stock products
router.get('/low-stock', async (req, res) => {
  try {
    const result = await db.query(
      `SELECT id, name, stock_quantity, category, unit_price
       FROM products
       WHERE stock_quantity < 50 AND is_active = true
       ORDER BY stock_quantity ASC
       LIMIT 10`
    );

    res.json(result.rows);
  } catch (error) {
    console.error('Get low stock error:', error);
    res.status(500).json({ error: 'Failed to fetch low stock products' });
  }
});

module.exports = router;