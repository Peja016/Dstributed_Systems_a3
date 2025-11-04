# Backend Dockerfile
FROM node:20-alpine
WORKDIR /app

# Install dependencies
COPY package.json ./
RUN npm install --production

# Copy application code
COPY server.js ./

# Expose port and run the app
EXPOSE 5001
CMD ["node", "server.js"]
