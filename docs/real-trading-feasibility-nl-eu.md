# Real cryptocurrency trading feasibility — Netherlands / EU

Reviewed 9 October 2026 using the official sources linked below. This is a scoping assessment, not an authorization or legal opinion. QuickExit remains paper-only. Obtain Dutch regulatory counsel's written assessment before a real-trading design or commercial commitment.

## Recommendation and launch boundary

Launch the simulated product first, conditional on its security and operational gates. Treat real trading as a separate regulated project. AFM says even the best-case CASP application takes at least five months, so an own-license route cannot fit the proposed 3–5 week launch window. [AFM CASP licensing](https://www.afm.nl/en/sector/cryptopartijen/vereisten-en-vergunningen/casp-vergunning).

| Model | Feasibility / decision gate |
| --- | --- |
| Paper-only | Current scope: no customer deposits, crypto custody or real orders. Review consumer/privacy claims and avoid suggesting authorization. |
| Referral to provider-owned trading | Potentially simpler; provider owns customer onboarding and trading. Counsel must assess QuickExit's marketing, remuneration and actual activities. |
| Embedded authorized provider | Investigate first for future trading. Confirm contractual allocation, exact legal entity and authorized services; QuickExit's own order handling and target automation still require assessment. |
| QuickExit as CASP | Full licensing, prudential, governance, compliance and operational program; separate funding and much longer schedule. |

MiCA covers specified services including custody, exchange, execution, reception/transmission of orders, advice and portfolio management. An interface transmitting orders or automatically executing a target may therefore be in scope; that is an inference from the definitions, not a determination of QuickExit's status. CASP authorization or an applicable Article 60 route is required for regulated service provision. Outsourcing does not remove a CASP's responsibilities or alter its client relationship. A partner license does not automatically authorize QuickExit. [MiCA definitions](https://www.esma.europa.eu/publications-and-data/interactive-single-rulebook/mica/article-3-definitions), [Article 59](https://www.esma.europa.eu/publications-and-data/interactive-single-rulebook/mica/article-59-authorisation), [Article 73](https://www.esma.europa.eu/publications-and-data/interactive-single-rulebook/mica/article-73-outsourcing).

## Provider due diligence before selection

Verify the exact contracting entity, current authorization, relevant services and Netherlands cross-border entitlement in official registers. A familiar brand or an existing public price API is insufficient. No provider has been selected or contacted, and no current provider license has been asserted here. [AFM crypto register](https://www.afm.nl/en/sector/registers/vergunningenregisters/cryptopartijen), [ESMA registers](https://www.esma.europa.eu/publications-and-data/databases-and-registers).

Request written answers covering:

- Retail Netherlands availability; EUR spot pairs; commercial embedded API rights; customer/provider contract and legal roles; whether QuickExit requires authorization.
- Provider-hosted identity onboarding, AML/sanctions duties, ongoing monitoring, Travel Rule support, escalation and account freezes; who handles complaints and suspicious-transaction reports.
- Individual customer account segregation, custody model, asset/client-fund segregation, insolvency treatment, permitted order types and API restrictions.
- Fiat rails and an appropriately licensed payment service arrangement where necessary; no assumption that MiCA authorizes payment services.
- Order idempotency, reconciliation, partial fills, rejection/cancel races, exchange outages, rate limits, webhook signatures/replay prevention and sandbox fidelity.
- Fees/minimums, capital and commercial commitments, SLA/incident obligations, audit rights, sub-processors, exit/portability and data-retention terms. Costs cannot be responsibly estimated without scope and quotes.

AFM discusses custody segregation, payment-service authorization and DORA operational obligations. Financial-instrument derivatives require separate MiFID analysis; constrain initial feasibility to spot crypto without leverage. [AFM regulatory FAQ](https://www.afm.nl/en/sector/cryptopartijen/contact-qa).

## Identity, AML and transfer controls

A KYC form alone is insufficient. Assess risk-based customer due diligence, beneficial ownership where applicable, ongoing monitoring, sanctions screening, unusual-transaction reporting and accountable policies with the provider and counsel. Dutch Wwft and sanctions obligations apply to CASPs. Transfer rules require originator/beneficiary information; self-hosted wallet controls also apply. The EUR 1,000 ownership-verification rule is not a general exemption from AML or transfer information requirements. [AFM AML guidance announcement](https://www.afm.nl/nl-nl/sector/actueel/2025/mei/sb-annex-wwft-sw-cryptopartijen), [AFM Transfer of Funds Regulation guidance](https://www.afm.nl/nl-nl/sector/themas/voorkomen-witwassen-terrorismefinanciering-naleving-sanctiewet/transfer-of-funds-regulation).

Prefer provider-hosted verification to retaining raw identity documents. Establish controller/processor roles, lawful processing, access controls, retention, rights handling and risk assessment before collecting identity data. Paper accounts should not start collecting KYC documents merely to anticipate a future regulated service.

## Engineering boundary

The current browser-driven simulated execution engine and client-authored portfolio snapshots are not a real-money ledger. Do not convert demo balances, historical simulated receipts or targets into real assets/orders.

A separately approved system would require server-authoritative account/fund ownership, append-only reconciled ledger entries, provider-specific amount/tick precision, verified fills rather than quote-based assumed execution, durable order workers, idempotency and external reconciliation. Target exits must work independently of a browser remaining open. Handle partial fills, fees in different assets, cancellation races and uncertain provider responses explicitly.

Keep execution credentials server-side in managed secret storage with least privilege, withdrawal permissions disabled unless separately approved, key rotation and restricted egress. Add step-up authentication, operational controls and independent security review. Quote freshness is necessary but does not guarantee executable prices. Preserve separate unmistakable paper and real modes, with no automatic migration or shared mutable balances.

Own-CASP prudential safeguards depend on services and annual fixed overheads; MiCA permits specified own-funds/insurance arrangements. Obtain service-specific advice and budgets instead of assuming one fixed capital requirement. [MiCA Article 67](https://www.esma.europa.eu/publications-and-data/interactive-single-rulebook/mica/article-67-prudential-requirements).

## Go / no-go sequence

1. Written legal service/authorization assessment and agreed customer journey.
2. Registry-verified provider, approved contract and compliance responsibility matrix.
3. Costed operating/compliance/security plan with incident and complaint owners.
4. Separate sandbox ledger/execution architecture and adversarial reconciliation tests.
5. Independent security/compliance review and explicit approval for a bounded real-money pilot.

No real-trading adapter, funds flow, KYC collection, payment feature or hosted configuration change has been implemented by this assessment.
