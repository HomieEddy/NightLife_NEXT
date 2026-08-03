# Politique de confidentialité

**NightLifeNext — En vigueur : [DATE]**
**Dernière mise à jour : 2026-08-03**
**Statut : [ÉBAUCHE — révision juridique requise avant publication]**

La présente politique de confidentialité décrit comment NightLifeNext (« nous »,
« notre », « nos ») collecte, utilise, divulgue et conserve les renseignements
personnels dans le cadre de notre plateforme d'exploitation de discothèques.
Elle est conforme à la Loi sur la protection des renseignements personnels dans
le secteur privé du Québec (Loi 25) et à la Loi fédérale sur la protection des
renseignements personnels et les documents électroniques (LPRPDE).

---

## 1. Qui nous sommes

NightLifeNext est une plateforme logicielle-service (SaaS) pour l'exploitation
de discothèques — gestion des tables, commandes, réservations, coordination
d'étage et CRM clientèle — fournie aux exploitants de salles (nos clients).
La présente politique couvre la plateforme elle-même. Chaque établissement
qui utilise la plateforme est un responsable de traitement distinct pour les
données des clients et du personnel qu'il collecte via la plateforme ; nous
agissons en tant que sous-traitant pour ces renseignements.

**Responsable de la protection des renseignements personnels :** [NOM] — [COURRIEL]  
Contactez cette personne pour toute question relative à la vie privée, demande
d'accès ou plainte.

---

## 2. Ce que nous collectons et pourquoi

Nous collectons le minimum de renseignements nécessaires au fonctionnement de
la plateforme. Nous n'utilisons pas de traceurs publicitaires, de scripts
d'analyse tiers ni de témoins non essentiels.

### 2.1 Renseignements que vous fournissez

| Catégorie | Exemples | Finalité |
|---|---|---|
| **Comptes du personnel** | Nom, courriel, téléphone, rôle | Authentification, autorisation, planification, soutien à la paie |
| **Profils clients** | Nom, courriel, téléphone, année de naissance, préférences, photo (facultative) | Gestion des réservations, service aux tables, programmes VIP, sécurité |
| **Réservations** | Nom du client, courriel, téléphone, taille du groupe, date | Réservation de table et confirmation |
| **Admissions à la porte** | Vérification d'identité (contrôle d'âge), taille du groupe, heure d'entrée | Vérification de l'âge légal pour consommer, gestion de la capacité, sécurité |
| **Prospects commerciaux** | Nom, courriel, téléphone, nom de l'établissement, ville | Réponse aux demandes de démonstration |

### 2.2 Renseignements collectés automatiquement

| Catégorie | Exemples | Finalité |
|---|---|---|
| **Données de session** | Jetons de connexion, adresse IP, agent utilisateur | Authentification, sécurité, limitation de débit |
| **Journaux d'erreurs** | Traces d'exécution, métadonnées de requête (renseignements personnels supprimés avant envoi) | Diagnostic et résolution d'erreurs |

### 2.3 Renseignements que nous ne collectons PAS

- Données de carte de paiement (traitées par Stripe — jamais sur nos serveurs)
- Géolocalisation précise
- Historique de navigation entre sites
- Identifiants publicitaires
- Témoins au-delà de ce que la mécanique de session exige (témoin de session
  d'authentification, témoin de préférence linguistique, témoin de session
  client — tous strictement nécessaires)

---

## 3. Comment nous les utilisons

Toute collecte a un fondement légal en vertu de la Loi 25 et de la LPRPDE :

- **Nécessité contractuelle :** fourniture des services de la plateforme —
  authentification, traitement des commandes, gestion des réservations,
  attribution des tables, planification du personnel.
- **Obligation légale :** vérification de l'âge (permis d'alcool),
  documentation des incidents (sécurité au travail), registres fiscaux et
  d'emploi (droit du travail québécois).
- **Intérêt légitime :** surveillance de la sécurité, prévention de la fraude,
  analyses agrégées pour les exploitants, amélioration du service.
- **Consentement :** communications marketing, photos des clients, fonctionnalités
  promotionnelles. Vous pouvez retirer votre consentement en tout temps en
  contactant le responsable de la protection des renseignements personnels.

Le consentement marketing des clients (courriel et SMS) est stocké par profil
et peut être géré par l'établissement ou par le client sur demande.

---

## 4. Avec qui nous les partageons

Nous partageons les renseignements personnels uniquement lorsque nécessaire :

| Destinataire | Quoi | Pourquoi |
|---|---|---|
| **L'établissement avec lequel vous interagissez** | Vos commandes, réservations, profil | L'établissement est le responsable de traitement pour les données clients et personnel — notre plateforme est l'outil qu'il utilise |
| **Stripe** | Traitement des paiements | Vos données de carte vont directement à Stripe ; nous ne les recevons ni ne les stockons |
| **Resend** | Envoi de courriels | Courriels transactionnels et de notification |
| **Sentry (Functional Software Inc.)** | Contexte d'erreur dépersonnalisé | Diagnostic d'erreurs — les renseignements personnels sont supprimés avant l'envoi à Sentry, hébergé aux États-Unis |
| **OVHcloud** | Toutes les données de la plateforme | Hébergement de l'infrastructure à Beauharnois, Québec, Canada |

Nous ne vendons PAS les renseignements personnels. Nous ne les partageons pas
avec des courtiers de données, des annonceurs ni aucun tiers non listé ci-dessus.

---

## 5. Durée de conservation

La conservation est régie par notre [Inventaire des données et calendrier de conservation](/DATA-INVENTORY.md) :

