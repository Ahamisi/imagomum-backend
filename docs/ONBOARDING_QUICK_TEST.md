# 🧪 Quick Test Guide - Onboarding Flow

## 🚀 **Prerequisites**

1. **Server running**: `npm run dev`
2. **User account created and verified**: Complete signup + OTP verification
3. **Access token**: From login or OTP verification response

## 📋 **Test Scenarios**

### **Scenario 1: First-time User Onboarding**

#### **Step 1: Check Onboarding Status**
```bash
curl -X GET http://localhost:3000/api/v1/onboarding/status \
  -H "Authorization: Bearer <your_access_token>"
```

**Expected Response:**
```json
{
  "status": "success",
  "data": {
    "isCompleted": false,
    "currentStep": 0,
    "totalSteps": 1,
    "currentQuestion": {
      "id": "lmp_date",
      "title": "Let's personalize your pregnancy care.",
      "question": "When was your last period?"
    }
  }
}
```

#### **Step 2A: Submit Exact LMP Date (Like "26-06-2025" in your app)**
```bash
curl -X POST http://localhost:3000/api/v1/onboarding/submit \
  -H "Authorization: Bearer <your_access_token>" \
  -H "Content-Type: application/json" \
  -d '{
    "questionId": "lmp_date",
    "answerType": "exact_date",
    "answer": "2024-06-26"
  }'
```

**Expected Response (Success Screen Data):**
```json
{
  "status": "success",
  "message": "Onboarding completed successfully!",
  "data": {
    "isCompleted": true,
    "pregnancyInfo": {
      "edd": "2025-04-02",
      "eddFormatted": "April 02, 2025",
      "gestationalAge": "7 weeks",
      "gestationalWeeks": 7,
      "trimester": "1st Trimester"
    }
  }
}
```

#### **Step 2B: OR Submit Approximate Month (If user clicks "Not sure?")**
```bash
curl -X POST http://localhost:3000/api/v1/onboarding/submit \
  -H "Authorization: Bearer <your_access_token>" \
  -H "Content-Type: application/json" \
  -d '{
    "questionId": "lmp_date",
    "answerType": "approximate_month",
    "answer": {
      "month": 6,
      "year": 2024
    }
  }'
```

#### **Step 3: Verify User Profile Now Includes Pregnancy Info**
```bash
curl -X GET http://localhost:3000/api/v1/users/profile \
  -H "Authorization: Bearer <your_access_token>"
```

**Expected Response:**
```json
{
  "status": "success",
  "data": {
    "user": {
      "id": "...",
      "fullName": "Warith Yellow",
      "email": "yellow@gmail.com",
      "onboarding": {
        "isCompleted": true,
        "currentStep": 1,
        "completedAt": "2025-01-28T19:30:15Z"
      },
      "pregnancyInfo": {
        "edd": "2025-04-02",
        "eddFormatted": "April 02, 2025",
        "gestationalAge": "7 weeks",
        "gestationalWeeks": 7,
        "trimester": "1st Trimester"
      }
    }
  }
}
```

---

### **Scenario 2: User Returns After Onboarding**

When a user logs in after completing onboarding:

```bash
curl -X POST http://localhost:3000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "yellow@gmail.com",
    "password": "SecurePass123!"
  }'
```

**Expected Response Includes Onboarding Status:**
```json
{
  "status": "success",
  "message": "Login successful",
  "data": {
    "user": {
      "onboarding": {
        "isCompleted": true,
        "currentStep": 1
      },
      "pregnancyInfo": {
        "gestationalAge": "7 weeks",
        "trimester": "1st Trimester",
        "eddFormatted": "April 02, 2025"
      }
    }
  }
}
```

---

### **Scenario 3: User Wants to Update Pregnancy Info**

#### **Restart Onboarding:**
```bash
curl -X POST http://localhost:3000/api/v1/onboarding/restart \
  -H "Authorization: Bearer <your_access_token>"
```

#### **Then Submit New LMP Date:**
```bash
curl -X POST http://localhost:3000/api/v1/onboarding/submit \
  -H "Authorization: Bearer <your_access_token>" \
  -H "Content-Type: application/json" \
  -d '{
    "questionId": "lmp_date",
    "answerType": "exact_date",
    "answer": "2024-07-15"
  }'
```

---

## 🧮 **Pregnancy Calculation Examples**

### **Example 1: Early Pregnancy**
- **LMP**: `2024-12-01`
- **Today**: `2025-01-28`
- **Result**: 
  - Gestational Age: `8 weeks, 1 day`
  - Trimester: `1st Trimester`
  - EDD: `September 07, 2025`

### **Example 2: Second Trimester**
- **LMP**: `2024-08-01`  
- **Today**: `2025-01-28`
- **Result**:
  - Gestational Age: `25 weeks, 3 days`
  - Trimester: `2nd Trimester`
  - EDD: `May 08, 2025`

### **Example 3: Third Trimester**
- **LMP**: `2024-05-01`
- **Today**: `2025-01-28`
- **Result**:
  - Gestational Age: `38 weeks, 4 days`
  - Trimester: `3rd Trimester`
  - EDD: `February 05, 2025`

---

## 🎯 **Mobile App Success Screen Test**

To match your app's success screen showing:
- **Pregnancy Stage**: "7 weeks"
- **Current trimester**: "1st Trimester"
- **Expected Due date**: "January 08, 2026"

**Use this LMP date:**
```bash
curl -X POST http://localhost:3000/api/v1/onboarding/submit \
  -H "Authorization: Bearer <your_access_token>" \
  -H "Content-Type: application/json" \
  -d '{
    "questionId": "lmp_date",
    "answerType": "exact_date",
    "answer": "2024-03-26"
  }'
```

This will calculate approximately 7 weeks and EDD around January 2026.

---

## ⚠️ **Error Testing**

### **Invalid Date (Future Date)**
```bash
curl -X POST http://localhost:3000/api/v1/onboarding/submit \
  -H "Authorization: Bearer <your_access_token>" \
  -H "Content-Type: application/json" \
  -d '{
    "questionId": "lmp_date",
    "answerType": "exact_date",
    "answer": "2025-12-01"
  }'
```

**Expected Error:**
```json
{
  "status": "fail",
  "message": "Validation failed",
  "errors": [
    {
      "field": "answer",
      "message": "LMP date cannot be in the future"
    }
  ]
}
```

### **Invalid Month**
```bash
curl -X POST http://localhost:3000/api/v1/onboarding/submit \
  -H "Authorization: Bearer <your_access_token>" \
  -H "Content-Type: application/json" \
  -d '{
    "questionId": "lmp_date",
    "answerType": "approximate_month",
    "answer": {
      "month": 13,
      "year": 2024
    }
  }'
```

---

## 📊 **Check Server Logs**

Look for these events in your console:

```
[info]: SYSTEM_EVENT USER_ONBOARDING_COMPLETED {
  "event": "USER_ONBOARDING_COMPLETED",
  "userId": "...",
  "email": "yellow@gmail.com",
  "pregnancyInfo": {
    "gestationalWeeks": 7,
    "trimester": "1st Trimester",
    "edd": "2025-04-02"
  }
}
```

---

## ✅ **Complete Test Checklist**

- [ ] User can check onboarding status
- [ ] User can submit exact LMP date
- [ ] User can submit approximate month
- [ ] Pregnancy calculations are correct
- [ ] Onboarding completion updates user profile
- [ ] Login includes onboarding status
- [ ] User can restart onboarding
- [ ] Invalid dates are rejected
- [ ] Invalid months are rejected
- [ ] Server logs onboarding events

---

**🚀 Ready to test the complete onboarding flow!** 