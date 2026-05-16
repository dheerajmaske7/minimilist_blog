---
layout: post
title: "Capturing Intent Over Attention in Agentic Payments"
date: 2026-05-16
excerpt: "As AI agents begin transacting for users, the bottleneck will shift from moving money to deciding who to trust, what to authorize, and how to recover when transactions fail. The next platform layer may not capture attention—it may capture delegated intent."
---

## Hypothesis

As AI agents begin transacting for users, the bottleneck will shift from moving money to deciding **who to trust**, **what to authorize**, and **how to recover** when transactions fail.

## The Pattern

I saw that Google captured human **intent** through search. Social media captured human **attention** through feeds and short-form content. The next layer may capture **delegated user intent** through trusted personal agents that can filter, decide, and transact on behalf of users.

---

## The 2027 Infrastructure Diagram

<figure style="text-align:center; margin: 0 0 1.5rem;">
  <img
    src="/assets/images/Agentic_Payments/2027-infrastructure-diagram.png"
    alt="2027 Agentic Payments Infrastructure — buyer-side personal agents and seller-side vendor agents communicate through a central Intent + Trust Layer before Payments are executed"
    style="max-width: 820px; width: 100%; height: auto; border-radius: 10px;"
  />
  <figcaption style="font-size: 0.95rem; opacity: 0.8; margin-top: 8px;">
    2027 Infrastructure: Buyer-side and seller-side agents interact through a central Intent + Trust Layer before payment execution.
  </figcaption>
</figure>

### Walking Through the Flow

<table style="width:100%; border-collapse:collapse; font-size:0.95rem; margin: 1rem 0;">
  <thead>
    <tr>
      <th style="text-align:left; padding:10px 14px; border: 1px solid #aaa;">Node</th>
      <th style="text-align:left; padding:10px 14px; border: 1px solid #aaa;">Side</th>
      <th style="text-align:left; padding:10px 14px; border: 1px solid #aaa;">Description</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td style="padding:9px 14px; border: 1px solid #aaa;"><strong>(a) Human / User</strong></td>
      <td style="padding:9px 14px; border: 1px solid #aaa;">Buyer</td>
      <td style="padding:9px 14px; border: 1px solid #aaa;">A person who wants to buy something. They do not touch the transaction directly.</td>
    </tr>
    <tr>
      <td style="padding:9px 14px; border: 1px solid #aaa;"><strong>(b) User Trust Layer</strong></td>
      <td style="padding:9px 14px; border: 1px solid #aaa;">Buyer</td>
      <td style="padding:9px 14px; border: 1px solid #aaa;">Governs what the personal agent is allowed to do. For micropayments, this trust is pre-delegated hence no per-transaction permission needed.</td>
    </tr>
    <tr>
      <td style="padding:9px 14px; border: 1px solid #aaa;"><strong>(c) Personal Agent</strong></td>
      <td style="padding:9px 14px; border: 1px solid #aaa;">Buyer</td>
      <td style="padding:9px 14px; border: 1px solid #aaa;">Acts on behalf of the human. Holds the user's preferences, spending rules, and intent.</td>
    </tr>
    <tr>
      <td style="padding:9px 14px; border: 1px solid #aaa;"><strong>(d) Intent Request</strong></td>
      <td style="padding:9px 14px; border: 1px solid #aaa;">Center</td>
      <td style="padding:9px 14px; border: 1px solid #aaa;">The personal agent sends a structured signal outward: "I want to buy X, within budget Y, with preference Z."</td>
    </tr>
    <tr>
      <td style="padding:9px 14px; border: 1px solid #aaa;"><strong>(I) Intent + Trust Layer</strong></td>
      <td style="padding:9px 14px; border: 1px solid #aaa;">Center</td>
      <td style="padding:9px 14px; border: 1px solid #aaa;">The critical middle column. Where discovery, credentialing, and matching must happen before any offer is returned.</td>
    </tr>
    <tr>
      <td style="padding:9px 14px; border: 1px solid #aaa;"><strong>(e) Verified Offer</strong></td>
      <td style="padding:9px 14px; border: 1px solid #aaa;">Center</td>
      <td style="padding:9px 14px; border: 1px solid #aaa;">The vendor agent responds with a credentialed offer back through the same layer.</td>
    </tr>
    <tr>
      <td style="padding:9px 14px; border: 1px solid #aaa;"><strong>(f) Vendor Agent</strong></td>
      <td style="padding:9px 14px; border: 1px solid #aaa;">Seller</td>
      <td style="padding:9px 14px; border: 1px solid #aaa;">Represents the merchant. Knows the catalog, pricing, availability, and deal parameters.</td>
    </tr>
    <tr>
      <td style="padding:9px 14px; border: 1px solid #aaa;"><strong>(g) Vendor Trust Layer</strong></td>
      <td style="padding:9px 14px; border: 1px solid #aaa;">Seller</td>
      <td style="padding:9px 14px; border: 1px solid #aaa;">The boundary between a vendor and its agent. The vendor's agent is authorized to negotiate and fulfill on the vendor's behalf.</td>
    </tr>
    <tr>
      <td style="padding:9px 14px; border: 1px solid #aaa;"><strong>(h) Vendor (e.g. Amazon)</strong></td>
      <td style="padding:9px 14px; border: 1px solid #aaa;">Seller</td>
      <td style="padding:9px 14px; border: 1px solid #aaa;">A merchant or service provider.</td>
    </tr>
    <tr>
      <td style="padding:9px 14px; border: 1px solid #aaa;"><strong>Payments</strong></td>
      <td style="padding:9px 14px; border: 1px solid #aaa;">Bottom</td>
      <td style="padding:9px 14px; border: 1px solid #aaa;">Only after intent is matched and trust is verified does a payment execute.</td>
    </tr>
  </tbody>
