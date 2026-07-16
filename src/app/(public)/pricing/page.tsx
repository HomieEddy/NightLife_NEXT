import Link from "next/link";
import { notFound } from "next/navigation";
import { Check, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { isDemoMode } from "@/lib/app-mode";

export const metadata = { title: "Pricing" };

const PLANS = [
  {
    name: "Trial",
    price: "Free",
    cadence: "/3 days",
    tagline: "Explore every feature with a full three-day venue trial.",
    highlight: false,
    cta: "Start 3-day trial",
    features: [
      { label: "3 days of full access", included: true },
      { label: "Every NightLifeNext feature", included: true },
      { label: "No credit card required", included: true },
      { label: "Cancel anytime", included: true },
    ],
  },
  {
    name: "Starter",
    price: "$0.99",
    cadence: "/mo",
    tagline: "Essential QR ordering and venue operations for smaller teams.",
    highlight: false,
    cta: "Choose Starter",
    features: [
      { label: "QR ordering & menu", included: true },
      { label: "Orders & staff workflows", included: true },
      { label: "Menu & inventory management", included: true },
      { label: "Venue, zones & tables", included: true },
      { label: "Team Chat", included: false },
      { label: "Floor Map", included: false },
      { label: "Reservations", included: false },
      { label: "Events", included: false },
      { label: "Promotions", included: false },
      { label: "Reports", included: false },
      { label: "Analytics", included: false },
    ],
  },
  {
    name: "Pro",
    price: "$1.99",
    cadence: "/mo",
    tagline: "The complete operating system for every part of your night.",
    highlight: true,
    cta: "Choose Pro",
    features: [
      { label: "Every NightLifeNext feature", included: true },
      { label: "Team Chat & Floor Map", included: true },
      { label: "Reservations, Events & Promotions", included: true },
      { label: "Reports & Analytics", included: true },
      { label: "Unlimited staff & tables", included: true },
      { label: "Priority support", included: true },
    ],
  },
];

export default function PricingPage() {
  if (isDemoMode()) notFound();

  return (
    <div className="mx-auto max-w-6xl px-4 py-16 sm:py-20">
      <div className="text-center">
        <Badge variant="secondary">Simple venue pricing</Badge>
        <h1 className="mt-4 text-3xl font-bold tracking-tight sm:text-4xl">Pricing that scales with your night</h1>
        <p className="mx-auto mt-3 max-w-xl text-muted-foreground">
          Start with every feature for three days, then choose the operating toolkit your venue needs.
        </p>
      </div>

      <div className="mt-12 grid items-stretch gap-6 lg:grid-cols-3">
        {PLANS.map((plan) => (
          <Card
            key={plan.name}
            className={plan.highlight ? "relative flex h-full flex-col overflow-visible border-primary/60 shadow-lg shadow-primary/10" : "flex h-full flex-col"}
          >
            {plan.highlight && (
              <Badge className="absolute -top-3 left-1/2 -translate-x-1/2">Best value</Badge>
            )}
            <CardHeader className="space-y-3 pb-4">
              <CardTitle>{plan.name}</CardTitle>
              <p className="text-3xl font-bold tracking-tight">
                {plan.price}
                <span className="ml-1 text-sm font-normal text-muted-foreground">{plan.cadence}</span>
              </p>
              <p className="min-h-10 text-sm text-muted-foreground">{plan.tagline}</p>
            </CardHeader>
            <CardContent className="flex-1">
              <ul className="space-y-2.5">
                {plan.features.map((feature) => (
                  <li key={feature.label} className="flex items-start gap-2 text-sm">
                    {feature.included ? (
                      <Check className="mt-0.5 size-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
                    ) : (
                      <X className="mt-0.5 size-4 shrink-0 text-muted-foreground/50" />
                    )}
                    <span className={feature.included ? "" : "text-muted-foreground/60"}>{feature.label}</span>
                  </li>
                ))}
              </ul>
            </CardContent>
            <CardFooter className="pt-6">
              <Button className="w-full" variant={plan.highlight ? "default" : "outline"} asChild>
                <Link href="/login">{plan.cta}</Link>
              </Button>
            </CardFooter>
          </Card>
        ))}
      </div>

      <p className="mt-10 text-center text-sm text-muted-foreground">
        Per venue, per month. No per-order fees or hardware lock-in. Cancel anytime.
        {/* TODO(backend): wire Stripe checkout + billing portal here. */}
      </p>
    </div>
  );
}
