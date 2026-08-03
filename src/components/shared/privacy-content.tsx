"use client";

import { useLocale } from "next-intl";
import Link from "next/link";
import { Button } from "@/components/ui/button";

function PrivacyFR() {
  return (
    <div className="prose prose-sm dark:prose-invert mx-auto max-w-3xl space-y-6 py-8">
      <p className="text-sm text-muted-foreground">
        <strong>NightLifeNext — En vigueur : [DATE]</strong><br />
        Dernière mise à jour : 2026-08-03<br />
        <em>[ÉBAUCHE — révision juridique requise avant publication]</em>
      </p>

      <p>
        La présente politique de confidentialité décrit comment NightLifeNext
        (« nous », « notre », « nos ») collecte, utilise, divulgue et conserve
        les renseignements personnels dans le cadre de notre plateforme
        d&apos;exploitation de discothèques. Elle est conforme à la Loi sur la
        protection des renseignements personnels dans le secteur privé du
        Québec (Loi 25) et à la Loi fédérale sur la protection des
        renseignements personnels et les documents électroniques (LPRPDE).
      </p>

      <Section title="1. Qui nous sommes">
        <p>
          NightLifeNext est une plateforme logicielle-service (SaaS) pour
          l&apos;exploitation de discothèques — gestion des tables, commandes,
          réservations, coordination d&apos;étage et CRM clientèle — fournie aux
          exploitants de salles (nos clients). La présente politique couvre la
          plateforme elle-même. Chaque établissement qui utilise la plateforme
          est un responsable de traitement distinct pour les données des clients
          et du personnel qu&apos;il collecte via la plateforme ; nous agissons
          en tant que sous-traitant pour ces renseignements.
        </p>
        <p>
          <strong>Responsable de la protection des renseignements personnels :</strong>{" "}
          [NOM] — [COURRIEL]<br />
          Contactez cette personne pour toute question relative à la vie privée,
          demande d&apos;accès ou plainte.
        </p>
      </Section>

      <Section title="2. Ce que nous collectons et pourquoi">
        <p>
          Nous collectons le minimum de renseignements nécessaires au
          fonctionnement de la plateforme. Nous n&apos;utilisons pas de
          traceurs publicitaires, de scripts d&apos;analyse tiers ni de
          témoins non essentiels.
        </p>
        <h3 className="text-base font-semibold mt-4">2.1 Renseignements que vous fournissez</h3>
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="border-b"><th className="text-left py-2 pr-4">Catégorie</th><th className="text-left py-2 pr-4">Exemples</th><th className="text-left py-2">Finalité</th></tr>
          </thead>
          <tbody>
            <tr className="border-b"><td className="py-1.5 pr-4 font-medium">Comptes du personnel</td><td className="py-1.5 pr-4">Nom, courriel, téléphone, rôle</td><td className="py-1.5">Authentification, autorisation, planification, soutien à la paie</td></tr>
            <tr className="border-b"><td className="py-1.5 pr-4 font-medium">Profils clients</td><td className="py-1.5 pr-4">Nom, courriel, téléphone, année de naissance, préférences, photo (facultative)</td><td className="py-1.5">Gestion des réservations, service aux tables, programmes VIP, sécurité</td></tr>
            <tr className="border-b"><td className="py-1.5 pr-4 font-medium">Réservations</td><td className="py-1.5 pr-4">Nom du client, courriel, téléphone, taille du groupe, date</td><td className="py-1.5">Réservation de table et confirmation</td></tr>
            <tr className="border-b"><td className="py-1.5 pr-4 font-medium">Admissions à la porte</td><td className="py-1.5 pr-4">Vérification d&apos;identité (contrôle d&apos;âge), taille du groupe, heure d&apos;entrée</td><td className="py-1.5">Vérification de l&apos;âge légal, gestion de la capacité, sécurité</td></tr>
            <tr className="border-b"><td className="py-1.5 pr-4 font-medium">Prospects commerciaux</td><td className="py-1.5 pr-4">Nom, courriel, téléphone, nom de l&apos;établissement, ville</td><td className="py-1.5">Réponse aux demandes de démonstration</td></tr>
          </tbody>
        </table>
        <h3 className="text-base font-semibold mt-4">2.2 Renseignements collectés automatiquement</h3>
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="border-b"><th className="text-left py-2 pr-4">Catégorie</th><th className="text-left py-2 pr-4">Exemples</th><th className="text-left py-2">Finalité</th></tr>
          </thead>
          <tbody>
            <tr className="border-b"><td className="py-1.5 pr-4 font-medium">Données de session</td><td className="py-1.5 pr-4">Jetons de connexion, adresse IP, agent utilisateur</td><td className="py-1.5">Authentification, sécurité, limitation de débit</td></tr>
            <tr className="border-b"><td className="py-1.5 pr-4 font-medium">Journaux d&apos;erreurs</td><td className="py-1.5 pr-4">Traces d&apos;exécution, métadonnées de requête (RP supprimés avant envoi)</td><td className="py-1.5">Diagnostic et résolution d&apos;erreurs</td></tr>
          </tbody>
        </table>
        <h3 className="text-base font-semibold mt-4">2.3 Renseignements que nous ne collectons PAS</h3>
        <ul className="list-disc pl-5 space-y-1">
          <li>Données de carte de paiement (traitées par Stripe — jamais sur nos serveurs)</li>
          <li>Géolocalisation précise</li>
          <li>Historique de navigation entre sites</li>
          <li>Identifiants publicitaires</li>
          <li>Témoins au-delà de ce que la mécanique de session exige</li>
        </ul>
      </Section>

      <Section title="3. Comment nous les utilisons">
        <p>Toute collecte a un fondement légal en vertu de la Loi 25 et de la LPRPDE :</p>
        <ul className="list-disc pl-5 space-y-1">
          <li><strong>Nécessité contractuelle :</strong> fourniture des services de la plateforme — authentification, traitement des commandes, gestion des réservations, attribution des tables, planification du personnel.</li>
          <li><strong>Obligation légale :</strong> vérification de l&apos;âge (permis d&apos;alcool), documentation des incidents (sécurité au travail), registres fiscaux et d&apos;emploi (droit du travail québécois).</li>
          <li><strong>Intérêt légitime :</strong> surveillance de la sécurité, prévention de la fraude, analyses agrégées pour les exploitants, amélioration du service.</li>
          <li><strong>Consentement :</strong> communications marketing, photos des clients, fonctionnalités promotionnelles. Vous pouvez retirer votre consentement en tout temps en contactant le responsable de la protection des renseignements personnels.</li>
        </ul>
      </Section>

      <Section title="4. Avec qui nous les partageons">
        <p>Nous partageons les renseignements personnels uniquement lorsque nécessaire :</p>
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="border-b"><th className="text-left py-2 pr-4">Destinataire</th><th className="text-left py-2 pr-4">Quoi</th><th className="text-left py-2">Pourquoi</th></tr>
          </thead>
          <tbody>
            <tr className="border-b"><td className="py-1.5 pr-4 font-medium">L&apos;établissement</td><td className="py-1.5 pr-4">Vos commandes, réservations, profil</td><td className="py-1.5">L&apos;établissement est le responsable de traitement</td></tr>
            <tr className="border-b"><td className="py-1.5 pr-4 font-medium">Stripe</td><td className="py-1.5 pr-4">Traitement des paiements</td><td className="py-1.5">Vos données de carte vont directement à Stripe</td></tr>
            <tr className="border-b"><td className="py-1.5 pr-4 font-medium">Resend</td><td className="py-1.5 pr-4">Envoi de courriels</td><td className="py-1.5">Courriels transactionnels et de notification</td></tr>
            <tr className="border-b"><td className="py-1.5 pr-4 font-medium">Sentry (É.-U.)</td><td className="py-1.5 pr-4">Contexte d&apos;erreur dépersonnalisé</td><td className="py-1.5">Diagnostic d&apos;erreurs — RP supprimés avant l&apos;envoi</td></tr>
            <tr className="border-b"><td className="py-1.5 pr-4 font-medium">OVHcloud</td><td className="py-1.5 pr-4">Toutes les données</td><td className="py-1.5">Hébergement à Beauharnois, Québec, Canada</td></tr>
          </tbody>
        </table>
        <p>Nous ne vendons PAS les renseignements personnels. Nous ne les partageons pas avec des courtiers de données, des annonceurs ni aucun tiers non listé ci-dessus.</p>
      </Section>

      <Section title="5. Durée de conservation">
        <p>La conservation est régie par notre inventaire des données :</p>
        <ul className="list-disc pl-5 space-y-1">
          <li><strong>Sessions clients :</strong> anonymisées 90 jours après la fermeture.</li>
          <li><strong>Réservations :</strong> champs personnels anonymisés 6 mois après la finalisation.</li>
          <li><strong>Dossiers du personnel :</strong> durée de l&apos;emploi plus 3 ans (droit du travail québécois).</li>
          <li><strong>Registres d&apos;incidents :</strong> 3 ans standard, 7 ans si déclarables.</li>
          <li><strong>Profils clients inactifs :</strong> supprimés 24 mois après la dernière visite.</li>
          <li><strong>Sauvegardes :</strong> quotidiennes 7 j, hebdomadaires 4 sem, mensuelles 12 mois. Les renseignements individuels ne peuvent pas être retirés des sauvegardes — la suppression affecte la base active ; les copies expirent selon le calendrier.</li>
        </ul>
      </Section>

      <Section title="6. Vos droits">
        <p>En vertu de la Loi 25 et de la LPRPDE, vous avez le droit de :</p>
        <ul className="list-disc pl-5 space-y-1">
          <li><strong>Accès :</strong> savoir quels renseignements nous détenons à votre sujet.</li>
          <li><strong>Rectification :</strong> corriger les renseignements inexacts ou incomplets.</li>
          <li><strong>Effacement :</strong> demander la suppression de vos renseignements, sous réserve des obligations légales de conservation.</li>
          <li><strong>Portabilité :</strong> recevoir vos renseignements dans un format structuré.</li>
          <li><strong>Retrait du consentement :</strong> pour tout traitement fondé sur le consentement.</li>
          <li><strong>Plainte :</strong> auprès de la CAI ou du Commissariat à la protection de la vie privée du Canada.</li>
        </ul>
        <p>Pour exercer ces droits, contactez le responsable à <strong>[COURRIEL]</strong>. Réponse dans les 30 jours.</p>
      </Section>

      <Section title="7. Sécurité">
        <ul className="list-disc pl-5 space-y-1">
          <li><strong>Chiffrement :</strong> TLS 1.3 en transit, stockage PostgreSQL chiffré au repos.</li>
          <li><strong>Contrôle d&apos;accès :</strong> accès basé sur les rôles au niveau applicatif.</li>
          <li><strong>Isolation des locataires :</strong> chaque requête BD limitée par établissement.</li>
          <li><strong>Journalisation d&apos;audit :</strong> actions administratives journalisées avec identité.</li>
          <li><strong>Réponse aux incidents :</strong> registre des atteintes et procédure documentée. En cas d&apos;atteinte présentant un risque de préjudice sérieux, nous aviserons la CAI et les personnes concernées.</li>
        </ul>
      </Section>

      <Section title="8. Témoins (cookies)">
        <p>Nous utilisons uniquement des témoins strictement nécessaires :</p>
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="border-b"><th className="text-left py-2 pr-4">Témoin</th><th className="text-left py-2 pr-4">Finalité</th><th className="text-left py-2">Durée</th></tr>
          </thead>
          <tbody>
            <tr className="border-b"><td className="py-1.5 pr-4 font-mono text-xs">better-auth.session_token</td><td className="py-1.5 pr-4">Session authentifiée</td><td className="py-1.5">Session</td></tr>
            <tr className="border-b"><td className="py-1.5 pr-4 font-mono text-xs">nln-locale</td><td className="py-1.5 pr-4">Préférence linguistique</td><td className="py-1.5">Persistant</td></tr>
            <tr className="border-b"><td className="py-1.5 pr-4 font-mono text-xs">nln-guest-session</td><td className="py-1.5 pr-4">Session de commande client (QR)</td><td className="py-1.5">Session</td></tr>
          </tbody>
        </table>
        <p>Aucun bandeau de consentement — aucun témoin non essentiel.</p>
      </Section>

      <Section title="9. Âge des utilisateurs">
        <p>Cette plateforme est destinée à l&apos;exploitation de discothèques. Les clients doivent avoir l&apos;âge légal (minimum 18 ans, configurable par établissement). Nous ne collectons pas sciemment de renseignements auprès de personnes de moins de 18 ans.</p>
      </Section>

      <Section title="10. Transferts internationaux">
        <p>Toutes les données sont hébergées à Beauharnois, Québec, Canada (OVHcloud). Un sous-traitant, Sentry, traite des contextes d&apos;erreur dépersonnalisés aux États-Unis. Les RP sont retirés avant transmission.</p>
      </Section>

      <Section title="11. Modifications">
        <p>Nous mettrons à jour la présente politique. Les modifications importantes seront communiquées aux établissements clients par courriel ou avis dans l&apos;application.</p>
      </Section>

      <Section title="12. Contact">
        <p>
          <strong>Responsable :</strong> [NOM]<br />
          <strong>Courriel :</strong> [COURRIEL]<br />
          <strong>Adresse :</strong> [ADRESSE]
        </p>
        <p className="text-sm text-muted-foreground">
          Commission d&apos;accès à l&apos;information du Québec :{" "}
          <a href="https://www.cai.gouv.qc.ca" className="underline" target="_blank" rel="noopener noreferrer">cai.gouv.qc.ca</a>
          {" — "}
          Commissariat à la protection de la vie privée du Canada :{" "}
          <a href="https://www.priv.gc.ca" className="underline" target="_blank" rel="noopener noreferrer">priv.gc.ca</a>
        </p>
      </Section>
    </div>
  );
}

