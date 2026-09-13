/* Shared content for both fillable PDFs. Mirrors the two HTML checklists
   (drafts/charity-partner-standards-review.html and -quick-screen.html).
   Keep in sync with those if the wording changes. */

export const PARTS = {
  A: 'Part A — Legal & regulatory standing',
  B: 'Part B — Public identity & communications',
  C: 'Part C — Programs & evidence',
  D: 'Part D — Organizational clarity',
  E: 'Part E — Fundraising oversight',
};

export const SCALE_LEGEND =
  'Meets — evidence present and adequate   ·   Minor gaps — mostly there, small fixes   ·   ' +
  'Material concern — real weakness, needs a plan and a re-check   ·   ' +
  'Fails — absent or deficient, a blocker   ·   N/A — not applicable (say why)';

export const FILL_NOTE =
  'This is a fillable form. Tap or click any box or field to complete it on a phone, tablet or computer. ' +
  'To keep your answers, save the file from your PDF app: on iPhone/iPad use the share icon, then “Save to Files” ' +
  '(or open it in Books); on Android use “Save a copy” in Acrobat or a PDF editor; in a desktop browser or ' +
  'Acrobat use “Save as” / download. Google Drive’s built-in preview is read-only — open the file in a PDF ' +
  'editor first.';

export const FOOTNOTE =
  'Internal screening tool, not legal advice. Charitable-solicitation registration, fundraiser bonding, disclosure ' +
  'language and permit rules are specific to each state and locality and change over time — confirm current ' +
  'requirements with qualified counsel, and the organization’s own financial position with its accountant.';

export const RATING_OPTS = [
  ['pass', 'Meets'], ['minor', 'Minor'], ['concern', 'Concern'], ['fail', 'Fails'], ['na', 'N/A'],
];

export const OUTCOME_PROSPECTIVE = [
  ['proceed', 'Proceed'],
  ['conditions', 'Proceed with conditions'],
  ['hold', 'Hold pending fixes / remediation'],
  ['decline', 'Decline'],
];
export const OUTCOME_CURRENT = [
  ['continue', 'Continue'],
  ['cap', 'Continue with corrective-action plan'],
  ['suspend', 'Suspend pending remediation'],
  ['exit', 'Begin exit'],
];

