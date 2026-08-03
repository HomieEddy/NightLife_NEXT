"use client";

import { useLocale } from "next-intl";
import Link from "next/link";
import { Button } from "@/components/ui/button";

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="text-lg font-semibold border-b pb-2 mb-3">{title}</h2>
      {children}
    </section>
  );
}

function TosFR() {
  return (
    <div className="prose prose-sm dark:prose-invert mx-auto max-w-3xl space-y-6 py-8">
      <p className="text-sm text-muted-foreground">
        <strong>NightLifeNext — En vigueur : [DATE]</strong><br />
        Dernière mise à jour : 2026-08-03<br />
        <em>[ÉBAUCHE — révision juridique requise avant publication]</em>
      </p>

      <p>
        Les présentes Conditions d&apos;utilisation (« Conditions ») régissent votre
        utilisation de la plateforme NightLifeNext (« la Plateforme », « nous »,
        « notre », « nos ») en tant qu&apos;exploitant d&apos;établissement (« vous »,
        « Client »). En créant un compte ou en utilisant la Plateforme, vous acceptez
        les présentes Conditions.
      </p>

      <Section title="1. La Plateforme">
        <p>
          NightLifeNext est une plateforme SaaS pour l&apos;exploitation de
          discothèques : gestion des tables, commandes, réservations, coordination
          d&apos;étage, CRM clientèle, planification du personnel, analyses et outils
          connexes. La Plateforme est fournie en tant que service par abonnement
          accessible via navigateur Web et application web progressive (PWA).
        </p>
      </Section>

      <Section title="2. Compte et accès">
        <h3 className="text-base font-semibold mt-2">2.1 Inscription</h3>
        <p>Vous devez fournir des renseignements d&apos;inscription exacts et complets.
        Vous êtes responsable de la confidentialité de vos identifiants.</p>
        <h3 className="text-base font-semibold mt-2">2.2 Comptes du personnel</h3>
        <p>Vous pouvez créer des comptes pour votre personnel. Vous êtes responsable
        de leur utilisation et du respect des présentes Conditions.</p>
        <h3 className="text-base font-semibold mt-2">2.3 Accès des clients</h3>
        <p>Les clients commandent via code QR sans créer de compte. Leurs sessions
        sont liées à une table. Vous êtes responsable des données clients collectées
        — voir notre{" "}
        <Link href="/privacy" className="underline">Politique de confidentialité</Link>.</p>
      </Section>

      <Section title="3. Abonnement et paiement">
        <p><strong>3.1 Forfaits :</strong> offerts avec différents ensembles de
        fonctionnalités et limites. Prix en dollars canadiens.</p>
        <p><strong>3.2 Paiement :</strong> facturé mensuellement via Stripe. Vous nous
        autorisez à débiter votre mode de paiement. Les paiements échoués peuvent
        entraîner une suspension après 7 jours.</p>
        <p><strong>3.3 Modifications :</strong> préavis de 30 jours pour les
        changements de prix. Utilisation continue = acceptation.</p>
        <p><strong>3.4 Remboursements :</strong> non remboursables sauf si la loi
        l&apos;exige. Résiliation en milieu de cycle : accès jusqu&apos;à la fin de
        la période, aucun remboursement partiel.</p>
      </Section>

      <Section title="4. Utilisation acceptable">
        <p>Vous vous engagez à ne pas :</p>
        <ul className="list-disc pl-5 space-y-1">
          <li>Utiliser la Plateforme à des fins illégales.</li>
          <li>Revendre ou concéder en sous-licence la Plateforme.</li>
          <li>Tenter d&apos;accéder aux données d&apos;un autre Client.</li>
          <li>Téléverser du code malveillant ou tenter de violer la sécurité.</li>
          <li>Utiliser la Plateforme pour des RP au-delà de sa conception.</li>
        </ul>
        <p>Nous nous réservons le droit de suspendre ou résilier les comptes en cas
        de violation.</p>
      </Section>

      <Section title="5. Propriété et traitement des données">
        <p><strong>5.1 Vos données :</strong> vous conservez la propriété de toutes
        les données saisies dans la Plateforme.</p>
        <p><strong>5.2 Notre traitement :</strong> nous traitons vos données pour
        fournir le service. Nous n&apos;y accédons que pour le soutien ou si la loi
        l&apos;exige. Nous ne vendons ni n&apos;exploitons vos données.</p>
        <p><strong>5.3 Suppression :</strong> à la résiliation, suppression de la
        base active dans les 30 jours (période d&apos;exportation). Les sauvegardes
        expirent selon leur calendrier publié.</p>
        <p><strong>5.4 Analyses :</strong> nous générons des analyses agrégées et
        anonymisées à l&apos;échelle de la plateforme. Aucune identification
        individuelle.</p>
      </Section>

      <Section title="6. Niveau de service">
        <p><strong>6.1 Disponibilité :</strong> nous visons 99,5 % pendant les
        heures d&apos;ouverture. Maintenance planifiée annoncée 48 h à l&apos;avance.</p>
        <p><strong>6.2 Soutien :</strong> par courriel pendant les heures ouvrables.</p>
        <p><strong>6.3 Absence de garantie :</strong> la Plateforme est fournie
        « telle quelle » sans garantie d&apos;aucune sorte.</p>
      </Section>

      <Section title="7. Vos obligations légales">
        <p>En tant qu&apos;exploitant, vous êtes responsable de :</p>
        <ul className="list-disc pl-5 space-y-1">
          <li><strong>Permis d&apos;alcool :</strong> conformité aux lois applicables.</li>
          <li><strong>Protection des RP :</strong> consentement approprié pour les
          données collectées. Conformité à la Loi 25 (Québec) et à la LPRPDE.</li>
          <li><strong>Emploi :</strong> registres conformes aux normes du travail.</li>
          <li><strong>Vérification de l&apos;âge :</strong> âge légal vérifié à
          l&apos;admission.</li>
        </ul>
        <p>La Plateforme fournit des outils de soutien à la conformité ; elle ne
        remplace pas vos obligations légales.</p>
      </Section>

      <Section title="8. Limitation de responsabilité">
        <p>Dans toute la mesure permise par la loi :</p>
        <ul className="list-disc pl-5 space-y-1">
          <li>Responsabilité totale limitée aux frais payés dans les 12 mois
          précédant la réclamation.</li>
          <li>Aucune responsabilité pour les dommages indirects, consécutifs,
          spéciaux ou punitifs.</li>
          <li>Ces limitations ne s&apos;appliquent pas en cas de négligence grave
          ou de faute intentionnelle.</li>
        </ul>
      </Section>

      <Section title="9. Durée et résiliation">
        <p><strong>9.1 :</strong> en vigueur dès la création du compte.</p>
        <p><strong>9.2 Résiliation par vous :</strong> en tout temps via la zone
        d&apos;administration. Effet à la fin de la période de facturation.</p>
        <p><strong>9.3 Résiliation par nous :</strong> préavis de 30 jours, ou
        immédiatement pour violation ou non-paiement.</p>
        <p><strong>9.4 Effet :</strong> accès terminé, données supprimées selon le
        calendrier, frais impayés exigibles, dispositions survivantes maintenues.</p>
      </Section>

      <Section title="10. Droit applicable">
        <p>Les présentes Conditions sont régies par les lois de la province de
        Québec et les lois fédérales du Canada applicables. Tout différend sera
        résolu par les tribunaux de Montréal, Québec.</p>
      </Section>

      <Section title="11. Modifications">
        <p>Mises à jour communiquées par courriel ou avis dans l&apos;application
        au moins 30 jours avant leur entrée en vigueur. Utilisation continue =
        acceptation.</p>
      </Section>

      <Section title="12. Contact">
        <p>
          <strong>NightLifeNext</strong><br />
          Courriel : [COURRIEL]<br />
          Adresse : [ADRESSE]
        </p>
        <p className="text-sm text-muted-foreground">
          Questions de confidentialité :{" "}
          <Link href="/privacy" className="underline">Politique de confidentialité</Link>
        </p>
      </Section>
    </div>
  );
}

