# 🧪 Quick Test Guide - Imagomum Signup API

## 🚀 Getting Started

1. **Start the server**
   ```bash
   npm run dev
   ```
   Server will run on `http://localhost:3000`

2. **Test the health endpoint**
   ```bash
   curl http://localhost:3000/health
   ```

## 📱 Testing the Signup Flow

### Step 1: Create User Account

**Request:**
```bash
curl -X POST http://localhost:3000/api/v1/auth/signup \
  -H "Content-Type: application/json" \
  -d '{
    "fullName": "Warith Yellow",
    "email": "yellow@gmail.com",
    "phoneNumber": "909038303993",
    "password": "SecurePass123!",
    "confirmPassword": "SecurePass123!"
  }'
```

**Expected Response:**
```json
{
  "status": "success",
  "message": "Signup successful. OTP sent to your email and phone.",
  "data": {
    "userId": "some-uuid-here",
    "email": "yellow@gmail.com", 
    "phoneNumber": "909038303993",
    "otpSent": true,
    "otpExpiresAt": "2024-01-15T10:15:00Z"
  }
}
```

**Console Output (you'll see the OTP):**
```
📧 EMAIL OTP to yellow@gmail.com: 123456
📱 SMS OTP to 909038303993: 123456
```

### Step 2: Verify OTP

**Copy the OTP from the console and use it:**

```bash
curl -X POST http://localhost:3000/api/v1/auth/verify-otp \
  -H "Content-Type: application/json" \
  -d '{
    "email": "yellow@gmail.com",
    "otp": "123456"
  }'
```

**Expected Response:**
```json
{
  "status": "success",
  "message": "Account verified successfully",
  "data": {
    "user": {
      "id": "some-uuid-here",
      "fullName": "Warith Yellow",
      "email": "yellow@gmail.com",
      "phoneNumber": "909038303993",
      "isVerified": true
    },
    "tokens": {
      "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
      "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
      "expiresIn": "24h"
    }
  }
}
```

### Step 3: Test Login (Optional)

**Using the same credentials:**

```bash
curl -X POST http://localhost:3000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "yellow@gmail.com",
    "password": "SecurePass123!"
  }'
```

## 🔧 Testing Error Cases

### Invalid Email Format
```bash
curl -X POST http://localhost:3000/api/v1/auth/signup \
  -H "Content-Type: application/json" \
  -d '{
    "fullName": "Test User",
    "email": "invalid-email",
    "phoneNumber": "1234567890",
    "password": "SecurePass123!",
    "confirmPassword": "SecurePass123!"
  }'
```

### Password Mismatch
```bash
curl -X POST http://localhost:3000/api/v1/auth/signup \
  -H "Content-Type: application/json" \
  -d '{
    "fullName": "Test User",
    "email": "test@example.com",
    "phoneNumber": "1234567890",
    "password": "SecurePass123!",
    "confirmPassword": "DifferentPass123!"
  }'
```

### Invalid OTP
```bash
curl -X POST http://localhost:3000/api/v1/auth/verify-otp \
  -H "Content-Type: application/json" \
  -d '{
    "email": "yellow@gmail.com",
    "otp": "000000"
  }'
```

## 📋 Test Checklist

- [ ] Signup with valid data returns 201 and sends OTP
- [ ] Signup with duplicate email returns 409 error
- [ ] Signup with invalid email format returns 400 error
- [ ] Signup with weak password returns 400 error
- [ ] Password confirmation mismatch returns 400 error
- [ ] OTP verification with correct code returns 200 and tokens
- [ ] OTP verification with wrong code returns 401 error
- [ ] Login with verified account returns 200 and tokens
- [ ] Login with unverified account returns 401 error
- [ ] Resend OTP generates new code and updates expiry

## 🔍 Swagger Documentation

Access the interactive API documentation at:
**http://localhost:3000/api-docs**

## 💡 Tips

1. **OTP is printed to console** - Check your terminal for the 6-digit code
2. **OTP expires in 10 minutes** - Test expiry by waiting or manually changing the expiry time
3. **Users are stored in memory** - Restart the server to clear all test data
4. **JWT tokens are generated** - Use them in Authorization headers for protected routes

## 🐛 Common Issues

**Issue: CORS error**
- Solution: Make sure your client is running on an allowed origin (localhost:3000 or 3001)

**Issue: OTP not found in console**
- Solution: Check that the server is running and you're looking at the correct terminal

**Issue: Database connection error**
- Solution: This version uses in-memory storage, no database needed yet

**Issue: JWT secret error**
- Solution: Make sure your .env file has JWT_SECRET set

---

**Ready to test! 🚀** 