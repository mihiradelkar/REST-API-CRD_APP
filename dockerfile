# Use official Node.js image
FROM node:14-alpine

# Set working directory
WORKDIR /usr/src/app

# Copy package.json and install dependencies
COPY package.json ./
RUN npm install

# Copy application source code
COPY . .

# Expose API port
EXPOSE 3000

# Start the application
CMD ["node", "server.js"]