- **Sessions clients :** anonymisées 90 jours après la fermeture (les noms et
  liens de profil sont supprimés ; les agrégats financiers sont conservés pour
  les analyses de l'établissement).
- **Réservations :** champs personnels anonymisés 6 mois après la finalisation.
- **Dossiers du personnel :** conservés pendant la durée de l'emploi plus 3 ans
  (minimum requis par le droit du travail québécois).
- **Registres d'incidents :** 3 ans standard, 7 ans si déclarables aux autorités.
- **Profils clients inactifs :** supprimés 24 mois après la dernière visite, à
  moins qu'une demande d'effacement antérieure ne soit reçue.
- **Sauvegardes :** quotidiennes pendant 7 jours, hebdomadaires pendant 4
  semaines, mensuelles pendant 12 mois. Les renseignements individuels ne
  peuvent pas être retirés des fichiers de sauvegarde — la suppression affecte
  la base de données active ; les copies de sauvegarde expirent selon le
  calendrier indiqué.

Le calendrier complet de conservation avec le détail par catégorie de données
est publié dans l'[Inventaire des données et calendrier de conservation](/DATA-INVENTORY.md).

---

## 6. Vos droits

En vertu de la Loi 25 et de la LPRPDE, vous avez le droit de :

- **Accès :** savoir quels renseignements personnels nous détenons à votre sujet.
- **Rectification :** corriger les renseignements inexacts ou incomplets.
- **Effacement :** demander la suppression de vos renseignements personnels,
  sous réserve des obligations légales de conservation (p. ex., paiements en
  cours, enquêtes actives, registres d'emploi obligatoires).
- **Portabilité :** recevoir vos renseignements dans un format structuré et
  couramment utilisé.
- **Retrait du consentement :** pour tout traitement fondé sur le consentement
  (marketing, photos).
- **Plainte :** auprès de la Commission d'accès à l'information du Québec (CAI)
  ou du Commissariat à la protection de la vie privée du Canada si vous croyez
  que vos droits ont été violés.

Pour exercer ces droits, contactez le responsable de la protection des
renseignements personnels à **[COURRIEL]**. Nous répondrons dans un délai de
30 jours, comme l'exige la Loi 25. Vous pourriez devoir vérifier votre identité
avant que nous puissions traiter votre demande.

---

## 7. Sécurité

Nous mettons en œuvre des mesures techniques et organisationnelles pour
protéger les renseignements personnels :

- **Chiffrement :** toutes les données en transit (TLS 1.3) et au repos
  (stockage PostgreSQL chiffré).
- **Contrôle d'accès :** accès basé sur les rôles (gérant, hôte, barman,
  coureur, sécurité) appliqué au niveau applicatif ; les administrateurs de
  la plateforme n'ont accès qu'aux données opérationnelles nécessaires au
  soutien.
- **Isolation des locataires :** chaque requête à la base de données est
  limitée par établissement — les données de l'établissement A ne sont pas
  accessibles depuis le contexte de l'établissement B.
- **Journalisation d'audit :** les actions administratives et les opérations
  sensibles sont journalisées avec l'identité de l'acteur.
- **Réponse aux incidents :** nous tenons un registre des atteintes et une
  procédure de réponse aux incidents (publiée dans notre manuel opérationnel).
  En cas d'atteinte à la confidentialité présentant un risque de préjudice
  sérieux, nous aviserons la CAI et les personnes concernées conformément à
  la Loi 25.

---

## 8. Témoins (cookies)

Nous utilisons uniquement des témoins strictement nécessaires :

| Témoin | Finalité | Durée |
|---|---|---|
| `better-auth.session_token` | Session authentifiée | Session |
| `nln-locale` | Préférence linguistique (anglais/français) | Persistant |
| `nln-guest-session` | Session de commande client (QR) | Session |

Aucun bandeau de consentement n'est présenté car aucun témoin non essentiel
n'est utilisé. Ceci est documenté ici par transparence — conformément à la
Loi 25 du Québec, le consentement n'est pas requis pour les témoins strictement
nécessaires au service demandé par l'utilisateur.

---

## 9. Âge des utilisateurs

Cette plateforme est destinée à l'exploitation de discothèques. Les clients
doivent avoir l'âge légal pour consommer selon la juridiction de l'établissement
(minimum 18 ans, configurable par établissement ; 18 ans est la valeur par
défaut au Québec). Nous ne collectons pas sciemment de renseignements auprès
de personnes de moins de 18 ans. Le personnel de porte vérifie l'âge à
l'admission ; la plateforme enregistre la vérification mais pas le document
d'identité complet.

---

## 10. Transferts internationaux

Toutes les données de la plateforme sont hébergées à Beauharnois, Québec,
Canada (OVHcloud). Un sous-traitant, Sentry (suivi des erreurs), traite des
contextes d'erreur dépersonnalisés aux États-Unis. Les renseignements
personnels sont retirés des données d'erreur avant transmission — voir notre
[Inventaire des données](/DATA-INVENTORY.md) pour la procédure de nettoyage.

---

## 11. Modifications de la présente politique

Nous mettrons à jour la présente politique à mesure que la plateforme évolue.
Les modifications importantes seront communiquées aux établissements clients
(nos clients directs) par courriel ou avis dans l'application. La date en haut
de la page reflète la révision la plus récente.

---

## 12. Contact

**Responsable de la protection des renseignements personnels :** [NOM]  
**Courriel :** [COURRIEL]  
**Adresse :** [ADRESSE]

**Autorités de contrôle :**

- Commission d'accès à l'information du Québec (CAI) : [cai.gouv.qc.ca](https://www.cai.gouv.qc.ca)
- Commissariat à la protection de la vie privée du Canada : [priv.gc.ca](https://www.priv.gc.ca)
