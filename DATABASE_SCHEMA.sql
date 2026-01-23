-- ============================================
-- PostgreSQL Database Schema
-- Accounting & Inventory Management System
-- ============================================

-- Drop existing tables if they exist (for clean setup)
DROP TABLE IF EXISTS login_activities CASCADE;
DROP TABLE IF EXISTS stock_history CASCADE;
DROP TABLE IF EXISTS purchase_items CASCADE;
DROP TABLE IF EXISTS purchases CASCADE;
DROP TABLE IF EXISTS sale_items CASCADE;
DROP TABLE IF EXISTS sales CASCADE;
DROP TABLE IF EXISTS products CASCADE;
DROP TABLE IF EXISTS users CASCADE;

-- ============================================
-- USERS TABLE
-- ============================================
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    username VARCHAR(50) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    email VARCHAR(100),
    role VARCHAR(20) DEFAULT 'admin' CHECK (role IN ('admin', 'staff')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- ============================================
-- PRODUCTS TABLE
-- ============================================
CREATE TABLE products (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    mfg_date DATE NOT NULL,
    exp_date DATE NOT NULL,
    stock_quantity INTEGER NOT NULL DEFAULT 0 CHECK (stock_quantity >= 0),
    make VARCHAR(100) NOT NULL,
    description TEXT,
    unit_price DECIMAL(10, 2) NOT NULL CHECK (unit_price >= 0),
    cost_price DECIMAL(10, 2) DEFAULT 0 CHECK (cost_price >= 0),
    category VARCHAR(100),
    batch_number VARCHAR(50),
    gst_percentage DECIMAL(5, 2) DEFAULT 0 CHECK (gst_percentage >= 0 AND gst_percentage <= 100),
    notes TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- ============================================
-- SALES TABLE
-- ============================================
CREATE TABLE sales (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    invoice_number VARCHAR(50) UNIQUE NOT NULL,
    customer_name VARCHAR(255) NOT NULL,
    customer_mobile VARCHAR(20),
    customer_address TEXT,
    total_amount DECIMAL(10, 2) NOT NULL CHECK (total_amount >= 0),
    amount_received DECIMAL(10, 2) NOT NULL CHECK (amount_received >= 0),
    amount_pending DECIMAL(10, 2) NOT NULL CHECK (amount_pending >= 0),
    payment_mode VARCHAR(20) NOT NULL CHECK (payment_mode IN ('CASH', 'ONLINE', 'MIXED')),
    cash_amount DECIMAL(10, 2) CHECK (cash_amount >= 0),
    online_amount DECIMAL(10, 2) CHECK (online_amount >= 0),
    due_date TIMESTAMP WITH TIME ZONE,
    status VARCHAR(20) NOT NULL CHECK (status IN ('PAID', 'PARTIAL', 'PENDING')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    settled_at TIMESTAMP WITH TIME ZONE
);

-- ============================================
-- SALE_ITEMS TABLE
-- ============================================
CREATE TABLE sale_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sale_id UUID NOT NULL REFERENCES sales(id) ON DELETE CASCADE,
    product_id UUID REFERENCES products(id) ON DELETE SET NULL,
    product_name VARCHAR(255) NOT NULL,
    quantity INTEGER NOT NULL CHECK (quantity > 0),
    price DECIMAL(10, 2) NOT NULL CHECK (price >= 0),
    subtotal DECIMAL(10, 2) NOT NULL CHECK (subtotal >= 0)
);

-- ============================================
-- PURCHASES TABLE
-- ============================================
CREATE TABLE purchases (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    supplier_name VARCHAR(255) NOT NULL,
    invoice_number VARCHAR(50) UNIQUE NOT NULL,
    purchase_date DATE NOT NULL,
    total_amount DECIMAL(10, 2) NOT NULL CHECK (total_amount >= 0),
    amount_paid DECIMAL(10, 2) NOT NULL CHECK (amount_paid >= 0),
    amount_pending DECIMAL(10, 2) NOT NULL CHECK (amount_pending >= 0),
    payment_mode VARCHAR(20) NOT NULL CHECK (payment_mode IN ('CASH', 'ONLINE', 'CREDIT')),
    due_date TIMESTAMP WITH TIME ZONE,
    status VARCHAR(20) NOT NULL CHECK (status IN ('PAID', 'PARTIAL', 'PENDING')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    settled_at TIMESTAMP WITH TIME ZONE
);

-- ============================================
-- PURCHASE_ITEMS TABLE
-- ============================================
CREATE TABLE purchase_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    purchase_id UUID NOT NULL REFERENCES purchases(id) ON DELETE CASCADE,
    item_name VARCHAR(255) NOT NULL,
    quantity INTEGER NOT NULL CHECK (quantity > 0),
    price DECIMAL(10, 2) NOT NULL CHECK (price >= 0),
    subtotal DECIMAL(10, 2) NOT NULL CHECK (subtotal >= 0)
);

-- ============================================
-- STOCK_HISTORY TABLE
-- ============================================
CREATE TABLE stock_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    quantity_added INTEGER NOT NULL,
    date TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    notes TEXT
);

-- ============================================
-- LOGIN_ACTIVITIES TABLE
-- ============================================
CREATE TABLE login_activities (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    login_time TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    ip_address VARCHAR(45),
    user_agent TEXT,
    success BOOLEAN DEFAULT true
);

-- ============================================
-- INDEXES FOR PERFORMANCE
-- ============================================
CREATE INDEX idx_products_active ON products(is_active);
CREATE INDEX idx_products_stock ON products(stock_quantity);
CREATE INDEX idx_products_category ON products(category);
CREATE INDEX idx_sales_status ON sales(status);
CREATE INDEX idx_sales_created ON sales(created_at DESC);
CREATE INDEX idx_sales_customer ON sales(customer_name);
CREATE INDEX idx_purchases_status ON purchases(status);
CREATE INDEX idx_purchases_created ON purchases(created_at DESC);
CREATE INDEX idx_purchases_supplier ON purchases(supplier_name);
CREATE INDEX idx_sale_items_sale ON sale_items(sale_id);
CREATE INDEX idx_sale_items_product ON sale_items(product_id);
CREATE INDEX idx_purchase_items_purchase ON purchase_items(purchase_id);
CREATE INDEX idx_stock_history_product ON stock_history(product_id);
CREATE INDEX idx_stock_history_date ON stock_history(date DESC);
CREATE INDEX idx_login_activities_user ON login_activities(user_id);
CREATE INDEX idx_login_activities_time ON login_activities(login_time DESC);

-- ============================================
-- TRIGGERS FOR UPDATED_AT
-- ============================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_products_updated_at BEFORE UPDATE ON products
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- SEED DATA (Default Admin User)
-- ============================================
-- Password: admin123 (hashed with bcrypt)
INSERT INTO users (username, password_hash, email, role) 
VALUES ('admin', '$2b$10$rKvVXqQYQjQxQjQxQjQxQeO8YvYvYvYvYvYvYvYvYvYvYvYvYvY', 'admin@example.com', 'admin');

-- ============================================
-- SAMPLE DATA (Optional - for testing)
-- ============================================
-- Insert sample products
INSERT INTO products (name, mfg_date, exp_date, stock_quantity, make, description, unit_price, cost_price, category, batch_number, gst_percentage) VALUES
('Paracetamol 500mg', '2024-01-01', '2026-01-01', 500, 'PharmaCorp', 'Pain relief medication', 5.00, 3.00, 'Medicine', 'BATCH001', 12.00),
('Vitamin C Tablets', '2024-02-01', '2026-02-01', 300, 'HealthPlus', 'Immunity booster', 15.00, 10.00, 'Supplements', 'BATCH002', 12.00),
('Antiseptic Cream', '2024-03-01', '2025-12-01', 200, 'MediCare', 'Topical antiseptic', 25.00, 18.00, 'First Aid', 'BATCH003', 18.00);

-- ============================================
-- VIEWS FOR REPORTING
-- ============================================
CREATE OR REPLACE VIEW vw_low_stock_products AS
SELECT 
    id,
    name,
    stock_quantity,
    category,
    unit_price,
    make
FROM products
WHERE stock_quantity < 50 AND is_active = true
ORDER BY stock_quantity ASC;

CREATE OR REPLACE VIEW vw_pending_payments AS
SELECT 
    'SALE' as type,
    id,
    invoice_number,
    customer_name as party_name,
    amount_pending,
    due_date,
    created_at
FROM sales
WHERE status IN ('PENDING', 'PARTIAL')
UNION ALL
SELECT 
    'PURCHASE' as type,
    id,
    invoice_number,
    supplier_name as party_name,
    amount_pending,
    due_date,
    created_at
FROM purchases
WHERE status IN ('PENDING', 'PARTIAL')
ORDER BY due_date ASC;

CREATE OR REPLACE VIEW vw_sales_summary AS
SELECT 
    DATE(created_at) as sale_date,
    COUNT(*) as total_sales,
    SUM(total_amount) as total_revenue,
    SUM(amount_received) as total_received,
    SUM(amount_pending) as total_pending
FROM sales
GROUP BY DATE(created_at)
ORDER BY sale_date DESC;