export const CRITERIA = [
  {
    n: 1, part: 'A',
    title: 'Tax-exempt status: 501(c)(3) determination & IRS Form 990',
    shortTitle: 'Tax-exempt status & finances',
    what: 'Confirms the organization is a recognised public charity in good standing and that its money holds up to inspection.',
    purpose: 'Confirms the organization is a recognised tax-exempt public charity in good standing, and that its finances hold up to inspection — donors and property owners routinely ask a rep to prove both.',
    checks: [
      'Current IRS 501(c)(3) determination letter; listed active in IRS Tax Exempt Organization Search (not auto-revoked)',
      'Legal name and EIN match across the letter, the Forms 990, the website and bank details',
      'Last three Forms 990 filed on time; the full form where revenue requires it',
      'Program spending is a clear majority of expense; fundraising and admin are reasonable and stable year to year',
      'Independent board majority; conflict-of-interest and whistleblower policies in place; board reviews the 990',
    ],
    flags: 'Can’t produce the determination letter; auto-revoked or lapsed; multi-year deficits or negative net assets; fundraising cost a large or rising share of contributions; payments to companies tied to board or staff.',
    collect: [
      'The IRS determination letter granting 501(c)(3) status, in the organization’s current legal name.',
      'A screenshot of the organization’s active listing in IRS Tax Exempt Organization Search, and confirmation it is not on the automatic-revocation list.',
      'The three most recent Forms 990 as filed (990, 990-EZ or 990-N as applicable), with all schedules.',
      'The most recent audited or reviewed financial statements, and the board-approved annual budget.',
      'If the organization operates under a fiscal sponsor: the written fiscal-sponsorship agreement and the sponsor’s own status.',
      'Any state income / franchise / sales-tax exemption confirmations relevant to where it operates.',
    ],
    standard: [
      'Valid determination letter; classified as a public charity (e.g. 509(a)(1) or (a)(2)), not a private foundation, unless the engagement specifically contemplates otherwise.',
      'Name and EIN match across the letter, the 990s, the website and the bank details.',
      '990s filed on time; the full form (not just the 990-N postcard) where revenue requires it.',
      'Program-service expense is a clear majority of total expense; fundraising and management/general are reasonable and stable year to year.',
      'Revenue is stable or growing; an operating reserve exists; no going-concern language in the audit.',
      'Executive compensation is disclosed and reasonable for the organization’s size and region.',
      'Governance section of the 990 is clean: independent board majority, and conflict-of-interest, whistleblower and document-retention policies in place; the board reviews the 990 before filing.',
      'Schedule G (fundraising) and Schedule L (interested-person transactions) contain nothing unexplained.',
    ],
    warnings: [
      'Cannot produce the determination letter; status is “pending”; fiscal sponsorship with no written agreement.',
      'On the automatic-revocation list, lapsed, or recently reinstated after revocation with no clear explanation.',
      'Missing or late 990 years; a 990-N filed while revenue clearly exceeds the threshold.',
      'Fundraising cost is a large or fast-rising share of contributions; multi-year deficits; negative net assets.',
      'Payments to companies tied to board or staff; loans to officers; large unexplained “miscellaneous” lines.',
      'One donor or grant is effectively the entire budget; public impact claims that the 990 does not support.',
    ],
  },
  {
    n: 2, part: 'A',
    title: 'Charitable-solicitation registration, fundraiser bond & permits',
    shortTitle: 'Solicitation registration, fundraiser bond & permits',
    what: 'Confirms the organization — and the fundraising firm acting for it — is registered, bonded and permitted everywhere the work will happen. State and local rules vary; confirm with counsel.',
    purpose: 'Paid, in-person fundraising is regulated state by state and often locally. This criterion confirms the organization — and the fundraising firm acting for it — is registered, bonded and permitted everywhere the work will happen. Requirements, dollar thresholds and exemptions vary widely by jurisdiction and change often — treat the items below as prompts and confirm the current rule for each state and locality with qualified counsel.',
    checks: [
      'Charitable-solicitation registration active in every state where it solicits',
      'Professional fundraiser / solicitor registered and bonded where required (bond current, meets the state minimum)',
      'Written charity–firm contract with the state-mandated disclosures, filed where required',
      'Local canvassing / solicitation permits for the specific areas to be worked',
      'No open or recent enforcement action from any state attorney general or charity regulator',
    ],
    flags: '“We don’t need to register” with no written basis; expired registrations or unfiled state reports; no bond where one is required; any regulator action or assurance of voluntary compliance over solicitation.',
    collect: [
      'Proof of charitable-solicitation registration in every state where the organization solicits (most states require it; some exempt very small organizations).',
      'Registration or licensing of the professional fundraiser / professional solicitor / fundraising counsel as each state defines those roles.',
      'The surety bond on file wherever a state requires paid solicitors to be bonded — amount, carrier and expiration date.',
      'The written contract between the organization and the fundraising firm, filed with the state where required, carrying the state-mandated disclosures.',
      'Local permits — canvassing, peddler, solicitation or door-to-door permits — for the specific municipalities to be worked.',
      'Copies of the organization’s annual financial reports to state charity regulators for the last two years.',
      'Any raffle, gaming or sales-tax permits if those activities occur alongside solicitation.',
    ],
    standard: [
      'All registrations are active, unexpired, and renewals are tracked on a calendar with a named owner.',
      'Fundraiser registration and bond are current; the bond amount meets or exceeds the state minimum.',
      'State annual financial reports have been filed for every required year.',
      'The charity–firm contract carries the state-mandated clauses — the charity’s right to cancel the contract, the percentage or fee split stated plainly, and the paid-solicitor disclosure reps must give at the point of solicitation.',
      'The organization can name the person responsible for solicitation compliance and show how new jurisdictions get cleared before work starts.',
      'No open or recent enforcement matters with any state attorney general or charity regulator.',
    ],
    warnings: [
      '“We don’t need to register” with no written legal basis; active solicitation in states with no registration on file.',
      'Expired or lapsed registrations; unfiled state annual reports.',
      'No bond where one is required, or a bond past its expiration date.',
      'No written contract, or one missing the state-mandated disclosures.',
      'Any history of fines, cease-and-desist orders, or an assurance of voluntary compliance with a state regulator over solicitation practices.',
      'Pressure to start in the field before permits or registrations are confirmed.',
    ],
  },
  {
    n: 3, part: 'B', title: 'Website', shortTitle: 'Website',
    what: 'Confirms the organization is real, current and transparent to a donor who checks after a doorstep conversation.',
    purpose: 'The first place a donor checks after a doorstep conversation. It has to confirm the organization is real, current and transparent within about thirty seconds.',
    checks: [
      'Organization-owned domain, loads over HTTPS, design consistent with its other materials',
      'Named leadership and board with bios; a real address and a working phone and email',
      'Financials posted (annual report, audited statements or the 990) and a secure donate path',
      'Updated within roughly the last quarter',
    ],
    flags: 'No named leadership or address; no financials anywhere; donate button to a personal payment handle; nothing updated in a year; impact numbers that don’t match the 990.',
    collect: [
      'The live URL, plus a WHOIS / domain-registration check showing the organization owns the domain.',
      'The About / Leadership / Board page, the financials / annual report page, and the donate flow.',
      'The privacy policy and any donor-privacy statement.',
      'The date of the most recent news / blog / event post.',
    ],
    standard: [
      'Organization-owned domain; loads over HTTPS; design consistent with its other materials.',
      'Clear statement of mission, the specific programs, who is served and where.',
      'Named leadership and board with short bios; a real address and a working phone and email.',
      'Financial transparency on the site: annual report, audited financials or the 990, and/or an impact report.',
      'A secure donate path that explains how gifts are used and offers a recurring option; card processing on a reputable platform.',
      'Updated within roughly the last quarter; third-party trust marks (Candid Seal, Charity Navigator, BBB) that resolve to a real profile.',
    ],
    warnings: [
      'Domain registered very recently or to an unrelated party; no HTTPS; broken or placeholder pages.',
      'No named leadership, no address, contact only through a form.',
      'No financial information anywhere; donate button links to a personal payment handle.',
      'Nothing updated in a year or more; impact numbers with no source; claims that conflict with the 990.',
    ],
  },
  {
    n: 4, part: 'B', title: 'Social media', shortTitle: 'Social media',
    what: 'Confirms the organization is active and handles public questions and criticism professionally.',
    purpose: 'Shows whether the organization is active, whether real people engage with it, and how it handles questions and criticism in public.',
    checks: [
      'Official accounts linked from the website, consistent name and branding',
      'Posts at least monthly with real program content, not only donation asks',
      'Engagement looks organic; complaints and questions answered in public, professionally',
    ],
    flags: 'Dormant or abandoned accounts; engagement wildly out of line with follower count; unanswered or hostile replies; content that contradicts the organization’s own claims.',
    collect: [
      'Handles for each platform, linked from the website so they are verifiably official.',
      'Screenshots of the last month or two of posts on each active account.',
      'A follower / engagement snapshot per platform.',
      'Examples of how the organization has replied to a public question or complaint.',
    ],
    standard: [
      'Consistent name, handle and branding across platforms, matching the website.',
      'Posts at least monthly — ideally weekly — with genuine program content, not only donation asks.',
      'Engagement is proportionate to the audience and looks organic; the organization answers questions and complaints professionally, in public.',
      'No misleading urgency, no fabricated matching-gift claims, tone appropriate to a charity.',
    ],
    warnings: [
      'Dormant or abandoned accounts; last post long ago.',
      'Follower count wildly out of line with engagement (purchased following).',
      'Unanswered complaints, or defensive / hostile replies.',
      'Content that contradicts the organization’s own program claims or filings.',
      'No presence at all for an organization that solicits the general public.',
    ],
  },
  {
    n: 5, part: 'B', title: 'Newsletters & donor communications', shortTitle: 'Newsletters & donor communications',
    what: 'Confirms the organization reports back to donors rather than only asking.',
    purpose: 'Regular reporting back to donors is the clearest sign an organization treats a gift as the start of a relationship rather than the end of a transaction.',
    checks: [
      'A regular newsletter (email and/or print), several recent issues, reporting on program impact',
      'Gift acknowledgements are prompt and carry the IRS-required details (organization name, the amount or a description of what was given, and whether goods or services were given in return)',
      'A clear, honoured unsubscribe / contact-preference process',
    ],
    flags: 'No donor communication in the last year; every message an emergency appeal with no reporting on prior gifts; acknowledgements missing required elements or not sent.',
    collect: [
      'The last three to four issues of the email and/or print newsletter.',
      'The publishing cadence (monthly, quarterly) and the list size / open rates if the organization will share them.',
      'A sample gift acknowledgement and a sample year-end tax receipt.',
      'The subscribe mechanism and the unsubscribe / preference process.',
    ],
    standard: [
      'Predictable cadence with several recent issues; content is program and impact reporting, not a continuous appeal.',
      'Acknowledgements are prompt and carry the IRS-required elements — the organization’s name, the amount of cash or a description of any non-cash gift, and whether any goods or services were given in return (with a good-faith value if so).',
      'Clear, honoured unsubscribe; a stated approach to how often the organization contacts donors.',
      'Stories about beneficiaries are told with dignity and, where identifiable, with consent.',
    ],
    warnings: [
      'No donor communication at all, or nothing sent in the last year.',
      'Every message is an emergency appeal; no reporting on what prior gifts achieved.',
      'Acknowledgements missing required elements, or not sent.',
      'No way to opt out, or opt-outs ignored.',
    ],
  },
  {
    n: 6, part: 'B', title: 'Letterhead & official stationery', shortTitle: 'Letterhead & official stationery',
    what: 'Confirms the engagement is properly documented — field reps carry an authorization letter donors and property owners ask to see.',
    purpose: 'Field reps carry a letter of authorization on the organization’s letterhead; donors and property owners ask to see it. The stationery set is a quick read on organizational maturity and on whether the engagement is properly documented.',
    checks: [
      'Professional letterhead with the legal name, address, phone, EIN and a 501(c)(3) line',
      'A current, signed, dated authorization letter naming the fundraising firm, the territory and the date range',
      'A gift-receipt template with the IRS-required substantiation language',
      'Branding consistent across letterhead, website and social accounts',
    ],
    flags: 'No letterhead or an informal template; authorization letter undated, unsigned or generic about scope; a different legal name or address than the determination letter.',
    collect: [
      'The letterhead template (print and digital).',
      'A current, signed authorization letter on letterhead naming the fundraising firm, the territory and the campaign date range.',
      'The gift-acknowledgement / receipt template.',
      'Rep-facing identification: ID badge and business-card templates, and any branded canvassing materials.',
    ],
    standard: [
      'Professionally designed letterhead showing the legal name, address, phone, website, EIN and a 501(c)(3) line.',
      'Authorization letter is dated, signed by an officer, and specific about who is authorized to do what, where and when.',
      'Acknowledgement text includes every IRS-required element for substantiation.',
      'Branding on the letterhead, website and social accounts is visibly the same organization.',
    ],
    warnings: [
      'No letterhead, or an informal / inconsistent template.',
      'No authorization letter, or one that is undated, unsigned, or generic about scope.',
      'Receipt text missing required IRS language.',
      'Letterhead shows a different legal name or address than the determination letter.',
    ],
  },
  {
    n: 7, part: 'B', title: 'Public relations & reputation', shortTitle: 'Public relations & reputation',
    what: 'Confirms independent credibility — and surfaces solicitation complaints or regulator actions before they become the firm’s problem.',
    purpose: 'Independent coverage and watchdog ratings are borrowed credibility a rep can point to. A reputation search is also where solicitation complaints and regulator actions surface before they become the firm’s problem.',
    checks: [
      'Some verifiable earned media or third-party recognition, not only paid placements',
      'Watchdog profiles claimed and acceptable (Charity Navigator, Candid Seal, BBB Wise Giving, CharityWatch)',
      'Independent search shows no material litigation, regulator actions, or pattern of donor complaints',
      'A named person owns fundraising-related inquiries and complaints',
    ],
    flags: 'No third-party footprint; low or unclaimed watchdog profiles; lawsuits or AG inquiries alleging misuse of funds or deceptive solicitation; recurring complaints about aggressive or misleading fundraising.',
    collect: [
      'The media / press page, recent press releases, and a list of earned coverage (articles, broadcast, podcasts).',
      'A named media contact or agency, and any crisis-communications plan or designated spokesperson.',
      'Results of an independent reputation search — news, court records, state regulator actions, forums, complaint sites, BBB complaints, employee-review sites.',
      'Watchdog profiles: Charity Navigator score, Candid / GuideStar Seal of Transparency level, BBB Wise Giving Alliance standards result, CharityWatch grade.',
    ],
    standard: [
      'Some verifiable earned media or third-party recognition, not only paid placements.',
      'Watchdog profiles are claimed, complete and rate acceptably; BBB Wise Giving standards met.',
      'No material litigation, no regulator actions, no pattern of donor or consumer complaints.',
      'A named person owns fundraising-related inquiries and complaints, with a plan for handling a news query.',
    ],
    warnings: [
      'No third-party footprint at all, or only sponsored content.',
      'Low watchdog ratings, or profiles that are unclaimed and thin.',
      'Active lawsuits, attorney-general inquiries, or coverage alleging misuse of funds or deceptive solicitation.',
      'Recurring public complaints about aggressive or misleading fundraising.',
      'No spokesperson and no plan — every inquiry would default to the fundraising firm.',
    ],
  },
  {
    n: 8, part: 'C', title: 'Program content & documented outcomes', shortTitle: 'Program content & documented outcomes',
    what: 'Confirms every claim a rep will make on the doorstep traces to a real program and a countable source.',
    purpose: 'The specific, checkable description of what the organization does — “counselling for 77 veterans this year,” not “helping those in need.” This is the content reps are trained on and the content that has to hold up if a donor probes.',
    checks: [
      'Written description of each program: who is served, what’s delivered, where, and how many',
      'Current-year output numbers, with a note on how each one is counted',
      'Outcome measures, not just outputs — what changed for the people served',
      'Numbers are consistent across program docs, the website, social posts and the 990',
      'Programs match the exempt purpose in the determination letter',
    ],
    flags: 'Vague mission, no specific programs, no numbers; large round claims with no denominator or source; figures that conflict between documents; the “program” is mostly awareness or marketing.',
    collect: [
      'A written description of every program: who it serves, eligibility, what is delivered, where, by whom, and at what volume.',
      'A logic model or theory of change — inputs, activities, outputs, outcomes.',
      'Current-year output numbers (people served, sessions, meals, beds, grants) and a note on how each is counted.',
      'Outcome measures — what changed for the people served, how it is measured, over what period.',
      'The most recent impact / annual report and any independent program evaluation.',
      'Enough of the underlying data source (case-management system, intake records, surveys) to see the headline numbers are real.',
    ],
    standard: [
      'Every public impact claim traces to a specific program and a countable source.',
      'Outputs and outcomes are distinguished — e.g. “1,200 counselling sessions delivered to 77 veterans” and “68% reported reduced symptoms at 90 days.”',
      'The numbers are internally consistent across program documents, the website, social posts and the 990.',
      'Programs match the exempt purpose in the determination letter.',
      'Cost per person served / per outcome is explainable and reasonable.',
    ],
    warnings: [
      'Vague mission language, no specific programs, no numbers.',
      'Large round claims (“changed thousands of lives”) with no denominator and no source.',
      'Figures that conflict between documents.',
      'The “program” is mostly awareness or marketing, with little direct service.',
      'Staff cannot say how a headline number was counted.',
    ],
  },
  {
    n: 9, part: 'C', title: 'Testimonials & third-party validation', shortTitle: 'Testimonials & third-party validation',
    what: 'Confirms independent voices — beneficiaries, partner institutions, funders — corroborate the program story.',
    purpose: 'Independent voices — beneficiaries, partner institutions, funders — corroborate the program story. Funders in particular have done their own diligence, so their involvement is a useful shortcut.',
    checks: [
      'Specific, attributable testimonials (not anonymous one-liners), with consent on file for anyone featured',
      'A few named institutional partners or funders who can be contacted for a reference',
      'Third-party validation is recent (last year or two)',
    ],
    flags: 'Only anonymous, generic quotes; stock imagery presented as beneficiaries; no partners or funders; nothing that can be corroborated; identifiable vulnerable people featured with no evidence of consent.',
    collect: [
      'Beneficiary testimonials with consent / release on file, ideally attributable or with verifiable context.',
      'Donor and volunteer testimonials.',
      'A partner list — other nonprofits, agencies, hospitals, schools, employers — with a contact who will confirm the relationship.',
      'A funder list (foundations, government grants), plus awards, accreditations and coalition memberships.',
    ],
    standard: [
      'Testimonials are specific and attributable, not anonymous one-liners.',
      'At least a few named institutional partners or funders who can be contacted for a reference.',
      'Consent / releases on file for anyone featured, especially minors or patients.',
      'Third-party validation is recent (last year or two), not a single decade-old award.',
    ],
    warnings: [
      'Only anonymous, generic quotes; stock imagery presented as beneficiaries.',
      'No institutional partners or funders; unable to supply any reference.',
      'Testimonials that cannot be corroborated or that read as written in-house.',
      'Identifiable vulnerable people featured with no evidence of consent.',
    ],
  },
  {
    n: 10, part: 'D', title: 'Defined structure, stats, facts & figures', shortTitle: 'Structure, facts & figures',
    what: 'Confirms the organization can state plainly what it is, who runs it and how big — and that it matches the filings.',
    purpose: 'A single fact sheet the organization can stand behind: governance, leadership, the key numbers, and — for a current partner — a clean record of what past campaigns actually produced.',
    checks: [
      'An org chart and a current board roster (names, outside affiliations, terms)',
      'Bylaws and key governance policies; the board meets and keeps minutes',
      'A facts sheet: legal name, EIN, year founded, staff and volunteer count, budget, service area, number served',
      'Independent board majority; not family-controlled; chair, treasurer and executive director are different people',
      'For a current partner: past campaign results, scoped by period and campaign, pulled from a named system',
    ],
    flags: 'No org chart or current board list; a tiny or family board; no bylaws or minutes; facts that shift between conversations or don’t match the filings.',
    collect: [
      'An org chart covering governance and staff.',
      'Board roster: names, outside affiliations, roles, terms and committee assignments; confirmation the board meets and keeps minutes.',
      'Leadership bios with tenure for the executive director / CEO and senior staff.',
      'Bylaws and the key governance policies — conflict of interest (signed annually), whistleblower, document retention, gift acceptance, financial controls.',
      'A facts block: legal name, DBA, EIN, state of incorporation, year founded, fiscal year end, staff headcount, volunteer count, annual operating budget, service area, number served per year.',
      'For a current partner: historical fundraising results — funds raised, donors acquired, retention, cost ratio — each with a date range and the internal system it came from.',
    ],
    standard: [
      'Every fact above is available on request and is consistent with the 990 and the website.',
      'Independent board majority; more than three directors; not family-controlled; the same person is not chair, treasurer and executive director.',
      'Documented internal financial controls — dual signature, bank reconciliation, budget-versus-actual reporting to the board.',
      'A named person on the organization’s side owns the fundraising relationship.',
      'For current partners: results are scoped (period, campaign, geography) and pulled from a named system, not recalled from memory.',
    ],
    warnings: [
      'No org chart or no current board list.',
      'Tiny or family board; officers also paid as board members.',
      'No bylaws, no policies, no minutes.',
      'Facts that change between conversations or do not match the filings.',
      'For current partners: no clean data on what previous campaigns raised or cost.',
    ],
  },
  {
    n: 11, part: 'E', title: 'Representative management & field conduct', shortTitle: 'Representative management & field conduct',
    what: 'Confirms the relationship is documented, reps have approved messaging and identification, and complaints have somewhere to go.',
    purpose: 'The engagement puts people on the street speaking for the organization. This criterion checks that the relationship is documented, that reps have approved messaging and identification, and that complaints have somewhere to go.',
    checks: [
      'A signed, current charity–firm agreement: scope, territory, supervision, required disclosures, termination, insurance, data ownership',
      'A written code of conduct and an approved script / FAQ; disclosure practice matches the rules for every state worked',
      'Rep identification (badges) and a public way for a donor to verify a rep is authorized',
      'Donor-data handling: secure transmission, retention, do-not-contact / suppression, and a card-data policy',
      'A documented complaint process with named owners and response times — and evidence it has been used',
      'The organization actively monitors field conduct rather than delegating it entirely to the firm',
    ],
    flags: 'Handshake deal or expired contract; scripts that promise outcomes or hide paid-solicitor status; no way to verify a rep; complaints go nowhere; the organization “doesn’t get involved” in how its name is used in the field.',
    collect: [
      'The written agreement / statement of work between the organization and the fundraising firm: scope, territory, dates, supervision, compensation basis, required disclosures, termination, indemnification, insurance, data ownership, brand use.',
      'A code of conduct for anyone soliciting in the organization’s name.',
      'The approved script and FAQ, and the list of what reps may and may not say (no guaranteed outcomes; disclose paid-solicitor status and the fee arrangement where required).',
      'Rep identification: badges, branded materials, and a public verification path (phone line or web page) to confirm a rep is authorized.',
      'Donor-data handling: what is collected, how it is transmitted, retention, do-not-contact / suppression process, card-data handling, breach procedure.',
      'Complaint handling: intake channel, response-time commitment, who investigates, how findings feed back to the firm, and the triggers for discipline or termination.',
      'The organization’s designated relationship owner and escalation contacts, including after hours.',
      'Who speaks for the organization to the press or on social media if a fundraising incident draws attention, and how that ties back to the firm.',
      'Training the organization requires or provides, and any quality checks it runs (field checks, mystery donations, social listening).',
      'Insurance the organization carries or requires — general liability, directors & officers — and whether the firm must name the organization as additional insured.',
    ],
    standard: [
      'A signed, current contract covering all of the above; both sides can produce it.',
      'Written code of conduct and approved messaging; disclosure practice matches the rules for every state worked.',
      'A working public verification path for reps.',
      'Documented complaint process with named owners and timelines, and evidence it has actually been used.',
      'The organization actively monitors field conduct rather than delegating it entirely.',
      'Clean donor-data pipeline; suppression / do-not-contact honoured; card data never handled outside policy.',
    ],
    warnings: [
      'Handshake deal, expired contract, or a contract that offloads all compliance onto the firm.',
      'No code of conduct; scripts that promise outcomes, hide paid-solicitor status, or apply pressure.',
      'No way for a donor to verify a rep is legitimate.',
      'Complaints have nowhere to go; no response commitment; no feedback loop to the firm.',
      'The organization “does not get involved” in how its name is used in the field.',
      'Donor data sent in plain text; no suppression process; card details captured on paper.',
    ],
  },
];
