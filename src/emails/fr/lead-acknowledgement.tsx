import {
  Html, Head, Preview, Body, Container, Section, Text, Heading,
} from "@react-email/components";

interface LeadAckProps {
  venueName: string;
  contactName: string;
}

export function LeadAcknowledgementEmailFr({ venueName, contactName }: LeadAckProps) {
  return (
    <Html>
      <Head />
      <Preview>Merci de votre intérêt pour NightLife, {contactName}</Preview>
      <Body style={{ backgroundColor: "#0a0a0a", fontFamily: "system-ui, sans-serif", padding: "40px 0" }}>
        <Container style={{ maxWidth: 480, margin: "0 auto", padding: "32px", backgroundColor: "#141414", borderRadius: 12, border: "1px solid #272726" }}>
          <Heading style={{ color: "#c8a44e", fontSize: 20, margin: "0 0 8px" }}>NightLife</Heading>
          <Text style={{ color: "#e4e4e4", fontSize: 16, lineHeight: 1.6 }}>
            Bonjour {contactName}, merci de votre intérêt pour apporter NightLife au <strong>{venueName}</strong>.
          </Text>
          <Text style={{ color: "#e4e4e4", fontSize: 14, lineHeight: 1.6 }}>
            Notre équipe vous contactera dans les 24 heures pour planifier une démo et discuter de la façon dont NightLife peut aider à optimiser les opérations au {venueName}.
          </Text>
          <Section style={{ margin: "24px 0", padding: "16px", backgroundColor: "#1a1a1a", borderRadius: 8 }}>
            <Text style={{ color: "#888", fontSize: 13, margin: 0, lineHeight: 1.5 }}>
              En attendant, vous pouvez explorer notre démo en direct sur{" "}
              <a href="https://demo.nightlife.app" style={{ color: "#c8a44e" }}>demo.nightlife.app</a>
            </Text>
          </Section>
        </Container>
      </Body>
    </Html>
  );
}

LeadAcknowledgementEmailFr.PreviewProps = {
  venueName: "Le Club",
  contactName: "Marc",
} satisfies LeadAckProps;