</table>

---

## The Unsolved Problem: Who Sits in the Middle?

<small><em>Assumption 1 — **Vendor ↔ Vendor Agent trust is solved**. Merchants have already authorized their agents to act. ACP handles merchant onboarding and connectivity.</em></small>

<small><em>Assumption 2 — **Human ↔ Personal Agent trust is solved**. For small and micropayments, users pre-delegate authority. The agent acts within a policy envelope without interrupting the user.</em></small>

**What is not solved: Personal Agent ↔ Vendor Agent trust.**

When a personal agent sends an intent request toward a vendor agent, several questions have no structural answer today:

- How does the personal agent know this vendor agent is legitimate and not spoofed?
- How does the vendor agent know the personal agent's intent is real and carries valid authorization?
- Who surfaces and ranks vendor agents to personal agents in the first place? (The **"SEO for agents"** gap. ACP solves connectivity, not discovery or ranking.)
- If the transaction fails, who arbitrates between two agents when neither human was watching in real time?

In human-to-human commerce these problems were solved by platforms: Google ranked vendors, Amazon certified sellers, Stripe verified merchants, Visa arbitrated disputes. But all of that infrastructure was designed for a human clicking a button and not for an agent making an autonomous sub-second decision.

### Does This Need a Middle Layer?

I believe yes and that is the opportunity. The Intent + Trust Layer shown in the diagram. It is missing infrastructure. A matchmaking layer between agents would have three core jobs:

1. **Discovery and ranking** — Surfaces the right vendor agents to a personal agent based on structured intent. The equivalent of a search index, but for agents rather than pages.
2. **Trust credentialing** — Provides verifiable signals that a vendor agent is legitimate and that a personal agent's intent is authentic and authorized. This will reduce the settlement duration and I think better money company is building something similar as a clearing houses infrastaructure for stablecoin payments. 
3. **Dispute scaffolding** — When a transaction executed by two agents fails or is contested, provides a structured recovery path without requiring the human to reconstruct what happened.

