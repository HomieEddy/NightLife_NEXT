import {
  Html, Head, Preview, Body, Container, Section, Text, Link, Heading,
} from "@react-email/components";

interface StaffInviteProps {
  venueName: string;
  inviteUrl: string;
  roleLabel: string;
}

export function StaffInviteEmailFr({ venueName, inviteUrl, roleLabel }: StaffInviteProps) {
  return (
    <Html>
      <Head />
      <Preview>Vous avez été invité à rejoindre {venueName} sur NightLife</Preview>
      <Body style={{ backgroundColor: "#0a0a0a", fontFamily: "system-ui, sans-serif", padding: "40px 0" }}>
        <Container style={{ maxWidth: 480, margin: "0 auto", padding: "32px", backgroundColor: "#141414", borderRadius: 12, border: "1px solid #272726" }}>
          <Heading style={{ color: "#c8a44e", fontSize: 20, margin: "0 0 8px" }}>NightLife</Heading>
          <Text style={{ color: "#e4e4e4", fontSize: 16, lineHeight: 1.6 }}>
            Vous avez été invité à rejoindre <strong>{venueName}</strong> en tant que <strong>{roleLabel}</strong>.
          </Text>
          <Section style={{ margin: "24px 0" }}>
            <Link
              href={inviteUrl}
              style={{
                display: "inline-block",
                padding: "12px 32px",
                backgroundColor: "#c8a44e",
                color: "#0a0a0a",
                borderRadius: 8,
                fontWeight: 600,
                textDecoration: "none",
                fontSize: 14,
              }}
            >
              Accepter l&apos;invitation
            </Link>
          </Section>
          <Text style={{ color: "#888", fontSize: 12, lineHeight: 1.5 }}>
            Si le bouton ne fonctionne pas, copiez ce lien&nbsp;: {inviteUrl}
          </Text>
        </Container>
      </Body>
    </Html>
  );
}

StaffInviteEmailFr.PreviewProps = {
  venueName: "Velvet Montréal",
  inviteUrl: "https://app.nightlife.app/join/abc123",
  roleLabel: "Barman",
} satisfies StaffInviteProps;
