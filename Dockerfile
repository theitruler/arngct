FROM nginx:stable-alpine

COPY nginx.conf /etc/nginx/conf.d/default.conf

# Copy only the public website into the document root.
COPY *.html *.ico *.png *.jpeg /usr/share/nginx/html/
COPY css/ /usr/share/nginx/html/css/
COPY js/ /usr/share/nginx/html/js/
COPY assets/ /usr/share/nginx/html/assets/
COPY adminlogin/ /usr/share/nginx/html/adminlogin/
COPY sanitarypad/ /usr/share/nginx/html/sanitarypad/

# Fail the build if the web server configuration is invalid.
RUN nginx -t

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
    CMD wget -q -O /dev/null http://127.0.0.1:3000/sanitarypad || exit 1
