import {
  Html, Head, Preview, Body, Container, Section, Text, Heading,
} from "@react-email/components";

interface ReportRunProps {
  venueName: string;
  reportName: string;
  periodLabel: string;
  summary: string;
}

export function ReportRunEmailFr({ venueName, reportName, periodLabel, summary }: ReportRunProps) {
  return (
    <Html>
      <Head />
      <Preview>{reportName} — {periodLabel}</Preview>
      <Body style={{ backgroundColor: "#0a0a0a", fontFamily: "system-ui, sans-serif", padding: "40px 0" }}>
        <Container style={{ maxWidth: 480, margin: "0 auto", padding: "32px", backgroundColor: "#141414", borderRadius: 12, border: "1px solid #272726" }}>
          <Heading style={{ color: "#c8a44e", fontSize: 20, margin: "0 0 8px" }}>{venueName}</Heading>
          <Text style={{ color: "#e4e4e4", fontSize: 16, lineHeight: 1.6 }}>
            Votre rapport planifié <strong>{reportName}</strong> est prêt pour {periodLabel}.
          </Text>
          <Section style={{ margin: "16px 0", padding: "16px", backgroundColor: "#1a1a1a", borderRadius: 8 }}>
            <Text style={{ color: "#e4e4e4", fontSize: 13, lineHeight: 1.5, whiteSpace: "pre-wrap", margin: 0 }}>
              {summary}
            </Text>
          </Section>
          <Text style={{ color: "#888", fontSize: 12, lineHeight: 1.5 }}>
            Ouvrez NightLife Gestionnaire pour voir le rapport complet ou télécharger le CSV.
          </Text>
        </Container>
      </Body>
    </Html>
  );
}

ReportRunEmailFr.PreviewProps = {
  venueName: "Velvet Montréal",
  reportName: "Revenus hebdomadaires",
  periodLabel: "20–26 juillet 2026",
  summary: "Revenus : 48 250,00 $\nCommandes : 142\nCommande moyenne : 339,79 $\nArticle vedette : Dom Pérignon (18 unités)",
} satisfies ReportRunProps;
