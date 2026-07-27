import { Html, Head, Preview, Body, Container, Section, Text, Heading } from "@react-email/components";

interface ReservationConfirmationProps {
  venueName: string;
  guestName: string;
  date: string;
  time: string;
  partySize: number;
  reservationPin?: string;
  zoneName?: string;
}

export function ReservationConfirmationEmail({
  venueName, guestName, date, time, partySize, reservationPin, zoneName,
}: ReservationConfirmationProps) {
  return (
    <Html>
      <Head />
      <Preview>Your reservation at {venueName} is confirmed</Preview>
      <Body style={{ backgroundColor: "#0a0a0a", fontFamily: "system-ui, sans-serif", padding: "40px 0" }}>
        <Container style={{ maxWidth: 480, margin: "0 auto", padding: "32px", backgroundColor: "#141414", borderRadius: 12, border: "1px solid #272726" }}>
          <Heading style={{ color: "#c8a44e", fontSize: 20, margin: "0 0 8px" }}>{venueName}</Heading>
          <Text style={{ color: "#e4e4e4", fontSize: 16, lineHeight: 1.6 }}>
            Hi {guestName}, your reservation is confirmed.
          </Text>
          <Section style={{ margin: "16px 0", padding: "16px", backgroundColor: "#1a1a1a", borderRadius: 8 }}>
            <Text style={{ color: "#e4e4e4", fontSize: 14, margin: "0 0 4px" }}>
              <strong>Date:</strong> {date}
            </Text>
            <Text style={{ color: "#e4e4e4", fontSize: 14, margin: "0 0 4px" }}>
              <strong>Time:</strong> {time}
            </Text>
            <Text style={{ color: "#e4e4e4", fontSize: 14, margin: "0 0 4px" }}>
              <strong>Party size:</strong> {partySize}
            </Text>
            {zoneName && (
              <Text style={{ color: "#e4e4e4", fontSize: 14, margin: "0 0 4px" }}>
                <strong>Area:</strong> {zoneName}
              </Text>
            )}
          </Section>
          {reservationPin && (
            <Section style={{ margin: "16px 0", textAlign: "center" }}>
              <Text style={{ color: "#888", fontSize: 12, margin: "0 0 4px" }}>Your table access PIN</Text>
              <Text style={{ color: "#c8a44e", fontSize: 32, fontWeight: 700, letterSpacing: "0.2em", margin: 0 }}>
                {reservationPin}
              </Text>
            </Section>
          )}
        </Container>
      </Body>
    </Html>
  );
}

ReservationConfirmationEmail.PreviewProps = {
  venueName: "Velvet Montréal",
  guestName: "Chloé",
  date: "Saturday, July 26, 2026",
  time: "22:00",
  partySize: 4,
  reservationPin: "482910",
  zoneName: "VIP Mezzanine",
} satisfies ReservationConfirmationProps;
