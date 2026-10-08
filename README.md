# Chambre 214 — entraînement maintenance

## Lancer sur ordinateur

1. Installe Python 3 si nécessaire.
2. Double-clique sur `start.bat` sous Windows, ou lance `./start.sh` sous Linux/macOS.
3. Ouvre `http://localhost:8080`.

Le fichier HTML peut aussi être ouvert directement, mais le mode installable et le mode hors connexion nécessitent le petit serveur local.

## Utiliser sur téléphone

L’ordinateur et le téléphone doivent être sur le même Wi-Fi.

1. Lance le serveur sur l’ordinateur.
2. Trouve l’adresse IP locale de l’ordinateur :
   - Windows : `ipconfig`
   - Linux/macOS : `ip addr` ou `ifconfig`
3. Sur le téléphone, ouvre `http://ADRESSE-IP:8080`.

Depuis le navigateur du téléphone, ajoute ensuite la page à l’écran d’accueil. Le manifest et le service worker permettent l’utilisation hors connexion après le premier chargement lorsque le navigateur l’autorise.

## Sécurité pédagogique

La simulation impose maintenant la sélection réelle de l’outil avant l’action. Elle bloque les interventions électriques dangereuses sous tension, notamment le remplacement de la réglette LED, et n’affiche dans le bon d’intervention que la cause correspondant à la panne tirée.

Cette application reste un entraînement au raisonnement. Elle ne remplace pas une habilitation électrique, les procédures de l’hôtel, ni une intervention réelle encadrée.
