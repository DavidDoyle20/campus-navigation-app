#!/bin/bash
cd /home/ubuntu/campus-navigation-app
source venv/bin/activate
gunicorn campusnavigationapp.wsgi:application --bind 0.0.0.0:8000 --daemon
sudo systemctl restart nginx
