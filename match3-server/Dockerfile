FROM node:18-alpine
WORKDIR /app
COPY package.json ./
RUN npm install --production --registry=https://registry.npmmirror.com
COPY . .
EXPOSE 80
CMD ["node", "index.js"]
