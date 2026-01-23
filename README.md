# Accounting & Inventory Management System - Backend API

Complete Node.js + Express + PostgreSQL backend implementation for the accounting system.

## 📋 Table of Contents

1. [Quick Start](#quick-start)
2. [Project Structure](#project-structure)
3. [Database Setup](#database-setup)
4. [API Endpoints](#api-endpoints)
5. [Frontend Integration](#frontend-integration)
6. [Deployment](#deployment)
7. [Security Best Practices](#security-best-practices)

---

## 🚀 Quick Start

### Prerequisites

- Node.js (v16 or higher)
- PostgreSQL (v13 or higher)
- npm or yarn

### Installation Steps

```bash
# 1. Create backend directory
mkdir accounting-backend
cd accounting-backend

# 2. Initialize npm project
npm init -y

# 3. Install dependencies
npm install express pg dotenv bcrypt jsonwebtoken cors helmet express-rate-limit express-validator morgan compression uuid

# 4. Install dev dependencies
npm install --save-dev nodemon

# 5. Copy all files from backend-documentation folder to accounting-backend

# 6. Create .env file (copy from .env.example)
cp .env.example .env

# 7. Edit .env with your database credentials
nano .env
```

### Database Setup

```bash
# 1. Create PostgreSQL database
psql -U postgres
CREATE DATABASE accounting_db;
\q

# 2. Run database schema
psql -U postgres -d accounting_db -f DATABASE_SCHEMA.sql

# 3. Verify tables created
psql -U postgres -d accounting_db
\dt
```

### Start the Server

```bash
# Development mode (with auto-reload)
npm run dev

# Production mode
npm start
```

Server will run on `http://localhost:5000`

---

## 📁 Project Structure

```
accounting-backend/
├── src/
│   ├── config/
│   │   └── database.js          # PostgreSQL connection pool
│   ├── middleware/
│   │   └── auth.middleware.js   # JWT authentication
│   ├── routes/
│   │   ├── auth.routes.js       # Authentication endpoints
│   │   ├── product.routes.js    # Product CRUD
│   │   ├── sales.routes.js      # Sales management
│   │   ├── purchase.routes.js   # Purchase management
│   │   ├── dashboard.routes.js  # Dashboard metrics
│   │   └── account.routes.js    # Accounts & payments
│   └── server.js                # Express app entry point
├── .env                         # Environment variables
├── .env.example                 # Environment template
├── package.json                 # Dependencies
├── DATABASE_SCHEMA.sql          # Database schema
└── README.md                    # This file
```

---

## 🗄️ Database Setup

### Connection Configuration

Edit `.env` file:

```env
DB_HOST=localhost
DB_PORT=5432
DB_NAME=accounting_db
DB_USER=postgres
DB_PASSWORD=your_password_here
```

### Database Schema

The `DATABASE_SCHEMA.sql` file includes:

- **8 Tables**: users, products, sales, sale_items, purchases, purchase_items, stock_history, login_activities
- **Indexes**: For optimized queries
- **Triggers**: Auto-update timestamps
- **Views**: Low stock alerts, pending payments, sales summary
- **Sample Data**: Default admin user and demo products

### Default Credentials

- **Username**: `admin`
- **Password**: `admin123`

⚠️ **IMPORTANT**: Change the default password in production!

---

## 🔌 API Endpoints

### Authentication

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| POST | `/api/auth/login` | User login | No |
| GET | `/api/auth/me` | Get current user | Yes |
| GET | `/api/auth/login-activities` | Get login history | Yes |

**Login Request:**
```json
POST /api/auth/login
{
  "username": "admin",
  "password": "admin123"
}
```

**Login Response:**
```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": "uuid",
    "username": "admin",
    "email": "admin@example.com",
    "role": "admin"
  }
}
```

### Products

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/products` | Get all products |
| GET | `/api/products/:id` | Get single product |
| POST | `/api/products` | Create product |
| PUT | `/api/products/:id` | Update product |
| DELETE | `/api/products/:id` | Delete product |
| GET | `/api/products/:id/stock-history` | Get stock history |

**Create Product Request:**
```json
POST /api/products
Headers: { "Authorization": "Bearer <token>" }
{
  "name": "Paracetamol 500mg",
  "mfgDate": "2024-01-01",
  "expDate": "2026-01-01",
  "stockQuantity": 500,
  "make": "PharmaCorp",
  "description": "Pain relief medication",
  "unitPrice": 5.00,
  "costPrice": 3.00,
  "category": "Medicine",
  "batchNumber": "BATCH001",
  "gstPercentage": 12.00,
  "notes": "Store in cool place"
}
```

### Sales

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/sales` | Get all sales |
| GET | `/api/sales/:id` | Get single sale |
| POST | `/api/sales` | Create sale |

**Create Sale Request:**
```json
POST /api/sales
Headers: { "Authorization": "Bearer <token>" }
{
  "invoiceNumber": "INV-001",
  "customerName": "John Doe",
  "customerMobile": "1234567890",
  "customerAddress": "123 Main St",
  "totalAmount": 150.00,
  "amountReceived": 100.00,
  "amountPending": 50.00,
  "paymentMode": "MIXED",
  "cashAmount": 50.00,
  "onlineAmount": 50.00,
  "dueDate": "2024-02-01",
  "status": "PARTIAL",
  "items": [
    {
      "productId": "uuid",
      "productName": "Paracetamol 500mg",
      "quantity": 10,
      "price": 5.00,
      "subtotal": 50.00
    }
  ]
}
```

### Purchases

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/purchases` | Get all purchases |
| POST | `/api/purchases` | Create purchase |

### Dashboard

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/dashboard/metrics` | Get dashboard metrics |
| GET | `/api/dashboard/sales-chart` | Get sales chart data |
| GET | `/api/dashboard/low-stock` | Get low stock products |

### Accounts

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/accounts/pending-payments` | Get all pending payments |
| GET | `/api/accounts/customer-outstanding` | Get customer outstanding |
| GET | `/api/accounts/supplier-outstanding` | Get supplier outstanding |

---

## 🔗 Frontend Integration

### Step 1: Create API Service

Create `/workspace/shadcn-ui/src/lib/api.ts`:

```typescript
import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add token to requests
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Handle 401 errors
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('token');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

export default api;
```

### Step 2: Update AuthContext

Replace localStorage calls in `AuthContext.tsx`:

```typescript
import api from '@/lib/api';

// Login function
const login = async (username: string, password: string) => {
  const response = await api.post('/auth/login', { username, password });
  const { token, user } = response.data;
  
  localStorage.setItem('token', token);
  setUser(user);
  setIsAuthenticated(true);
};
```

### Step 3: Update DataContext

Replace all localStorage operations with API calls:

```typescript
import api from '@/lib/api';

// Fetch products
const fetchProducts = async () => {
  const response = await api.get('/products');
  setProducts(response.data);
};

// Add product
const addProduct = async (product: Product) => {
  const response = await api.post('/products', product);
  setProducts([...products, response.data]);
};
```

### Step 4: Environment Variables

Create `/workspace/shadcn-ui/.env`:

```env
VITE_API_URL=http://localhost:5000/api
```

### Step 5: Install Axios

```bash
cd /workspace/shadcn-ui
pnpm add axios
```

---

## 🚀 Deployment

### Option 1: Deploy to Heroku

```bash
# 1. Install Heroku CLI
# 2. Login to Heroku
heroku login

# 3. Create app
heroku create accounting-backend

# 4. Add PostgreSQL addon
heroku addons:create heroku-postgresql:mini

# 5. Set environment variables
heroku config:set JWT_SECRET=your_secret_key
heroku config:set NODE_ENV=production

# 6. Deploy
git push heroku main

# 7. Run database migration
heroku pg:psql < DATABASE_SCHEMA.sql
```

### Option 2: Deploy to Railway

1. Go to [railway.app](https://railway.app)
2. Create new project
3. Add PostgreSQL database
4. Deploy from GitHub
5. Set environment variables
6. Run database migration

### Option 3: Deploy to DigitalOcean

1. Create a Droplet (Ubuntu 22.04)
2. Install Node.js and PostgreSQL
3. Clone repository
4. Install dependencies
5. Set up PM2 for process management
6. Configure Nginx as reverse proxy

---

## 🔒 Security Best Practices

### 1. Password Hashing

Update the default admin password hash in `DATABASE_SCHEMA.sql`:

```javascript
const bcrypt = require('bcrypt');
const hash = await bcrypt.hash('your_new_password', 10);
console.log(hash); // Use this in SQL
```

### 2. JWT Secret

Generate a strong JWT secret:

```bash
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
```

Add to `.env`:
```env
JWT_SECRET=<generated_secret>
```

### 3. CORS Configuration

Update `server.js` for production:

```javascript
app.use(cors({
  origin: 'https://your-frontend-domain.com',
  credentials: true
}));
```

### 4. Rate Limiting

Adjust rate limits in `.env`:

```env
RATE_LIMIT_WINDOW_MS=900000  # 15 minutes
RATE_LIMIT_MAX_REQUESTS=100  # Max 100 requests per window
```

### 5. Environment Variables

Never commit `.env` file. Always use environment-specific configurations.

### 6. SQL Injection Prevention

All queries use parameterized statements (already implemented).

### 7. HTTPS

Always use HTTPS in production. Configure SSL certificates with Let's Encrypt.

---

## 🧪 Testing

### Manual Testing with cURL

```bash
# Login
curl -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"admin123"}'

# Get products (replace <token> with actual token)
curl http://localhost:5000/api/products \
  -H "Authorization: Bearer <token>"
```

### Testing with Postman

1. Import API endpoints
2. Set up environment variables
3. Test all endpoints
4. Export collection for team

---

## 📝 Additional Notes

### Database Backup

```bash
# Backup
pg_dump -U postgres accounting_db > backup.sql

# Restore
psql -U postgres accounting_db < backup.sql
```

### Monitoring

Consider adding:
- Winston for logging
- Sentry for error tracking
- New Relic for performance monitoring

### Scaling

For high traffic:
- Use connection pooling (already implemented)
- Add Redis for caching
- Use read replicas for PostgreSQL
- Implement horizontal scaling with load balancer

---

## 🆘 Troubleshooting

### Connection Refused

Check if PostgreSQL is running:
```bash
sudo systemctl status postgresql
```

### Port Already in Use

Change port in `.env`:
```env
PORT=5001
```

### Database Connection Error

Verify credentials:
```bash
psql -U postgres -d accounting_db
```

---

## 📧 Support

For issues or questions:
1. Check the troubleshooting section
2. Review API documentation
3. Check database logs
4. Contact your development team

---

**🎉 Your backend is now ready for production!**

Next steps:
1. Test all API endpoints
2. Integrate with frontend
3. Deploy to production
4. Set up monitoring
5. Configure backups