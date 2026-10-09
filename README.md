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

Le module électrique (onglet Manipuler) montre une seule installation en cascade, sur trois niveaux reliés par un fil d’Ariane : **Hôtel** (TGBT : général Q0, départs Q1 à Q4), **Étage 2** (tableau d’étage : interrupteur général, départ A pour les chambres 212 et 214, départ B pour la 216 et la 218, éclairage du couloir, prises de service) et **Chambre 214** (relais du porte-carte, différentiel 30 mA, disjoncteurs éclairage, prises et clim). Chaque schéma suit la même règle : le tableau à gauche, ce qu’il alimente à droite ; le courant est animé en orange, ce qui est coupé est en gris pointillé, et les blocs de secours s’allument quand une zone perd le courant. Chaque niveau indique où se trouve le tableau, qui peut y intervenir et ce qu’on y voit, et chaque coupure est expliquée.

Les gestes de consignation se vérifient sur ce même schéma : couper le différentiel de la chambre ne suffit pas (les bornes d’arrivée restent sous tension), il faut couper en amont et au plus près (départ A), poser le cadenas sur l’appareil coupé, puis vérifier au VAT aux bornes d’arrivée. Les calibres sont des valeurs d’exemple : il s’agit d’un plan pédagogique générique, pas du schéma réel d’un hôtel particulier.

Cet atelier est un support pédagogique : il ne remplace ni une habilitation électrique, ni les procédures de l’hôtel, ni les notices fabricant, ni l’intervention d’une personne qualifiée.

## Mode Démontage

L’accueil propose aussi un mode **Démontage** (« Voir, démonter, régler »), codé dans le fichier séparé `demontage.js`. Trois appareils y sont dessinés en vue en coupe animée, avec des pastilles numérotées : on touche une pièce pour lire son rôle, voir son état et la manipuler.

- **Chasse d’eau** : réservoir posé sur la cuvette, mécanisme double chasse à cloche. Le cycle complet est animé (cloche, vidange, flotteur, robinet flotteur, remplissage, trop-plein). On ferme le robinet d’arrêt, on dévisse la bague du bouton, on soulève le couvercle, on dépose le mécanisme d’un quart de tour, on ouvre la tête du robinet flotteur. Réglages : hauteur de la butée du flotteur, volume de la petite chasse. Réparations : joint de cloche (nettoyage ou remplacement), filtre et membrane du robinet flotteur, test au colorant.
- **Climatisation** : le ventilo-convecteur du jeu (faux plafond, installation 2 tubes). Thermostat (mode, consigne, ventilation), filtre, ventilateur, batterie, purgeur d’air, vanne et servomoteur, bac à condensats, pompe de relevage et son tuyau. Ouverture dans l’ordre (arrêt, escabeau, grille, trappe) et consignation avant le boîtier électrique (disjoncteur, cadenas, VAT).
- **Tableau électrique** : porte-carte et relais, différentiel 30 mA avec bouton test, disjoncteurs éclairage, prises et clim, appareils à brancher. On voit le courant circuler, la surcharge faire chauffer le bilame, le différentiel couper sur un défaut d’isolement et le court-circuit couper instantanément.

Les gestes dangereux ou dans le mauvais ordre sont refusés avec une explication. Chaque appareil propose une **Panne surprise** (vue réelle : on ne voit l’intérieur qu’après avoir ouvert) ou une panne précise à observer en coupe. Une liste de contrôle indique ce qu’il reste à faire pour clore l’intervention ; les pannes qui ne relèvent pas du technicien (pompe de relevage, bâtiment en chauffage) se sécurisent puis se signalent au responsable. Le temps est accéléré.
