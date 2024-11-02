# Use official Node.js image
FROM node:18-alpine

# Set working directory
WORKDIR /usr/src/app

# Copy package.json and package-lock.json, then install dependencies
COPY package*.json ./

RUN npm install

# Copy the application source code
COPY . .

# Set environment variable to production
ENV NODE_ENV=production

# Expose API port
EXPOSE 3000

# Start the application
CMD ["node", "server.js"]
