#!/usr/bin/env bash

# clean codedeploy-agent files for a fresh install
sudo rm -rf /home/ubuntu/install

# install CodeDeploy agent
sudo apt-get -y update
sudo apt install -y python3-pip python3-venv nginx
sudo apt-get -y install ruby
sudo apt-get -y install wget
cd /home/ubuntu
wget https://aws-codedeploy-us-east-1.s3.amazonaws.com/latest/install
sudo chmod +x ./install 
sudo ./install auto

# update os & install python3
sudo apt-get update
sudo apt-get install -y \
    python3 python3-dev python3-pip python3-venv
    # gdal-bin libgdal-dev python3-gdal

# delete app
sudo rm -rf /home/ubuntu/campus-navigation-app
