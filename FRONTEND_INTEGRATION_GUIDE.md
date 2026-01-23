# Frontend Integration Guide

Complete guide to integrate the Node.js backend with your React frontend.

## 📋 Overview

This guide will help you replace localStorage with API calls in your existing React application.

---

## Step 1: Install Dependencies

```bash
cd /workspace/shadcn-ui
pnpm add axios
```

---

## Step 2: Create API Service

Create `/workspace/shadcn-ui/src/lib/api.ts`:

```typescript
import axios, { AxiosError } from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 10000,
});

// Request interceptor - Add JWT token
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor - Handle errors
api.interceptors.response.use(
  (response) => response,
  (error: AxiosError) => {
    if (error.response?.status === 401) {
      // Token expired or invalid
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

export default api;

// API Service Functions
export const authAPI = {
  login: (username: string, password: string) =>
    api.post('/auth/login', { username, password }),
  
  getCurrentUser: () =>
    api.get('/auth/me'),
  
  getLoginActivities: () =>
    api.get('/auth/login-activities'),
};

export const productAPI = {
  getAll: (params?: { active?: boolean; category?: string; search?: string }) =>
    api.get('/products', { params }),
  
  getById: (id: string) =>
    api.get(`/products/${id}`),
  
  create: (product: any) =>
    api.post('/products', product),
  
  update: (id: string, product: any) =>
    api.put(`/products/${id}`, product),
  
  delete: (id: string) =>
    api.delete(`/products/${id}`),
  
  getStockHistory: (id: string) =>
    api.get(`/products/${id}/stock-history`),
};

export const salesAPI = {
  getAll: (params?: { status?: string; from?: string; to?: string }) =>
    api.get('/sales', { params }),
  
  getById: (id: string) =>
    api.get(`/sales/${id}`),
  
  create: (sale: any) =>
    api.post('/sales', sale),
};

export const purchaseAPI = {
  getAll: (params?: { status?: string; from?: string; to?: string }) =>
    api.get('/purchases', { params }),
  
  create: (purchase: any) =>
    api.post('/purchases', purchase),
};

export const dashboardAPI = {
  getMetrics: (params?: { from?: string; to?: string }) =>
    api.get('/dashboard/metrics', { params }),
  
  getSalesChart: (params?: { from?: string; to?: string }) =>
    api.get('/dashboard/sales-chart', { params }),
  
  getLowStock: () =>
    api.get('/dashboard/low-stock'),
};

export const accountAPI = {
  getPendingPayments: () =>
    api.get('/accounts/pending-payments'),
  
  getCustomerOutstanding: () =>
    api.get('/accounts/customer-outstanding'),
  
  getSupplierOutstanding: () =>
    api.get('/accounts/supplier-outstanding'),
};
```

---

## Step 3: Update AuthContext

Replace `/workspace/shadcn-ui/src/contexts/AuthContext.tsx`:

```typescript
import React, { createContext, useContext, useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { authAPI } from '@/lib/api';
import { User, LoginActivity } from '@/lib/types';

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  login: (username: string, password: string) => Promise<void>;
  logout: () => void;
  loginActivities: LoginActivity[];
  isLoading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [loginActivities, setLoginActivities] = useState<LoginActivity[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const navigate = useNavigate();

  // Check if user is already logged in
  useEffect(() => {
    const token = localStorage.getItem('token');
    if (token) {
      loadUser();
    } else {
      setIsLoading(false);
    }
  }, []);

  const loadUser = async () => {
    try {
      const response = await authAPI.getCurrentUser();
      setUser(response.data);
      setIsAuthenticated(true);
      
      // Load login activities
      const activitiesResponse = await authAPI.getLoginActivities();
      setLoginActivities(activitiesResponse.data);
    } catch (error) {
      console.error('Failed to load user:', error);
      localStorage.removeItem('token');
    } finally {
      setIsLoading(false);
    }
  };

  const login = async (username: string, password: string) => {
    try {
      const response = await authAPI.login(username, password);
      const { token, user: userData } = response.data;

      localStorage.setItem('token', token);
      setUser(userData);
      setIsAuthenticated(true);

      navigate('/');
    } catch (error: any) {
      console.error('Login failed:', error);
      throw new Error(error.response?.data?.error || 'Login failed');
    }
  };

  const logout = () => {
    localStorage.removeItem('token');
    setUser(null);
    setIsAuthenticated(false);
    setLoginActivities([]);
    navigate('/login');
  };

  if (isLoading) {
    return <div>Loading...</div>;
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated,
        login,
        logout,
        loginActivities,
        isLoading,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
};
```

