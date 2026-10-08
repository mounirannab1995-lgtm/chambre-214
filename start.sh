#!/usr/bin/env sh
set -eu
cd "$(dirname "$0")"
echo "Ouvre http://localhost:8080 sur cet ordinateur."
echo "Pour le téléphone connecté au même Wi-Fi, utilise l'adresse IP de cet ordinateur : http://ADRESSE-IP:8080"
python3 -m http.server 8080 --bind 0.0.0.0
