@echo off
cd /d "%~dp0"
echo Ouvre http://localhost:8080 sur cet ordinateur.
echo Pour le telephone sur le meme Wi-Fi, utilise l'adresse IP de cet ordinateur : http://ADRESSE-IP:8080
py -m http.server 8080 --bind 0.0.0.0
