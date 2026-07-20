# NightLifeNext

**The operations platform for nightclubs that run on data.**

Try the live demo:
[night-life-next.vercel.app](https://night-life-next.vercel.app/). No account,
no setup. Every visitor gets their own sandbox club that resets on arrival.

---

## The problem

Three people are frustrated on the same club floor, every night.

**The guest** is ready to order another round and has to wait, catching a
hostess's eye across a dark, loud room, or leaving the booth to find one. The
moment they were ready to spend, they spent waiting instead.

**The server** is walking the floor checking tables that don't need checking.
Half the trips are wasted movement: a lap past six booths to find the one that
actually wanted something. Effort spent guessing where the work is, instead of
doing it.

**The manager** is asked a simple question, *"How long does your club take to
get a guest their order?"*, and can't answer it with anything but a guess.
Seven minutes? Twelve? Nobody is timing it, so nobody knows, and no decision
built on that number can be trusted.

## The fix

NightLifeNext closes all three gaps with one platform.

Guests order from the booth by scanning a QR code, with no waiting and no
hunting for staff. Orders route straight to the crew, so servers move toward
real demand instead of patrolling. And because every order is a timestamped
event from tap to delivery, the manager finally has the number: *"My club
averages seven minutes to process a guest order,"* a sentence backed by data
rather than a hunch.

The bet is simple. Modern venues want to be data-driven, but the tools are
either too heavy for a nightclub floor or too dumb to measure anything. This is
a platform that stays out of the way for staff and guests, while capturing
every data point management needs to make decisions.

## Built for nightclubs, not restaurants

Restaurant systems assume daylight, table service and a quiet dining room. A
club floor is loud, dark, packed, and peaks at 1 a.m. on a Saturday.
NightLifeNext is built for that room:

- **Nights, not days.** Analytics follow the business night. A Saturday that
  ends at 3 a.m. Sunday still counts as Saturday's revenue.
- **Bottles, not entrées.** Bottle service, VIP zones and table minimums are
  first-class, not workarounds.
- **Phones, not terminals.** Staff work from their own phones and guests order
  from the booth. No hardware to buy, install or break.

## One night, four roles

**Guests** scan the QR at the table, browse the menu and order to the booth.
Live ETA on every round, bottle gifting to other tables, and one-tap tab
closure with bill splitting on the receipt. No app download, no account.

**Floor crew** work from a phone-sized control panel. Orders arrive with
claim-and-release so two runners never grab the same bottle. Live 86-board,
floor broadcasts, last call, show-floor lock and team chat keep everyone in
sync within seconds.

**Managers** get the control room: a live pulse of every table, order and
runner; a drag-and-drop floor map; menu and happy-hour pricing; an inventory
ledger; staff scheduling; reservations, events and promotions; and analytics
that show which night, which zone and which bottle actually made the money.

**Owners and groups** get a multi-tenant platform. Each venue's data is fully
isolated, and plans scale from single-room venues to multi-zone clubs and
groups.

## Capabilities

- QR table ordering with live ETA
- Bottle service, gifting and VIP zones
- Real-time order dispatch with claim and release
- Live floor map and table management
- Real-time 86-board, broadcasts and last call
- Inventory with a full movement ledger
- Staff scheduling and role-based access
- Reservations, events, promotions and happy-hour pricing
- Team chat and floor coordination
- Night-aware analytics and reporting
- Split-bill receipts and one-tap tab closure
- Printable QR sheets

## Data residency

The platform is hosted in Beauharnois, Québec. Guest and staff data never
leaves Canada, and the system is built to respect PIPEDA and Québec's Law 25
from the infrastructure up, not patched in afterward.

## Plans

| Plan | For | |
|---|---|---|
| Starter | Single-room venues | |
| Pro | Multi-zone clubs | |
| Enterprise | Groups and franchises | Coming soon |

Request a demo: [night-life-next.vercel.app/lead](https://night-life-next.vercel.app/lead)

---

<details>
<summary>For developers</summary>

Next.js App Router, TypeScript, Prisma/PostgreSQL, Tailwind. Start with
[`AGENTS.md`](AGENTS.md) for how to work on this repo,
[`docs/HOSTING.md`](docs/HOSTING.md) for deployment topology, and
[`docs/ROADMAP.md`](docs/ROADMAP.md) for feature status.

```bash
npm install
npm run dev:demo    # mock-data sandbox, no database
npm run dev:pglite  # live mode with in-process Postgres
```

</details>
