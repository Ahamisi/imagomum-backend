# Imagomum Backend

**Ultrasound Interpretation & Care Coordination Platform**

Transform maternal healthcare with seamless coordination and AI-powered diagnostics – driving faster, smarter care for mothers and healthcare providers.

## 🚀 Features

- **Dual User System**: Support for both mothers and healthcare providers
- **AI-Powered Diagnostics**: Ultrasound image analysis and interpretation
- **Care Coordination**: Seamless communication between patients and doctors
- **Secure Medical Data**: HIPAA-compliant data handling and encryption
- **Real-time Notifications**: Instant updates on appointments and results
- **Comprehensive API**: RESTful endpoints with OpenAPI documentation

## 🏗️ Architecture

- **Backend**: Node.js with Express.js
- **Database**: PostgreSQL with Sequelize ORM
- **Authentication**: JWT-based authentication with refresh tokens
- **File Storage**: Cloudinary for ultrasound images
- **Caching**: Redis for session management and caching
- **Logging**: Winston with structured logging
- **Documentation**: Swagger/OpenAPI 3.0

## 📋 Prerequisites

- Node.js (v18.0.0 or higher)
- npm (v8.0.0 or higher)
- PostgreSQL (v13 or higher)
- Redis (optional, for caching)

## 🔧 Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd imagomum-be
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Environment Configuration**
   ```bash
   cp .env.example .env
   ```
   
   Configure the following environment variables:
   ```env
   # Server Configuration
   NODE_ENV=development
   PORT=3000
   
   # Database Configuration
   DB_HOST=localhost
   DB_PORT=5432
   DB_NAME=imagomum_dev
   DB_USERNAME=imagomum_user
   DB_PASSWORD=your_secure_password
   
   # Authentication
   JWT_SECRET=your_super_secure_jwt_secret_here
   JWT_EXPIRES_IN=24h
   
   # Add other required environment variables...
   ```

4. **Database Setup**
   ```bash
   # Create database
   createdb imagomum_dev
   
   # Run migrations
   npm run migrate
   
   # Seed database (optional)
   npm run seed
   ```

5. **Start Development Server**
   ```bash
   npm run dev
   ```

The server will start on `http://localhost:3000`

## 📚 API Documentation

Once the server is running, access the interactive API documentation at:
- **Swagger UI**: `http://localhost:3000/api-docs`
- **API Base**: `http://localhost:3000/api/v1`

## 🔐 Authentication

The API uses JWT-based authentication with refresh tokens:

1. **Signup**: `POST /api/v1/auth/signup`
2. **Login**: `POST /api/v1/auth/login`
3. **Refresh Token**: `POST /api/v1/auth/refresh`
4. **Logout**: `POST /api/v1/auth/logout`

Include the JWT token in the Authorization header:
```
Authorization: Bearer <your-jwt-token>
```

## 👥 User Types

### Mothers
- Upload ultrasound images
- View analysis results
- Schedule appointments with doctors
- Receive care recommendations

### Doctors
- Review ultrasound interpretations
- Manage patient appointments
- Provide care recommendations
- Access patient medical history

## 🏥 Core Endpoints

### Authentication
- `POST /api/v1/auth/signup` - User registration
- `POST /api/v1/auth/login` - User login
- `POST /api/v1/auth/verify-email` - Email verification
- `POST /api/v1/auth/forgot-password` - Password reset request
- `POST /api/v1/auth/reset-password` - Password reset

### Users
- `GET /api/v1/users/profile` - Get user profile
- `PUT /api/v1/users/profile` - Update user profile

### Ultrasounds
- `POST /api/v1/ultrasounds` - Upload ultrasound image
- `GET /api/v1/ultrasounds` - Get user's ultrasounds
- `GET /api/v1/ultrasounds/:id` - Get specific ultrasound

### Appointments
- `POST /api/v1/appointments` - Schedule appointment
- `GET /api/v1/appointments` - Get user's appointments
- `PUT /api/v1/appointments/:id` - Update appointment

## 🧪 Testing

```bash
# Run tests
npm test

# Run tests in watch mode
npm run test:watch

# Run tests with coverage
npm run test:coverage
```

## 📊 Monitoring & Logging

### Health Check
```bash
GET /health
```

### Logs
- Application logs: `logs/combined.log`
- Error logs: `logs/error.log`
- System events are logged with structured data

## 🔒 Security Features

- **Helmet.js**: Security headers
- **Rate Limiting**: API rate limiting
- **CORS**: Configurable cross-origin requests
- **Input Validation**: Express-validator for request validation
- **Password Hashing**: bcrypt with salt rounds
- **Medical Data Encryption**: Encrypted sensitive medical data
- **Audit Logging**: Security event logging

## 🚀 Deployment

### Production Build
```bash
npm run build
npm start
```

### Environment Variables
Ensure all production environment variables are configured:
- Database connection strings
- JWT secrets (different from development)
- Third-party API keys (Cloudinary, email service)
- SSL configuration

### Database Migrations
```bash
NODE_ENV=production npm run migrate
```

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📄 License

This project is proprietary software. All rights reserved.

## 📞 Support

For support and questions, please contact the Imagomum development team.

---

**Built with ❤️ for maternal healthcare** 