# Backend Documentation

> **Workspace-resident documentation for all agents**

**Status**: ✅ Ready to Use | **Last Updated**: May 16, 2026

---

## 🎯 Quick Overview

- **Framework**: NestJS 10.x
- **Database**: MongoDB with Mongoose ODM
- **Auth**: JWT + RolesGuard (admin protection)
- **Port**: 8080
- **API Base**: http://localhost:8080/api/v1

---

## 🚀 Start Backend

```bash
cd /Users/misanthropic/codebase/fixxer-backend
npm run start:dev        # Development (hot reload)
```

---

## 📁 Key Directories

```
fixxer-backend/
├── src/
│   ├── main.ts                           ← Bootstrap (starts on port 8080)
│   ├── app.module.ts                     ← Root module (imports all features)
│   ├── app.controller.ts                 ← Root endpoints
│   ├── app.service.ts
│   ├── appliances/                       ← AC FEATURE (Phase 5 ✅)
│   │   ├── appliance.schema.ts           ← MongoDB schema (14 fields)
│   │   ├── appliance.dto.ts              ← CreateDto, UpdateDto, FilterDto
│   │   ├── appliances.service.ts         ← Business logic (CRUD, filtering, sorting)
│   │   ├── appliances.controller.ts      ← 4 REST endpoints
│   │   └── appliances.module.ts          ← Module registration
│   ├── services/                         ← Services catalog
│   ├── bookings/                         ← Service bookings
│   ├── spare-parts/                      ← Spare parts catalog
│   ├── part-orders/                      ← Part ordering
│   ├── users/                            ← User management
│   ├── technicians/                      ← Technician management
│   ├── auth/                             ← JWT authentication
│   │   ├── auth.service.ts               ← Token generation & verification
│   │   ├── auth.controller.ts            ← Login/register endpoints
│   │   ├── guards/                       ← RolesGuard, JwtAuthGuard
│   │   ├── strategies/                   ← JWT strategy
│   │   └── decorators/                   ← Custom decorators
│   ├── visits/                           ← Service visit management
│   ├── warranties/                       ← Warranty management
│   ├── admin/                            ← Admin operations
│   └── search/                           ← Search functionality
├── test/
│   ├── app.e2e-spec.ts                  ← End-to-end tests
│   └── jest-e2e.json                    ← Jest config for E2E
├── docker-compose.yml                    ← MongoDB container setup
├── seed*.js                              ← Database seeding scripts
├── nest-cli.json                         ← NestJS CLI config
├── tsconfig.json                         ← TypeScript config
├── package.json                          ← Scripts & dependencies
└── .env                                  ← Environment variables
```

---

## 🔧 Available Scripts

```bash
npm run start:dev        # Development (hot reload on port 8080)
npm run start            # Production mode
npm run build            # Compile TypeScript
npm run lint             # ESLint check
npm run test             # Unit tests
npm run test:e2e         # End-to-end tests
```

---

## 🗄️ Database Setup

### Start MongoDB

```bash
docker-compose up -d     # Start MongoDB in background
docker ps               # Verify running (port 27017)
```

### Seed Database

```bash
node seed.js                    # Full seed (all data)
node seed-admin.js              # Admin users only
node seed-services.js           # Services catalog only
node seed-spare-parts-v2.js     # Spare parts & AC appliances
```

### Stop MongoDB

```bash
docker-compose down
```

---

## 🎯 AC Appliances Feature

### REST Endpoints

**Public Endpoints**

```
GET    /api/v1/appliances/ac
       Query params: capacity, rating, type, priceMin, priceMax, sort, page, limit
       Returns: { data: [], total, page, limit, pages }

GET    /api/v1/appliances/ac/:slug
       Example: /api/v1/appliances/ac/godrej-1-5t-5s-inverter-split
       Returns: Single appliance object
```

**Admin Endpoints** (Protected by JwtAuthGuard + RolesGuard)

```
POST   /api/v1/appliances/ac
       Body: CreateApplianceDto
       Returns: Created appliance object

PUT    /api/v1/appliances/ac/:slug
       Body: UpdateApplianceDto
       Returns: Updated appliance object
```

### Database Schema (appliance.schema.ts)

```typescript
{
  _id: ObjectId
  capacity: number              // 0.75, 1, 1.5, 1.8, 2, 2.5, 3
  type: string                  // "Inverter" | "Non-Inverter"
  variant: string               // "Split" | "Window"
  rating: number                // 3-5
  price: number                 // Current price in ₹
  discountPercent: number       // % discount
  originalPrice: number         // MRP
  brand: string                 // "Godrej"
  model: string                 // Model number
  specs: {
    energyRating: string
    coolingCapacity: string
    noiseLevel: number
  }
  installation: {
    cost: number
    duration: string
    availability: string
  }
  warranty: {
    manufacturerYears: number
    fixxerYears: number
  }
  image: string                 // Main image URL
  images: string[]              // 4 gallery images
  description: string
  inStock: boolean
  slug: string                  // URL-friendly ID
  createdAt: Date
  updatedAt: Date
}
```

### Service Methods (appliances.service.ts)

