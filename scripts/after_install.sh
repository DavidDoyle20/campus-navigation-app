#!/usr/bin/env bash

# kill any servers that may be running in the background 
sudo pkill -f runserver

cd /home/ubuntu/campus-navigation-app/

# activate virtual environment
python3 -m venv venv
source venv/bin/activate

# Install requirements with GDAL first
pip install --no-cache-dir "GDAL==$GDAL_VERSION.*"
pip install -r /home/ubuntu/campus-navigation-app/requirements.txt

# Configure GDAL paths
export CPLUS_INCLUDE_PATH=/usr/include/gdal
export C_INCLUDE_PATH=/usr/include/gdal
GDAL_VERSION=$(gdal-config --version | awk -F'[.]' '{print $1"."$2}')


# Django setup
python manage.py migrate

# run server
screen -d -m python3 manage.py runserver 0:8000