---

## The Timeline

<table style="width:100%; border-collapse:collapse; font-size:0.95rem; margin: 1rem 0;">
  <thead>
    <tr>
      <th style="text-align:left; padding:10px 14px; border: 1px solid #aaa;">Year</th>
      <th style="text-align:left; padding:10px 14px; border: 1px solid #aaa;">Status</th>
      <th style="text-align:left; padding:10px 14px; border: 1px solid #aaa;">What Is Happening</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td style="padding:9px 14px; border: 1px solid #aaa;"><strong>2025</strong></td>
      <td style="padding:9px 14px; border: 1px solid #aaa;">Underway</td>
      <td style="padding:9px 14px; border: 1px solid #aaa;">OpenAI and Stripe co-launched the <strong>Agentic Commerce Protocol (ACP)</strong>, enabling agents to discover products, negotiate checkout, and complete transactions. Salesforce joined a month later. <strong>48% of shoppers</strong> who already use AI are open to having an agent make purchases for them.</td>
    </tr>
    <tr>
      <td style="padding:9px 14px; border: 1px solid #aaa;"><strong>2026</strong></td>
      <td style="padding:9px 14px; border: 1px solid #aaa;">Underway</td>
      <td style="padding:9px 14px; border: 1px solid #aaa;">Agents help users find and buy products, but trust, authorization, and recovery still rely on existing checkout infrastructure. The plumbing is borrowed from a pre-agent world.</td>
    </tr>
    <tr>
      <td style="padding:9px 14px; border: 1px solid #aaa;"><strong>2027</strong></td>
      <td style="padding:9px 14px; border: 1px solid #aaa;">The Gap</td>
      <td style="padding:9px 14px; border: 1px solid #aaa;">As agent-to-agent commerce scales, the bottleneck shifts from payment execution to the layer above it — deciding who to trust, what to authorize, and how to recover when things fail.</td>
    </tr>
  </tbody>
</table>

---

## Friction Points

<table style="width:100%; border-collapse:collapse; font-size:0.95rem; margin: 1rem 0;">
  <thead>
    <tr>
      <th style="text-align:left; padding:10px 14px; border: 1px solid #aaa;">Friction</th>
      <th style="text-align:left; padding:10px 14px; border: 1px solid #aaa;">Why It Matters</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td style="padding:9px 14px; border: 1px solid #aaa;"><strong>Intent translation</strong></td>
      <td style="padding:9px 14px; border: 1px solid #aaa;">Human preferences are messy; agents need structured buying instructions or protocols to act reliably on a user's behalf.</td>
    </tr>
    <tr>
      <td style="padding:9px 14px; border: 1px solid #aaa;"><strong>Recovery</strong></td>
      <td style="padding:9px 14px; border: 1px solid #aaa;">ServiceNow launched an AI Control Tower in 2026 specifically to govern agent actions and flag violations in real time but dispute resolution for commerce transactions remains unsolved.</td>
    </tr>
    <tr>
      <td style="padding:9px 14px; border: 1px solid #aaa;"><strong>Merchant trust</strong></td>
      <td style="padding:9px 14px; border: 1px solid #aaa;">Agents need proof that a vendor is reliable before selecting them. There is currently no standardized credentialing layer for merchants in agentic flows.</td>
    </tr>
    <tr>
      <td style="padding:9px 14px; border: 1px solid #aaa;"><strong>Auditability</strong></td>
      <td style="padding:9px 14px; border: 1px solid #aaa;">Businesses will need records of why an agent made a transaction for compliance, dispute resolution, and internal governance.</td>
    </tr>
  </tbody>
</table>

---
## Why This Matters

The previous two platform shifts search and social were won by whoever controlled the interface between human intent and the internet. 

Search won by structuring *what people wanted to find*. 
Social won by structuring *what people paid attention to*.

Now the question is who captures the attention and value through intent here. 

Thankyou for reading