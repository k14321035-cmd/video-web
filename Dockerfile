FROM node:18
WORKDIR /usr/src/app
COPY package*.json ./
RUN npm install
COPY . .
EXPOSE 3000
# Run DB init then start server
CMD ["sh", "-c", "node db-init.js && node server.js"]
