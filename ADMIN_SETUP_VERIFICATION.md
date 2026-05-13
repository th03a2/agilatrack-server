# AgilaTrack Admin System - Manual Verification Guide

## 📋 Overview
This document provides step-by-step verification tests for the new safe admin and super admin account creation system.

## 🔐 Environment Setup

### 1. Add to your `.env` file:
```bash
# Super Admin Account Creation
SUPER_ADMIN_EMAIL=superadmin@agilatrack.com
SUPER_ADMIN_PASSWORD=YourSecurePassword123!
SUPER_ADMIN_FNAME=Super
SUPER_ADMIN_LNAME=Admin
```

## 🧪 Verification Tests

### Test 1: Public Registration Creates Guest Only
**Expected Result:** Public registration always creates guest users, regardless of request body

**Steps:**
1. Start server: `npm run dev`
2. Start client: `npm run dev`
3. Register a new user via the public registration form
4. Check the database or login and verify the user has `role: "guest"`

**Verification Commands:**
```bash
# Check user role in database
node -e "
import mongoose from 'mongoose';
import Users from './models/Users.js';
mongoose.connect(process.env.MONGO_URI);
Users.findOne({email: 'test@example.com'}).then(u => console.log('Role:', u.role));
"
```

**✅ Expected:** Role should be "guest"

---

### Test 2: Create First Super Admin
**Expected Result:** Script creates super admin account safely without overwriting existing users

**Steps:**
1. Run the super admin creation script:
```bash
npm run create:super-admin
```

**Expected Output:**
```
🔐 Connecting to MongoDB...
✅ Connected to MongoDB
🔍 Checking for existing super_admin...
🔒 Hashing password...
👤 Creating super admin account...
✅ Super admin account created successfully!
   Email: superadmin@agilatrack.com
   Name: Super Admin
   Role: super_admin
   Password: [HIDDEN - Check your .env file]
```

**Verification:**
```bash
# Verify super admin exists
node -e "
import mongoose from 'mongoose';
import Users from './models/Users.js';
mongoose.connect(process.env.MONGO_URI);
Users.findOne({role: 'super_admin'}).then(u => console.log('Super Admin:', u.email, u.role));
"
```

**✅ Expected:** Should show the super admin account

---

### Test 3: Super Admin Login
**Expected Result:** Super admin can login and access protected areas

**Steps:**
1. Go to login page
2. Use super admin credentials:
   - Email: `superadmin@agilatrack.com`
   - Password: `YourSecurePassword123!`
3. Verify successful login

**✅ Expected:** Successful authentication and dashboard access

---

### Test 4: Super Admin Can Create Admin
**Expected Result:** Super admin can create admin accounts via API

**Steps:**
1. Login as super admin and get auth token
2. Use the admin creation API:

```bash
curl -X POST http://localhost:5000/api/admin/users \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_SUPER_ADMIN_TOKEN" \
  -d '{
    "email": "admin@agilatrack.com",
    "password": "AdminPassword123!",
    "fname": "Test",
    "lname": "Admin",
    "mobile": "+639123456789"
  }'
```

**Expected Response:**
```json
{
  "success": true,
  "message": "Admin account created successfully",
  "payload": {
    "_id": "...",
    "email": "admin@agilatrack.com",
    "fullName": {
      "fname": "Test",
      "lname": "Admin"
    },
    "role": "admin",
    "membershipStatus": "active",
    "isActive": true,
    "createdAt": "..."
  }
}
```

**✅ Expected:** Admin account created with `role: "admin"`

---

### Test 5: Admin Cannot Create Super Admin
**Expected Result:** API rejects attempts to create super admin accounts

**Steps:**
1. Try to create super admin via API (even with super admin token):

```bash
curl -X POST http://localhost:5000/api/admin/users \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_SUPER_ADMIN_TOKEN" \
  -d '{
    "email": "bad@agilatrack.com",
    "password": "Password123!",
    "fname": "Bad",
    "lname": "Actor",
    "role": "super_admin"
  }'
```

**Expected Response:**
```json
{
  "success": false,
  "error": "Invalid role",
  "message": "Only admin role is allowed"
}
```

**✅ Expected:** Request rejected - only admin role allowed

---

### Test 6: Guest Cannot Access Admin Route
**Expected Result:** Unauthenticated/guest users cannot access admin API

**Steps:**
1. Try to access admin route without authentication:

```bash
curl -X POST http://localhost:5000/api/admin/users \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@agilatrack.com",
    "password": "Password123!",
    "fname": "Test",
    "lname": "User"
  }'
```

**Expected Response:**
```json
{
  "success": false,
  "error": "Authentication required",
  "message": "Please login to access this resource"
}
```

**✅ Expected:** 401 Unauthorized error

---

### Test 7: Regular Admin Cannot Access Admin Route
**Expected Result:** Admin users (not super_admin) cannot access admin creation API

**Steps:**
1. Login as regular admin user
2. Try to access admin creation API with admin token

```bash
curl -X POST http://localhost:5000/api/admin/users \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN" \
  -d '{
    "email": "test2@agilatrack.com",
    "password": "Password123!",
    "fname": "Test",
    "lname": "User"
  }'
```

**Expected Response:**
```json
{
  "success": false,
  "error": "Insufficient permissions",
  "message": "Only super admin can access this resource"
}
```

**✅ Expected:** 403 Forbidden error

---

### Test 8: Owner/Operator Cannot Access Admin Route
**Expected Result:** Owner and operator roles cannot access admin creation API

**Steps:**
1. Login as owner or operator user
2. Try to access admin creation API

**Expected Response:**
```json
{
  "success": false,
  "error": "Insufficient permissions",
  "message": "Only super admin can access this resource"
}
```

**✅ Expected:** 403 Forbidden error

---

## 🔍 Database Verification Commands

### Check All Users and Roles:
```bash
node -e "
import mongoose from 'mongoose';
import Users from './models/Users.js';
mongoose.connect(process.env.MONGO_URI);
Users.find({}, {email: 1, role: 1, fullName: 1}).then(users => {
  console.log('All Users:');
  users.forEach(u => console.log(\`- \${u.email}: \${u.role} (\${u.fullName.fname} \${u.fullName.lname})\`));
  process.exit(0);
});
"
```

### Count Users by Role:
```bash
node -e "
import mongoose from 'mongoose';
import Users from './models/Users.js';
mongoose.connect(process.env.MONGO_URI);
Users.aggregate([
  {\$group: {_id: '\$role', count: {\$sum: 1}}},
  {\$sort: {_id: 1}}
]).then(result => {
  console.log('Users by Role:');
  result.forEach(r => console.log(\`- \${r._id}: \${r.count}\`));
  process.exit(0);
});
"
```

---

## 🚨 Security Verification

### 1. Password Hashing
✅ All passwords are hashed using bcrypt with salt rounds (12)

### 2. Role Enforcement
✅ Public registration always creates guest users
✅ API only allows admin role creation
✅ Super admin is the only role that can create admins

### 3. Authentication Required
✅ Admin API requires valid JWT token
✅ Token verification before role checking

### 4. Safe Defaults
✅ Super admin script checks for existing super admin
✅ Never overwrites existing users
✅ Graceful error handling

---

## 📝 Test Results Summary

| Test | Expected | Actual | Status |
|------|----------|--------|---------|
| Public Registration = Guest | ✅ | | |
| Create Super Admin | ✅ | | |
| Super Admin Login | ✅ | | |
| Super Admin Creates Admin | ✅ | | |
| Admin Cannot Create Super Admin | ✅ | | |
| Guest Cannot Access Admin Route | ✅ | | |
| Admin Cannot Access Admin Route | ✅ | | |
| Owner/Operator Cannot Access Admin Route | ✅ | | |

**Fill in the "Actual" column as you run each test.**

---

## 🎯 Success Criteria

✅ **System is Secure**: Only super admin can create admins
✅ **Public Registration Safe**: Always creates guest users
✅ **Role Hierarchy Enforced**: Clear separation of permissions
✅ **No Frontend Exposure**: Admin creation is backend-only
✅ **Safe Defaults**: Cannot overwrite existing users
✅ **Proper Error Handling**: Clear error messages and status codes

---

## 🛠️ Troubleshooting

### Common Issues:

1. **"Super admin already exists"**
   - Check existing super admin in database
   - Use existing account or delete and recreate

2. **"Authentication required"**
   - Ensure you're sending valid JWT token
   - Check token format: "Bearer <token>"

3. **"Insufficient permissions"**
   - Verify user has `role: "super_admin"`
   - Check user is `isActive: true`

4. **"Email already exists"**
   - Use different email address
   - Check database for existing user

---

## 📞 Support

If you encounter issues:
1. Check server logs for detailed error messages
2. Verify MongoDB connection
3. Ensure all environment variables are set
4. Run database verification commands above
