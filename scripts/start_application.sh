#!/bin/bash
cd /home/ubuntu/campus-navigation-app
source venv/bin/activate

# Stop existing Gunicorn process
pkill gunicorn

# Start Gunicorn
gunicorn campusnavigationapp.wsgi:application --bind 0.0.0.0:8000 --daemon

# Restart Nginx
sudo systemctl restart nginx
