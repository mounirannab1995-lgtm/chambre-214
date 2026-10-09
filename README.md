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

## Atelier maintenance

L’accueil contient désormais un mode séparé **Atelier maintenance**, intégré à la même application Chambre 214. Il propose sept modules : tableau électrique de chambre, climatisation, chasse d’eau, fuite sous lavabo, eau chaude et douche thermostatique, serrure à carte et petits travaux hôteliers.

Chaque module comprend une partie Comprendre, une manipulation interactive avec prérequis, un quiz sécurité et un débrief. Les exercices principaux affichent un schéma animé et des zones cliquables : tableau avec coupure/condamnation/VAT, climatisation avec thermostat/filtre/condensats et chasse d’eau avec robinet/flotteur/clapet. Les autres modules utilisent également une scène de gestes cliquables. La progression est conservée dans le stockage local du navigateur et fonctionne hors connexion après le chargement de l’application. Le module électrique impose la logique **couper → condamner → vérifier au VAT** avant ouverture.

Cet atelier est un support pédagogique : il ne remplace ni une habilitation électrique, ni les procédures de l’hôtel, ni les notices fabricant, ni l’intervention d’une personne qualifiée.
