# Use Node.js 18 LTS
FROM node:18-alpine

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production

# Copy source code
COPY . .

# Create uploads directory
RUN mkdir -p uploads/ultrasounds

# Expose port
EXPOSE 8080

# Set environment to production
ENV NODE_ENV=production
ENV PORT=8080

# Run pending migrations, then start. Safe with min=max=1 (no concurrent
# migrators); migrations are idempotent so restarts just no-op.
CMD ["sh", "-c", "node_modules/.bin/sequelize-cli db:migrate && node src/server.js"]