function PrivacyEN() {
  return (
    <div className="prose prose-sm dark:prose-invert mx-auto max-w-3xl space-y-6 py-8">
      <p className="text-sm text-muted-foreground">
        <strong>NightLifeNext — Effective: [DATE]</strong><br />
        Last updated: 2026-08-03<br />
        <em>[DRAFT — legal review required before publishing]</em>
      </p>

      <p>
        This privacy policy describes how NightLifeNext (&ldquo;we&rdquo;,
        &ldquo;our&rdquo;, &ldquo;us&rdquo;) collects, uses, discloses, and
        retains personal information through our nightclub operations platform.
        It complies with Quebec&apos;s Act respecting the protection of personal
        information in the private sector (Law 25) and the federal Personal
        Information Protection and Electronic Documents Act (PIPEDA).
      </p>

      <Section title="1. Who we are">
        <p>
          NightLifeNext is a SaaS platform for nightclub operations — table
          management, ordering, reservations, floor coordination, and guest
          CRM — provided to venue operators (our customers). This policy covers
          the platform itself. Each venue is a separate data controller for the
          guest and staff data it collects through the platform; we act as a
          data processor for that information.
        </p>
        <p>
          <strong>Privacy officer:</strong> [NAME] — [EMAIL]<br />
          Reach this contact for any privacy question, access request, or complaint.
        </p>
      </Section>

      <Section title="2. What we collect and why">
        <p>We collect the minimum needed. No advertising trackers, third-party analytics, or non-essential cookies.</p>
        <h3 className="text-base font-semibold mt-4">2.1 Information you provide</h3>
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="border-b"><th className="text-left py-2 pr-4">Category</th><th className="text-left py-2 pr-4">Examples</th><th className="text-left py-2">Purpose</th></tr>
          </thead>
          <tbody>
            <tr className="border-b"><td className="py-1.5 pr-4 font-medium">Staff accounts</td><td className="py-1.5 pr-4">Name, email, phone, role</td><td className="py-1.5">Authentication, scheduling, payroll</td></tr>
            <tr className="border-b"><td className="py-1.5 pr-4 font-medium">Guest profiles</td><td className="py-1.5 pr-4">Name, email, phone, birth year, preferences, photo</td><td className="py-1.5">Reservations, table service, VIP, safety</td></tr>
            <tr className="border-b"><td className="py-1.5 pr-4 font-medium">Reservations</td><td className="py-1.5 pr-4">Name, email, phone, party size, date</td><td className="py-1.5">Table booking and confirmation</td></tr>
            <tr className="border-b"><td className="py-1.5 pr-4 font-medium">Door admissions</td><td className="py-1.5 pr-4">ID check (age), party size, entry time</td><td className="py-1.5">Legal age verification, capacity management</td></tr>
            <tr className="border-b"><td className="py-1.5 pr-4 font-medium">Sales leads</td><td className="py-1.5 pr-4">Name, email, phone, venue name, city</td><td className="py-1.5">Responding to demo requests</td></tr>
          </tbody>
        </table>
        <h3 className="text-base font-semibold mt-4">2.2 Collected automatically</h3>
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="border-b"><th className="text-left py-2 pr-4">Category</th><th className="text-left py-2 pr-4">Examples</th><th className="text-left py-2">Purpose</th></tr>
          </thead>
          <tbody>
            <tr className="border-b"><td className="py-1.5 pr-4 font-medium">Session data</td><td className="py-1.5 pr-4">Login tokens, IP address, user agent</td><td className="py-1.5">Authentication, security, rate limiting</td></tr>
            <tr className="border-b"><td className="py-1.5 pr-4 font-medium">Error logs</td><td className="py-1.5 pr-4">Stack traces, request metadata (PII scrubbed)</td><td className="py-1.5">Error diagnosis and resolution</td></tr>
          </tbody>
        </table>
        <h3 className="text-base font-semibold mt-4">2.3 We do NOT collect</h3>
        <ul className="list-disc pl-5 space-y-1">
          <li>Payment card data (Stripe — never touches our servers)</li>
          <li>Precise geolocation</li>
          <li>Browsing history across sites</li>
          <li>Advertising identifiers</li>
          <li>Cookies beyond session mechanics</li>
        </ul>
      </Section>

      <Section title="3. How we use it">
        <p>All collection has a lawful basis under Law 25 and PIPEDA:</p>
        <ul className="list-disc pl-5 space-y-1">
          <li><strong>Contract necessity:</strong> delivering the platform — authentication, order processing, reservations, scheduling.</li>
          <li><strong>Legal obligation:</strong> age verification, incident documentation, tax and employment records.</li>
          <li><strong>Legitimate interest:</strong> security monitoring, fraud prevention, aggregate analytics, service improvement.</li>
          <li><strong>Consent:</strong> marketing communications, guest photos. Withdrawable at any time.</li>
        </ul>
      </Section>

      <Section title="4. How we share it">
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="border-b"><th className="text-left py-2 pr-4">Recipient</th><th className="text-left py-2 pr-4">What</th><th className="text-left py-2">Why</th></tr>
          </thead>
          <tbody>
            <tr className="border-b"><td className="py-1.5 pr-4 font-medium">The venue</td><td className="py-1.5 pr-4">Your orders, reservations, profile</td><td className="py-1.5">Venue is the data controller</td></tr>
            <tr className="border-b"><td className="py-1.5 pr-4 font-medium">Stripe</td><td className="py-1.5 pr-4">Payment processing</td><td className="py-1.5">Card data goes directly to Stripe</td></tr>
            <tr className="border-b"><td className="py-1.5 pr-4 font-medium">Resend</td><td className="py-1.5 pr-4">Email delivery</td><td className="py-1.5">Transactional and notification emails</td></tr>
            <tr className="border-b"><td className="py-1.5 pr-4 font-medium">Sentry (US)</td><td className="py-1.5 pr-4">De-identified error context</td><td className="py-1.5">Error diagnosis — PII scrubbed before sending</td></tr>
            <tr className="border-b"><td className="py-1.5 pr-4 font-medium">OVHcloud</td><td className="py-1.5 pr-4">All platform data</td><td className="py-1.5">Hosting in Beauharnois, Quebec, Canada</td></tr>
          </tbody>
        </table>
        <p>We do NOT sell personal information. We do not share it with data brokers, advertisers, or any unlisted third party.</p>
      </Section>

      <Section title="5. How long we keep it">
        <ul className="list-disc pl-5 space-y-1">
          <li><strong>Guest sessions:</strong> anonymized 90 days after closure.</li>
          <li><strong>Reservations:</strong> personal fields anonymized 6 months after completion.</li>
          <li><strong>Staff records:</strong> employment duration + 3 years (Quebec labour law).</li>
          <li><strong>Incidents:</strong> 3 years standard, 7 years if reportable.</li>
          <li><strong>Inactive guest profiles:</strong> deleted 24 months after last visit.</li>
          <li><strong>Backups:</strong> daily 7d, weekly 4w, monthly 12m. Individual records cannot be removed from backup files — deletion affects the live database; backup copies age out on schedule.</li>
        </ul>
      </Section>

      <Section title="6. Your rights">
        <p>Under Law 25 and PIPEDA:</p>
        <ul className="list-disc pl-5 space-y-1">
          <li><strong>Access:</strong> know what we hold about you.</li>
          <li><strong>Rectification:</strong> correct inaccurate information.</li>
          <li><strong>Erasure:</strong> request deletion, subject to legal retention obligations.</li>
          <li><strong>Portability:</strong> receive your information in a structured format.</li>
          <li><strong>Withdraw consent:</strong> for consent-based processing.</li>
          <li><strong>Complain:</strong> to the CAI or the Privacy Commissioner of Canada.</li>
        </ul>
        <p>Contact the privacy officer at <strong>[EMAIL]</strong>. Response within 30 days.</p>
      </Section>

      <Section title="7. Security">
        <ul className="list-disc pl-5 space-y-1">
          <li><strong>Encryption:</strong> TLS 1.3 in transit, encrypted PostgreSQL at rest.</li>
          <li><strong>Access control:</strong> role-based access at the application layer.</li>
          <li><strong>Tenant isolation:</strong> every database query scoped by venue.</li>
          <li><strong>Audit logging:</strong> administrative actions logged with actor identity.</li>
          <li><strong>Incident response:</strong> breach register and documented procedure. If a breach presents a risk of serious injury, we will notify the CAI and affected individuals.</li>
        </ul>
      </Section>

      <Section title="8. Cookies">
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="border-b"><th className="text-left py-2 pr-4">Cookie</th><th className="text-left py-2 pr-4">Purpose</th><th className="text-left py-2">Duration</th></tr>
          </thead>
          <tbody>
            <tr className="border-b"><td className="py-1.5 pr-4 font-mono text-xs">better-auth.session_token</td><td className="py-1.5 pr-4">Authenticated session</td><td className="py-1.5">Session</td></tr>
            <tr className="border-b"><td className="py-1.5 pr-4 font-mono text-xs">nln-locale</td><td className="py-1.5 pr-4">Language preference</td><td className="py-1.5">Persistent</td></tr>
            <tr className="border-b"><td className="py-1.5 pr-4 font-mono text-xs">nln-guest-session</td><td className="py-1.5 pr-4">Guest QR ordering session</td><td className="py-1.5">Session</td></tr>
          </tbody>
        </table>
        <p>No consent banner — no non-essential cookies used.</p>
      </Section>

      <Section title="9. Age of users">
        <p>This platform is for nightclub operations. Guests must meet the legal drinking age (minimum 18). We do not knowingly collect information from persons under 18.</p>
      </Section>

      <Section title="10. International transfers">
        <p>All platform data is hosted in Beauharnois, Quebec, Canada (OVHcloud). One sub-processor, Sentry, processes de-identified error context in the United States. PII is removed before transmission.</p>
      </Section>

      <Section title="11. Changes">
        <p>We will update this policy as the platform evolves. Material changes communicated to venue customers by email or in-app notice.</p>
      </Section>

      <Section title="12. Contact">
        <p>
          <strong>Privacy officer:</strong> [NAME]<br />
          <strong>Email:</strong> [EMAIL]<br />
          <strong>Address:</strong> [ADDRESS]
        </p>
        <p className="text-sm text-muted-foreground">
          Commission d&apos;accès à l&apos;information du Québec:{" "}
          <a href="https://www.cai.gouv.qc.ca" className="underline" target="_blank" rel="noopener noreferrer">cai.gouv.qc.ca</a>
          {" — "}
          Office of the Privacy Commissioner of Canada:{" "}
          <a href="https://www.priv.gc.ca" className="underline" target="_blank" rel="noopener noreferrer">priv.gc.ca</a>
        </p>
      </Section>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="text-lg font-semibold border-b pb-2 mb-3">{title}</h2>
      {children}
    </section>
  );
}

export function PrivacyPage() {
  const locale = useLocale();
  const isFrench = locale === "fr";

  return (
    <>
      <div className="mx-auto max-w-3xl px-4 pt-8 flex items-center justify-between">
        <h1 className="text-display text-2xl">
          {isFrench ? "Politique de confidentialité" : "Privacy Policy"}
        </h1>
        <div className="flex items-center gap-1 text-sm">
          <Button
            variant={isFrench ? "secondary" : "ghost"}
            size="sm"
            onClick={() => document.cookie = "nln-locale=fr;path=/;max-age=31536000;SameSite=Lax"}
            asChild
          >
            <Link href="/privacy" onClick={(e) => { e.preventDefault(); window.location.reload(); }}>
              FR
            </Link>
          </Button>
          <Button
            variant={!isFrench ? "secondary" : "ghost"}
            size="sm"
            onClick={() => document.cookie = "nln-locale=en;path=/;max-age=31536000;SameSite=Lax"}
            asChild
          >
            <Link href="/privacy" onClick={(e) => { e.preventDefault(); window.location.reload(); }}>
              EN
            </Link>
          </Button>
        </div>
      </div>
      {isFrench ? <PrivacyFR /> : <PrivacyEN />}
    </>
  );
}
