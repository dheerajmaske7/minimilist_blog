---
layout: post
title: "Arbitrage Opportunity in Prediction Markets"
date: 2025-01-16
excerpt: "A practical walkthrough of arbitrage opportunities in prediction markets—and why most of them are not worth the effort."
---

# Arbitrage Opportunity in Prediction Markets

## Scenario

There is a trade that asks:

**“Who will win the NYC Mayor Election?”**

The same market exists on two platforms:
- The first image represents **Polymarket**
- The second image represents **Kalshi**

![Predication](\assets\images\Predication_markets\P.png)



Both list prices for the same outcome, but with different probabilities.

---

## The Setup

Let’s say we bet on **Candidate 1**, but with **opposite outcomes** on each platform.

- **Polymarket (NO)** price = **$0.071**
- **Kalshi (YES)** price = **$0.90**

Each contract:
- Pays **$1** if correct
- Pays **$0** if incorrect

---

## Initial Intuition: Risk-Free Profit?

If we:
- Bet **$1** on NO
- Bet **$100** on YES  

Then:

- If **NO wins** → Profit ≈ **$12.87**
- If **YES wins** → Profit ≈ **10%**

At first glance, this looks like a **win-win arbitrage**.

---

## The Arbitrage Condition

Let:
- **Y** = price of YES
- **N** = price of NO  

Then:

Gross profit per paired share = 1 − (Y + N)


### Rule:
- If **Y + N < 1** → theoretical positive spread  
- If **Y + N ≥ 1** → no arbitrage (or negative)

### In this example:
Y + N = 0.971
Gross profit per trade = 0.029 (~2.9%)


So theoretically, this is a **BUY**.

---

## Introducing Frictions

In reality, trades are not frictionless.

Let **x** represent:
- Trading fees
- Slippage
- Withdrawal costs
- Platform inefficiencies

The real condition becomes:

Y + N + x < 1


Only then does the arbitrage remain profitable.

---

## Capital Allocation Example

Let’s say total capital = **$300**

Define:
q = Y + N ≈ 0.98

Required capital:
300 / 0.98 ≈ 306.12


So we take **306 paired contracts**.

### Allocation:
- **306 YES contracts** at $0.06  
  → Cost = 306 × 0.06 = **$18.36**

- **306 NO contracts** at $0.92  
  → Cost = 306 × 0.92 = **$281.52**

### Total deployed:
$281.52 (Kalshi) + $18.36 (Polymarket)


---

## Gross vs Net Profit

- **Gross profit** = **$6.12**
- **Estimated total friction** ≈ **1.6% – 2%** of notional  
  → ≈ **$6.00**

### Net profit:
6.12 − 6.00 = $0.12


- **Net profit percentage** ≈ **0.04%**

---

## Scaling the Trade

If capital = **$10,000**:

- Guaranteed profit ≈ **$4**

---

## Conclusion

- The arbitrage exists **in theory**
- In practice, **fees eat almost everything**
- The risk is low, but so is the reward

**Too much pain for very little gain.**

---

## Actionable Insight

Arbitrage only makes sense when:

Y + N << 1


You must:
- Anticipate the trade early
- Lock in positions before prices converge
- Account for all frictions upfront

Otherwise, it’s better left alone.