---

## Step 4: Update DataContext

Replace `/workspace/shadcn-ui/src/contexts/DataContext.tsx`:

```typescript
import React, { createContext, useContext, useState, useEffect } from 'react';
import { productAPI, salesAPI, purchaseAPI, dashboardAPI } from '@/lib/api';
import { Product, Sale, Purchase, DashboardMetrics } from '@/lib/types';
import { useAuth } from './AuthContext';

interface DataContextType {
  products: Product[];
  sales: Sale[];
  purchases: Purchase[];
  dashboardMetrics: DashboardMetrics | null;
  isLoading: boolean;
  
  // Product methods
  fetchProducts: () => Promise<void>;
  addProduct: (product: Omit<Product, 'id' | 'createdAt' | 'updatedAt'>) => Promise<void>;
  updateProduct: (id: string, product: Partial<Product>) => Promise<void>;
  deleteProduct: (id: string) => Promise<void>;
  
  // Sales methods
  fetchSales: (filters?: { status?: string; from?: string; to?: string }) => Promise<void>;
  addSale: (sale: Omit<Sale, 'id' | 'createdAt'>) => Promise<void>;
  
  // Purchase methods
  fetchPurchases: (filters?: { status?: string; from?: string; to?: string }) => Promise<void>;
  addPurchase: (purchase: Omit<Purchase, 'id' | 'createdAt'>) => Promise<void>;
  
  // Dashboard methods
  fetchDashboardMetrics: (filters?: { from?: string; to?: string }) => Promise<void>;
}

const DataContext = createContext<DataContextType | undefined>(undefined);

export const DataProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isAuthenticated } = useAuth();
  const [products, setProducts] = useState<Product[]>([]);
  const [sales, setSales] = useState<Sale[]>([]);
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [dashboardMetrics, setDashboardMetrics] = useState<DashboardMetrics | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // Fetch all data on mount
  useEffect(() => {
    if (isAuthenticated) {
      fetchProducts();
      fetchSales();
      fetchPurchases();
      fetchDashboardMetrics();
    }
  }, [isAuthenticated]);

  // Product methods
  const fetchProducts = async () => {
    try {
      setIsLoading(true);
      const response = await productAPI.getAll({ active: true });
      setProducts(response.data);
    } catch (error) {
      console.error('Failed to fetch products:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const addProduct = async (product: Omit<Product, 'id' | 'createdAt' | 'updatedAt'>) => {
    try {
      const response = await productAPI.create(product);
      setProducts([...products, response.data]);
    } catch (error) {
      console.error('Failed to add product:', error);
      throw error;
    }
  };

  const updateProduct = async (id: string, product: Partial<Product>) => {
    try {
      const response = await productAPI.update(id, product);
      setProducts(products.map((p) => (p.id === id ? response.data : p)));
    } catch (error) {
      console.error('Failed to update product:', error);
      throw error;
    }
  };

  const deleteProduct = async (id: string) => {
    try {
      await productAPI.delete(id);
      setProducts(products.filter((p) => p.id !== id));
    } catch (error) {
      console.error('Failed to delete product:', error);
      throw error;
    }
  };

  // Sales methods
  const fetchSales = async (filters?: { status?: string; from?: string; to?: string }) => {
    try {
      setIsLoading(true);
      const response = await salesAPI.getAll(filters);
      setSales(response.data);
    } catch (error) {
      console.error('Failed to fetch sales:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const addSale = async (sale: Omit<Sale, 'id' | 'createdAt'>) => {
    try {
      const response = await salesAPI.create(sale);
      setSales([response.data, ...sales]);
      
      // Refresh products to update stock
      await fetchProducts();
    } catch (error) {
      console.error('Failed to add sale:', error);
      throw error;
    }
  };

  // Purchase methods
  const fetchPurchases = async (filters?: { status?: string; from?: string; to?: string }) => {
    try {
      setIsLoading(true);
      const response = await purchaseAPI.getAll(filters);
      setPurchases(response.data);
    } catch (error) {
      console.error('Failed to fetch purchases:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const addPurchase = async (purchase: Omit<Purchase, 'id' | 'createdAt'>) => {
    try {
      const response = await purchaseAPI.create(purchase);
      setPurchases([response.data, ...purchases]);
    } catch (error) {
      console.error('Failed to add purchase:', error);
      throw error;
    }
  };

  // Dashboard methods
  const fetchDashboardMetrics = async (filters?: { from?: string; to?: string }) => {
    try {
      const response = await dashboardAPI.getMetrics(filters);
      setDashboardMetrics(response.data);
    } catch (error) {
      console.error('Failed to fetch dashboard metrics:', error);
    }
  };

  return (
    <DataContext.Provider
      value={{
        products,
        sales,
        purchases,
        dashboardMetrics,
        isLoading,
        fetchProducts,
        addProduct,
        updateProduct,
        deleteProduct,
        fetchSales,
        addSale,
        fetchPurchases,
        addPurchase,
        fetchDashboardMetrics,
      }}
    >
      {children}
    </DataContext.Provider>
  );
};

export const useData = () => {
  const context = useContext(DataContext);
  if (!context) {
    throw new Error('useData must be used within DataProvider');
  }
  return context;
};
```

