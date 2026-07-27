import { Html, Head, Preview, Body, Container, Section, Text, Heading } from "@react-email/components";

interface LeadAckProps {
  venueName: string;
  contactName: string;
}

export function LeadAcknowledgementEmail({ venueName, contactName }: LeadAckProps) {
  return (
    <Html>
      <Head />
      <Preview>Thanks for your interest in NightLife, {contactName}</Preview>
      <Body style={{ backgroundColor: "#0a0a0a", fontFamily: "system-ui, sans-serif", padding: "40px 0" }}>
        <Container style={{ maxWidth: 480, margin: "0 auto", padding: "32px", backgroundColor: "#141414", borderRadius: 12, border: "1px solid #272726" }}>
          <Heading style={{ color: "#c8a44e", fontSize: 20, margin: "0 0 8px" }}>NightLife</Heading>
          <Text style={{ color: "#e4e4e4", fontSize: 16, lineHeight: 1.6 }}>
            Hi {contactName}, thanks for your interest in bringing NightLife to <strong>{venueName}</strong>.
          </Text>
          <Text style={{ color: "#e4e4e4", fontSize: 14, lineHeight: 1.6 }}>
            Our team will reach out within 24 hours to schedule a demo and discuss how NightLife can help streamline operations at {venueName}.
          </Text>
          <Section style={{ margin: "24px 0", padding: "16px", backgroundColor: "#1a1a1a", borderRadius: 8 }}>
            <Text style={{ color: "#888", fontSize: 13, margin: 0, lineHeight: 1.5 }}>
              In the meantime, you can explore our live demo at{" "}
              <a href="https://demo.nightlife.app" style={{ color: "#c8a44e" }}>demo.nightlife.app</a>
            </Text>
          </Section>
        </Container>
      </Body>
    </Html>
  );
}

LeadAcknowledgementEmail.PreviewProps = {
  venueName: "Le Club",
  contactName: "Marc",
} satisfies LeadAckProps;