```typescript
async findAll(filterDto: FilterApplianceDto): Promise<{
  data: Appliance[]
  total: number
  page: number
  limit: number
  pages: number
}>
// Features: Filtering, sorting, pagination

async findBySlug(slug: string): Promise<Appliance>
// Get single product

async create(createDto: CreateApplianceDto): Promise<Appliance>
// Create new (admin only)

async update(slug: string, updateDto: UpdateApplianceDto): Promise<Appliance>
// Update (admin only)
```

### DTOs

```typescript
CreateApplianceDto {
  capacity, type, variant, rating, price, discountPercent, originalPrice,
  brand, model, specs, installation, warranty, image, images, description, inStock
}

UpdateApplianceDto {
  // All fields optional (same as Create)
}

FilterApplianceDto {
  capacity?: number | number[]
  rating?: number | number[]
  type?: string | string[]
  priceMin?: number
  priceMax?: number
  inStock?: boolean
  sort?: 'newest' | 'price_asc' | 'price_desc' | 'rating'
  page?: number
  limit?: number
}
```

### Seeded Data

**7 Godrej AC Products**:

- 0.75T to 3T capacities
- 3-5 star ratings
- ₹18,900 to ₹55,000 prices
- Mixed Inverter/Non-Inverter types
- All Split variants

---

## 🔐 Authentication & Authorization

### JWT Authentication

- Strategy: Bearer token in `Authorization` header
- Stored in: `auth/strategies/jwt.strategy.ts`
- Guard: `@UseGuards(JwtAuthGuard)`

### Role-Based Access

- Guard: `@UseGuards(JwtAuthGuard, RolesGuard)`
- Decorator: `@Roles('admin')`
- Roles: 'admin', 'user', 'technician'

### Example - Admin Protected Endpoint

```typescript
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin')
@Post('ac')
create(@Body() createDto: CreateApplianceDto) {
  return this.appliancesService.create(createDto)
}
```

---

## 🧪 Testing

### Unit Tests

```bash
npm run test
```

### E2E Tests

```bash
npm run test:e2e
```

### Manual API Testing

```bash
# List all ACs
curl http://localhost:8080/api/v1/appliances/ac

# Filter by capacity
curl "http://localhost:8080/api/v1/appliances/ac?capacity=1.5"

# Get single AC
curl http://localhost:8080/api/v1/appliances/ac/godrej-1-5t-5s-inverter-split

# With sorting
curl "http://localhost:8080/api/v1/appliances/ac?sort=price_asc"
```

---

## ⚠️ Important Notes

1. **Environment Variables**: Create `.env` file with database connection
2. **MongoDB Required**: Must be running (docker-compose up -d)
3. **Seeding**: Always seed database with `node seed.js` for test data
4. **Hot Reload**: `npm run start:dev` watches file changes
5. **JWT Secret**: Store in `.env` file (never commit)
6. **CORS**: Frontend at http://localhost:3001 should be allowed
7. **API Response**: All endpoints return standardized JSON response

---

## 🔗 Integration with Frontend

### Frontend Calls Backend at

```
http://localhost:8080
(Configured in: fixxer/app/config.ts)
```

### Frontend AC Pages Call

```
GET /api/v1/appliances/ac                    (Listing)
GET /api/v1/appliances/ac/:slug              (Detail)
```

### Frontend Enquiry Form Submits To

```
POST /api/v1/part-orders or /api/v1/bookings
(Depending on product type)
```

---

## 📊 Module Structure

### app.module.ts (Root)

```typescript
Imports:
  - AppliancesModule       ← AC FEATURE
  - ServicesModule
  - BookingsModule
  - SparePartsModule
  - UsersModule
  - TechniciansModule
  - AuthModule
  - ...
```

### appliances.module.ts

```typescript
Imports: -MongooseModule.forFeature([ApplianceSchema]) -
  AuthModule -
  PassportModule;

Providers: -AppliancesService - AppliancesController;

Exports: -AppliancesService;
```

---

## 🧹 Troubleshooting

### MongoDB Connection Error

```bash
# Start MongoDB
docker-compose up -d

# Check running
docker ps | grep mongo
```

### Port 8080 Already in Use

```bash
kill -9 $(lsof -i :8080 | grep LISTEN | awk '{print $2}')
```

### TypeScript Compilation Error

```bash
npm run build               # Try rebuild
npm cache clean --force    # Clear cache
rm -rf node_modules        # Reinstall
npm install
```

### No Data in API Response

```bash
# Reseed database
node seed.js
```

---

## 📚 Related Documentation

- Main Workspace Context: `/WORKSPACE_CONTEXT.md` (root)
- Quick Start Commands: `/QUICK_START.md` (root)
- Frontend Docs: `../fixxer/FRONTEND_DOCUMENTATION.md`
- Full Workspace Map: See memory files if available

---

## 🎯 Development Workflow

1. Start MongoDB: `docker-compose up -d`
2. Start backend: `npm run start:dev`
3. Check health: `curl http://localhost:8080`
4. Make changes to any file in `src/`
5. Backend auto-reloads (hot reload)
6. Test API: `curl http://localhost:8080/api/v1/appliances/ac`
7. Frontend will call this backend endpoint

---

**This file is workspace-permanent and agent-independent.**
