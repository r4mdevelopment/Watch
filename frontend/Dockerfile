FROM nginx:alpine

# Удаляем дефолтную html-папку nginx
RUN rm -rf /usr/share/nginx/html/*

# Копируем статику
COPY . /usr/share/nginx/html

# Пробрасываем порт
EXPOSE 80

# Nginx стартует автоматически через ENTRYPOINT
