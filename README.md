# Inventory Management Backend

A Node.js Express backend application for managing roles, permissions, and users with MySQL database.

## Project Structure

```
src/
├── config/           # Database configuration
├── models/           # Sequelize models (Role, User, RolePrivilege)
├── controllers/      # Request handlers
├── services/         # Business logic layer
├── routes/           # API route definitions
├── middleware/       # Authentication & error handling
├── utils/            # Utility functions
├── app.js            # Express app setup
└── server.js         # Server entry point
```

## Installation

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Create `.env` file** in the root directory:
   ```env
   DB_HOST=localhost
   DB_USER=root
   DB_PASSWORD=
   DB_NAME=inventory_db
   DB_PORT=3306
   JWT_SECRET=your_jwt_secret_key
   JWT_EXPIRY=7d
   NODE_ENV=development
   PORT=3000
   ```

3. **Create MySQL database:**
   ```sql
   CREATE DATABASE inventory_db;
   ```

## Running the Application

- **Development mode** (with hot reload):
  ```bash
  npm run dev
  ```

- **Production mode**:
  ```bash
  npm start
  ```

## API Endpoints

### Authentication & Users

- `POST /api/users/register` - Register a new user
- `POST /api/users/login` - Login user
- `GET /api/users` - Get all users (auth required)
- `GET /api/users/:id` - Get user by ID (auth required)
- `PUT /api/users/:id` - Update user (auth required)
- `DELETE /api/users/:id` - Delete user (auth required)

### Roles

- `POST /api/roles` - Create role (auth required)
- `GET /api/roles` - Get all roles (auth required)
- `GET /api/roles/:id` - Get role by ID (auth required)
- `PUT /api/roles/:id` - Update role (auth required)
- `DELETE /api/roles/:id` - Delete role (auth required)

### Health Check

- `GET /api/health` - Server health check

## Database Schema

### Roles Table
```sql
CREATE TABLE roles (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    role_name VARCHAR(50) NOT NULL UNIQUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    created_by BIGINT NULL,
    updated_by BIGINT NULL
);
```

### Role Privileges Table
```sql
CREATE TABLE role_privileges (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    role_id BIGINT NOT NULL,
    module VARCHAR(50) NOT NULL,
    module_group VARCHAR(50) DEFAULT 'GENERAL',
    sort_order INT DEFAULT 0,
    can_view TINYINT(1) DEFAULT 1,
    can_add TINYINT(1) DEFAULT 0,
    can_edit TINYINT(1) DEFAULT 0,
    can_delete TINYINT(1) DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    created_by BIGINT NULL,
    updated_by BIGINT NULL,
    FOREIGN KEY (role_id) REFERENCES roles(id),
    UNIQUE(role_id, module)
);
```

### Users Table
```sql
CREATE TABLE users (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    name VARCHAR(100) NOT NULL,
    mobile_number VARCHAR(15),
    email VARCHAR(150) NOT NULL UNIQUE,
    password VARCHAR(255) NOT NULL,
    role_id BIGINT NOT NULL,
    status ENUM('ACTIVE','INACTIVE') DEFAULT 'ACTIVE',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    created_by BIGINT NULL,
    updated_by BIGINT NULL,
    FOREIGN KEY (role_id) REFERENCES roles(id)
);
```

## Sample API Usage

### Register User
```bash
curl -X POST http://localhost:3000/api/users/register \
  -H "Content-Type: application/json" \
  -d '{
    "name": "John Doe",
    "email": "john@example.com",
    "password": "password123",
    "mobile_number": "1234567890",
    "role_id": 1
  }'
```

### Login
```bash
curl -X POST http://localhost:3000/api/users/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "john@example.com",
    "password": "password123"
  }'
```

## Features

- ✓ JWT-based authentication
- ✓ Role and permission management
- ✓ Password hashing with bcrypt
- ✓ Database relationship management
- ✓ Error handling middleware
- ✓ CORS enabled
- ✓ Security headers with Helmet
- ✓ Pagination support

## Technologies Used

- **Runtime:** Node.js
- **Framework:** Express.js
- **Database:** MySQL
- **ORM:** Sequelize
- **Authentication:** JWT
- **Password Hashing:** bcryptjs
- **Security:** Helmet, CORS
