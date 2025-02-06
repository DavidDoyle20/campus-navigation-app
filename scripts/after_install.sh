#!/usr/bin/env bash

# kill any servers that may be running in the background 
sudo pkill -f runserver

cd /home/ubuntu/campus-navigation-app/

# Update system and install GDAL dependencies
sudo apt-get update
sudo apt-get install -y gdal-bin libgdal-dev

# activate virtual environment
python3 -m venv venv
source venv/bin/activate

install requirements.txt
pip install -r /home/ubuntu/campus-navigation-app/requirements.txt

# run server
screen -d -m python3 manage.py runserver 0:8000