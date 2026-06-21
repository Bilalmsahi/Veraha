# Use Node.js LTS version (20)
FROM node:20-alpine

# Create app directory
WORKDIR /usr/src/app

# Copy package files
COPY package*.json ./

# Install dependencies (production only)
RUN npm ci --only=production

# Copy application source code
COPY src/ ./src/

# Create uploads directory for file storage
RUN mkdir -p uploads

# Expose the port (matches your server default: 5000)
EXPOSE 5000

# Set NODE_ENV to production
ENV NODE_ENV=production

# Start the application
CMD [ "npm", "start" ]