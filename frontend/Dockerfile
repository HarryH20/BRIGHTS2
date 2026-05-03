# Build stage
FROM node:20-alpine AS build

WORKDIR /app

COPY package*.json ./
RUN npm install --legacy-peer-deps

COPY . .
RUN npm run build

# Production stage - serve with nginx
FROM nginx:alpine

COPY --from=build /app/dist /usr/share/nginx/html

# Place config in templates/ so nginx processes ${BACKEND_HOST} via envsubst on startup
COPY nginx.conf /etc/nginx/templates/default.conf.template

EXPOSE 80

HEALTHCHECK --interval=30s --timeout=3s \
    CMD wget -qO- http://localhost/ || exit 1

CMD ["nginx", "-g", "daemon off;"]