function TosEN() {
  return (
    <div className="prose prose-sm dark:prose-invert mx-auto max-w-3xl space-y-6 py-8">
      <p className="text-sm text-muted-foreground">
        <strong>NightLifeNext — Effective: [DATE]</strong><br />
        Last updated: 2026-08-03<br />
        <em>[DRAFT — legal review required before publishing]</em>
      </p>

      <p>
        These Terms of Service (&ldquo;Terms&rdquo;) govern your use of the
        NightLifeNext platform (&ldquo;the Platform&rdquo;, &ldquo;we&rdquo;,
        &ldquo;our&rdquo;, &ldquo;us&rdquo;) as a venue operator (&ldquo;you&rdquo;,
        &ldquo;Customer&rdquo;). By creating an account or using the Platform,
        you agree to these Terms.
      </p>

      <Section title="1. The Platform">
        <p>
          NightLifeNext is a SaaS platform for nightclub operations: table
          management, ordering, reservations, floor coordination, guest CRM,
          staff scheduling, analytics, and related tools. The Platform is
          provided as a subscription service accessed via web browser and
          mobile-capable Progressive Web App.
        </p>
      </Section>

      <Section title="2. Account & access">
        <h3 className="text-base font-semibold mt-2">2.1 Registration</h3>
        <p>You must provide accurate registration information. You are responsible
        for your credentials and all account activity.</p>
        <h3 className="text-base font-semibold mt-2">2.2 Staff accounts</h3>
        <p>You may create staff accounts. You are responsible for their use and
        compliance with these Terms.</p>
        <h3 className="text-base font-semibold mt-2">2.3 Guest access</h3>
        <p>Guests order via QR code without creating accounts. Sessions are tied
        to a table. You are responsible for guest data you collect — see our{" "}
        <Link href="/privacy" className="underline">Privacy Policy</Link>.</p>
      </Section>

      <Section title="3. Subscription & payment">
        <p><strong>3.1 Plans:</strong> offered with different features and limits.
        Pricing in Canadian dollars.</p>
        <p><strong>3.2 Payment:</strong> billed monthly via Stripe. You authorize
        us to charge your payment method. Failed payments may result in service
        suspension after a 7-day grace period.</p>
        <p><strong>3.3 Changes:</strong> 30 days&apos; notice for price changes.
        Continued use = acceptance.</p>
        <p><strong>3.4 Refunds:</strong> non-refundable except where required by
        law. Mid-cycle cancellation: access until end of billing period, no
        partial refund.</p>
      </Section>

      <Section title="4. Acceptable use">
        <p>You agree not to:</p>
        <ul className="list-disc pl-5 space-y-1">
          <li>Use the Platform for any unlawful purpose.</li>
          <li>Resell, sublicense, or provide as a service bureau.</li>
          <li>Attempt to access another Customer&apos;s data.</li>
          <li>Upload malicious code or attempt to breach security.</li>
          <li>Use the Platform beyond its designed PII handling scope.</li>
        </ul>
        <p>We reserve the right to suspend or terminate for violations.</p>
      </Section>

      <Section title="5. Data ownership & processing">
        <p><strong>5.1 Your data:</strong> you retain ownership of all data you
        enter into the Platform.</p>
        <p><strong>5.2 Our processing:</strong> we process Customer Data to provide
        the service. We do not access it except for support or as required by law.
        We do not sell, rent, or mine your data.</p>
        <p><strong>5.3 Deletion:</strong> on termination, deleted from live DB
        within 30 days (export window). Backups age out on their published schedule.</p>
        <p><strong>5.4 Analytics:</strong> we generate aggregate, anonymized
        analytics across all Customers. No individual identification.</p>
      </Section>

      <Section title="6. Service level">
        <p><strong>6.1 Availability:</strong> we aim for 99.5% uptime during venue
        operating hours. Scheduled maintenance announced 48 hours ahead.</p>
        <p><strong>6.2 Support:</strong> by email during business hours.</p>
        <p><strong>6.3 No warranty:</strong> the Platform is provided &ldquo;as
        is&rdquo; without warranty of any kind.</p>
      </Section>

      <Section title="7. Your legal obligations">
        <p>As a venue operator, you are responsible for:</p>
        <ul className="list-disc pl-5 space-y-1">
          <li><strong>Liquor licensing:</strong> compliance with applicable laws.</li>
          <li><strong>Privacy:</strong> proper consent for data collected. Quebec
          Customers must comply with Law 25; all Canadian Customers with PIPEDA.</li>
          <li><strong>Employment:</strong> records compliant with labour standards.</li>
          <li><strong>Age verification:</strong> legal drinking age verified at door.</li>
        </ul>
        <p>The Platform provides compliance support tools; it is not a substitute
        for your own legal obligations.</p>
      </Section>

      <Section title="8. Limitation of liability">
        <p>To the maximum extent permitted by law:</p>
        <ul className="list-disc pl-5 space-y-1">
          <li>Total liability limited to fees paid in the 12 months preceding the claim.</li>
          <li>No liability for indirect, consequential, special, or punitive damages.</li>
          <li>These limitations do not apply to gross negligence or wilful misconduct.</li>
        </ul>
      </Section>

      <Section title="9. Term & termination">
        <p><strong>9.1:</strong> begins on account creation, continues until terminated.</p>
        <p><strong>9.2 Termination by you:</strong> at any time via admin area.
        Takes effect at end of billing period.</p>
        <p><strong>9.3 Termination by us:</strong> 30 days&apos; notice, or
        immediately for Acceptable Use violations or non-payment.</p>
        <p><strong>9.4 Effect:</strong> access ends, data deleted per schedule,
        outstanding fees due, surviving provisions continue.</p>
      </Section>

      <Section title="10. Governing law">
        <p>These Terms are governed by the laws of the Province of Quebec and the
        federal laws of Canada applicable therein. Disputes resolved in the courts
        of Montreal, Quebec.</p>
      </Section>

      <Section title="11. Changes">
        <p>Material changes communicated by email or in-app notice at least 30 days
        before taking effect. Continued use = acceptance.</p>
      </Section>

      <Section title="12. Contact">
        <p>
          <strong>NightLifeNext</strong><br />
          Email: [EMAIL]<br />
          Address: [ADDRESS]
        </p>
        <p className="text-sm text-muted-foreground">
          Privacy inquiries:{" "}
          <Link href="/privacy" className="underline">Privacy Policy</Link>
        </p>
      </Section>
    </div>
  );
}

export function TosPage() {
  const locale = useLocale();
  const isFrench = locale === "fr";

  return (
    <>
      <div className="mx-auto max-w-3xl px-4 pt-8 flex items-center justify-between">
        <h1 className="text-display text-2xl">
          {isFrench ? "Conditions d&apos;utilisation" : "Terms of Service"}
        </h1>
        <div className="flex items-center gap-1 text-sm">
          <Button
            variant={isFrench ? "secondary" : "ghost"}
            size="sm"
            asChild
          >
            <Link
              href="/terms"
              onClick={(e) => {
                e.preventDefault();
                document.cookie = "nln-locale=fr;path=/;max-age=31536000;SameSite=Lax";
                window.location.reload();
              }}
            >
              FR
            </Link>
          </Button>
          <Button
            variant={!isFrench ? "secondary" : "ghost"}
            size="sm"
            asChild
          >
            <Link
              href="/terms"
              onClick={(e) => {
                e.preventDefault();
                document.cookie = "nln-locale=en;path=/;max-age=31536000;SameSite=Lax";
                window.location.reload();
              }}
            >
              EN
            </Link>
          </Button>
        </div>
      </div>
      {isFrench ? <TosFR /> : <TosEN />}
    </>
  );
}