---

## Step 5: Environment Configuration

Create `/workspace/shadcn-ui/.env`:

```env
VITE_API_URL=http://localhost:5000/api
```

Create `/workspace/shadcn-ui/.env.production`:

```env
VITE_API_URL=https://your-backend-domain.com/api
```

---

## Step 6: Update Type Definitions

Update `/workspace/shadcn-ui/src/lib/types.ts` to match backend response format:

```typescript
// Keep existing types but ensure they match backend camelCase conversion
// The backend returns snake_case from PostgreSQL, so you may need to add
// transformation logic in the API service or use a library like humps
```

---

## Step 7: Testing

### Start Backend Server

```bash
cd accounting-backend
npm run dev
```

### Start Frontend

```bash
cd /workspace/shadcn-ui
pnpm run dev
```

### Test Login

1. Open http://localhost:5173
2. Login with username: `admin`, password: `admin123`
3. Verify data loads from backend

---

## Step 8: Handle Loading States

Update components to show loading indicators:

```typescript
import { useData } from '@/contexts/DataContext';

function ProductList() {
  const { products, isLoading } = useData();

  if (isLoading) {
    return <div>Loading products...</div>;
  }

  return (
    <div>
      {products.map(product => (
        <div key={product.id}>{product.name}</div>
      ))}
    </div>
  );
}
```

---

## Step 9: Error Handling

Add error boundaries and toast notifications:

```typescript
import { toast } from 'sonner';

const addProduct = async (product: Product) => {
  try {
    await productAPI.create(product);
    toast.success('Product added successfully');
  } catch (error: any) {
    toast.error(error.response?.data?.error || 'Failed to add product');
  }
};
```

---

## 🎉 Integration Complete!

Your frontend is now connected to the Node.js + PostgreSQL backend.

### Next Steps:

1. Remove all localStorage imports and usage
2. Test all CRUD operations
3. Add error handling for network failures
4. Implement optimistic UI updates
5. Add loading skeletons
6. Set up production environment variables

---

## 🐛 Troubleshooting

### CORS Error

Update backend `server.js`:
```javascript
app.use(cors({
  origin: 'http://localhost:5173',
  credentials: true
}));
```

### 401 Unauthorized

Check if token is being sent:
```javascript
console.log(localStorage.getItem('token'));
```

### Network Error

Verify backend is running:
```bash
curl http://localhost:5000/health
```