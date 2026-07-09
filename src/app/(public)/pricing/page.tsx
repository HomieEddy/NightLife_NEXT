import Link from "next/link";
import { Check, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";

export const metadata = { title: "Pricing" };

const PLANS = [
  {
    name: "Starter",
    price: "$149",
    tagline: "For single-room venues getting started with QR ordering.",
    highlight: false,
    features: [
      { label: "Up to 15 tables", included: true },
      { label: "QR ordering & menu", included: true },
      { label: "Order feed & statuses", included: true },
      { label: "Basic analytics", included: true },
      { label: "Zones & runner routing", included: false },
      { label: "Happy hour engine", included: false },
      { label: "Team chat", included: false },
    ],
  },
  {
    name: "Pro",
    price: "$349",
    tagline: "For multi-zone clubs with bottle service and runners.",
    highlight: true,
    features: [
      { label: "Up to 60 tables", included: true },
      { label: "QR ordering & menu", included: true },
      { label: "Order feed & statuses", included: true },
      { label: "Full analytics suite", included: true },
      { label: "Zones & runner routing", included: true },
      { label: "Happy hour engine", included: true },
      { label: "Team chat", included: true },
    ],
  },
  {
    name: "Enterprise",
    price: "Custom",
    tagline: "For groups, franchises and venues with 60+ tables.",
    highlight: false,
    features: [
      { label: "Unlimited tables & venues", included: true },
      { label: "Everything in Pro", included: true },
      { label: "Multi-venue dashboard", included: true },
      { label: "Custom integrations", included: true },
      { label: "Dedicated success manager", included: true },
      { label: "SLA & priority support", included: true },
      { label: "White-label guest portal", included: true },
    ],
  },
];

export default function PricingPage() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-16">
      <div className="text-center">
        <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">Pricing</h1>
        <p className="mx-auto mt-3 max-w-md text-muted-foreground">
          Per venue, per month. No per-order fees, no hardware lock-in. Cancel anytime.
        </p>
      </div>

      <div className="mt-12 grid gap-5 lg:grid-cols-3">
        {PLANS.map((plan) => (
          <Card
            key={plan.name}
            className={plan.highlight ? "relative border-primary/60 glow-primary" : ""}
          >
            {plan.highlight && (
              <Badge className="absolute -top-3 left-1/2 -translate-x-1/2">Most popular</Badge>
            )}
            <CardHeader>
              <CardTitle>{plan.name}</CardTitle>
              <p className="text-3xl font-bold">
                {plan.price}
                {plan.price !== "Custom" && (
                  <span className="text-sm font-normal text-muted-foreground">/mo</span>
                )}
              </p>
              <p className="text-sm text-muted-foreground">{plan.tagline}</p>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2.5">
                {plan.features.map((feature) => (
                  <li key={feature.label} className="flex items-center gap-2 text-sm">
                    {feature.included ? (
                      <Check className="size-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
                    ) : (
                      <X className="size-4 shrink-0 text-muted-foreground/50" />
                    )}
                    <span className={feature.included ? "" : "text-muted-foreground/60"}>
                      {feature.label}
                    </span>
                  </li>
                ))}
              </ul>
            </CardContent>
            <CardFooter>
              <Button
                className="w-full"
                variant={plan.highlight ? "default" : "outline"}
                asChild
              >
                <Link href="/lead">
                  {plan.price === "Custom" ? "Talk to sales" : "Start free trial"}
                </Link>
              </Button>
            </CardFooter>
          </Card>
        ))}
      </div>

      <p className="mt-10 text-center text-sm text-muted-foreground">
        All plans include a 14-day free trial. Payment processing fees billed separately.
        {/* TODO(backend): wire Stripe checkout + billing portal here. */}
      </p>
    </div>
  );
}
