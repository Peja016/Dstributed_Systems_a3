# Client Dockerfile
FROM node:20-alpine
WORKDIR /app

# Install dependencies
COPY package.json ./
RUN npm install --production

# Copy application code
COPY client.js ./

# Expose port and run the app
EXPOSE 5000
CMD ["node", "client.js"]
