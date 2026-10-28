# Horizon Outreach Partners: website audit
Site: https://horizonoutreachpartners.com/ · Viewed 2026-10-28 · Prepared for Matthew Sharpe
Evidence is in `website/raw/`, `website/screens/` and `website/speed/`. [M] = measured or read directly from a saved file or URL. [I] = my inference from that evidence.

## Summary
1. A new site (domain registered 11 May 2026, first page 14 May) on managed WordPress.com hosting. The basics are secure, and the address, phones and email match on every page.
2. It recruits, but there is no Apply button on the home page or in the menu. It never says what the job is, what it pays or where it is, and the phone numbers can't be tapped.
3. A chat window loads 1.5 MB on every page, opens by itself over the content, and sets a 13-month cookie with no notice.
4. The legal pages are unfilled templates ("STATE OF OFFICE", dated before the company existed). The privacy policy doesn't match what the site actually does (outside chat, outside forms, texting).
5. The copy is generic and nothing backs it up (unverifiable testimonials, no numbers). The name changes from place to place, and HOPE appears nowhere yet.

## Right
- [M] HTTPS on every address. http:// and www both redirect to https://horizonoutreachpartners.com/ with a 301. HSTS is set (1 year). The certificate is from Google Trust Services, valid to 11 Dec 2026 and renewed by the host. (raw/headers-redirects-2026-10-28.txt, raw/tls-cert-2026-10-28.json)
- [M] Login goes through WordPress.com single sign-on (/wp-login.php redirects to wordpress.com). The WordPress version isn't shown in the page code or feed.
- [M] One address (2459 Wilkinson Blvd, Charlotte, NC 28208), one main phone (704-615-0371), one text line (704-765-0308) and one email (info@) on all 8 main pages. The Facebook page shows the same address, phone and email. (raw/text-*.txt, raw/external-link-visits-2026-10-28.json)
- [M] The apply form is short: 4 required fields (first name, last name, email, phone), plus optional "How did you hear about us?" and an optional resume upload.
  - Email and phone fields use the right keyboards (email, tel), every field has a visible label, and the form fits at 390, 820 and 1180 px.
  - The email and text consent boxes are unticked by default and carry HELP/STOP wording. (raw/render-apply-1440.json, raw/phone-tablet-usability-detail-2026-10-28.json)
- [M] "Text APPLY to 704-765-0308" is a low-friction route that suits field recruiting, and their X account uses it (post of 27 Oct).
- [M] The phone/tablet menu opens and all 7 items can be reached at 390 and 820 px. No page can be scrolled sideways at 390, 820 or 1180 px (the page body clips sideways overflow). (raw/phone-tablet-usability-2026-10-28.csv)
- [M] Every page has a title, a meta description, a canonical address and social-sharing tags (Open Graph/Twitter). robots.txt is sensible. DuckDuckGo lists 10 site URLs, including /apply/. (raw/seo-a11y-per-page-2026-10-28.csv, raw/search-ddg-site.html)
- [M] No advertising or analytics trackers load: no GA4, GTM, Meta Pixel, TikTok, LinkedIn Insight, Hotjar or Clarity in network traffic across 26 page loads. Only WordPress.com's own stats. (raw/third-party-hosts-2026-10-28.csv)
- [M] Email runs on Google Workspace with Google DKIM signing, and SPF needs 5 DNS lookups, under the limit of 10. (raw/dns-2026-10-28.txt, raw/spf-lookup-count-2026-10-28.txt)
- [M] The 21 internal links that point to real pages all work (200).

## Wrong, and the fix
Ordered by impact on recruiting.

1. **No apply path from the home page.** [M] The home page has no Apply, Jobs or Careers link, and the menu has 7 items (2 of them legal pages) but no Apply. The only on-site route is Our Team → "Join The Team!". The footer's "Text To Apply" isn't a link. (screens/home-1440-full.png, screens/menu/home-390-menu-open.png, raw/linkcheck-2026-10-28.csv)
   **Fix:** an "Apply" button in the header and in the home page hero, and "Apply" replacing the two legal pages in the menu (move those to the footer).
2. **No job information at all.** [M] No job title, pay or pay range, schedule, job locations, duties, requirements (18+, transport, work authorisation) or "what happens after you apply". No jobs page, no Indeed or job-board link, and no JobPosting markup for Google Jobs. "field", "door" and "event" never describe the work. (raw/text-*.txt)
   **Fix:** a Careers/Jobs page per role with honest pay facts and locations, JobPosting markup, and an Indeed link.
3. **Phone numbers and email can't be tapped.** [M] 0 tel: and 0 sms: links on all 13 pages. The email is a link only on the Terms page (2 links). (raw/phone-tablet-usability-2026-10-28.csv, last columns)
   **Fix:** tap-to-call links for 704-615-0371 and a tap-to-text link (sms:7047650308?body=APPLY).
4. **The chat window gets in the way.**
   - [M] It loads about 1,516 KB of script on every page, by far the biggest cost on the small pages (speed/speed-*-run1.json).
   - [M] On a first visit it opens a 432×600 px panel on desktop and tablet (about 27% of an 820×1180 or 1180×820 screen), covering the hero image (screens/home-1180x820-fold.png). On a phone it is a 390×120 px banner at the bottom of the screen (14% of an 844 px screen), and it covers the apply Submit button when that button sits at the bottom of the screen (raw/phone-tablet-usability-detail-2026-10-28.json, apply-390).
   - [M] It sets the cookies `_webchat_visitor` (expires 2027-12-02) and `_webchat_visit` (raw/cookies-set-2026-10-28.csv).
   - [I] apigateway.co and cdnstyles.com are the chat and form services sold through Vendasta-based marketing platforms. The vendor isn't named in the code.

   **Fix:** don't auto-open it, load it only after the first tap or scroll (or only on Contact), and name it in the privacy policy.
5. **Slow on phones.** [M] Own lab test, not Lighthouse: headless Chrome, 390×844 phone, network slowed to 150 ms RTT and 1.6 Mbps, CPU slowed 4×, empty cache. See the Numbers section.
   - Home: 5.55 MB, 59 requests, 28.9–29.8 s to finish loading. The hero photo `Header-Image.png` (1,990 KB at 1320 px) finished at 28.6 s, and a second PNG is 1,128 KB.
   - Fonts total about 700 KB across 7 font families (Roboto, Roboto Slab, Lora, Inter, Playfair Display, Raleway, Open Sans), plus a 454 KB icon font.
   - [M] The "largest paint" Chrome recorded (1.5–4.0 s) was the hero text block, not the photo, so it understates how long the page takes to look finished.

   **Fix:** save photos as WebP at the size they are shown (under 150 KB each), use 2 font families, drop the icon font, and defer the chat.
6. **Legal pages.**
   - **Terms** [M]: "Last updated: January 28, 2025" (the domain was registered 2026-05-11, raw/rdap.json; the page was created 2026-05-26, raw/wpjson-pages.json). "Country refers to: STATE OF OFFICE, United States", so "Governing Law: the laws of the Country" is undefined. Mentions "the Application", which doesn't exist. Company named only "Horizon" with no legal entity. A stray quote mark after "STOP.". The texting section doesn't name the text number or the programme.
   - **Privacy** [M]: about 250 words of policy, no effective date, says "contact us" without saying how. Nothing on cookies, WordPress.com stats, the chat window, the outside apply form, resume uploads or texting. It states "We do not disclose any personally identifying information publicly or with third parties", yet apply data goes to forms-prod.apigateway.co and chat goes to conversation-prod.apigateway.co. No cookie notice on any page.
   - [I] Both read as free-generator templates (the Terms structure matches the common TermsFeed layout). [I] Text programmes registered with US carriers (10DLC) are normally expected to state in the privacy policy that mobile numbers and consent aren't shared, so this could matter for the text-to-apply line.

   **Fix:** rewrite both with the real legal name and state, list the services that receive data, add texting terms tied to 704-765-0308, and have Donny's attorney review.
7. **Dead links.** [M]
   - About Us → "Meet the People Behind Horizon" → "Learn More" goes to `http://team`, which doesn't exist (screens/visit-05-team.png).
   - 18 links go nowhere (`#`): footer "Contact" on all 8 main pages; 7 home cards; 6 About cards; the contact consent line's "terms and conditions"; and "Add your name" plus a hidden link on the blog and archive pages.
   - The old address `/2026/07/17/habits-for-career-growth-and-long-term-success/` is listed by DuckDuckGo but returns 404.
   - `/?elementskit_template=header` (an internal page-header template) is publicly reachable (200) and listed in a sitemap.

   **Fix:** correct the links, unlink or remove the decorative cards, and redirect the old address.
8. **Testimonials and claims can't be backed up.** [M] "What Our Customers Think" shows 4 quotes from Daniel Brooks, Olivia Bennett, Ethan Carter and Sophia Mitchell: name only, no company, photo or date, and the slider shows each twice. "A Simple, Proven Process", "Performance-Driven", "measurable sales growth" and "invest back into our communities … education" come with no numbers, client names, programmes or dates. [I] If the quotes are placeholders they are a legal and trust risk (the FTC rule on fake reviews, 16 CFR Part 465; not re-verified this session).
   **Fix:** real quotes with permission and company names, or remove them; add facts the company can back up.
9. **Names don't line up.** [M] Site title, logo and structured data say "Horizon". The blog and hub say "Horizon Outreach Partners". The privacy policy, Facebook and Instagram say "Horizon Outreach Partners and Events". The handles are @horizonhopeinc (Instagram) and @Horizon_opsales (X). "HOPE" appears nowhere on the site. The home page calls it a "sales agency"; the blog calls it a "marketing agency". Every title is "<Page> - Horizon", a very common name, with no city or service.
   **Fix:** settle the legal name, public name and the HOPE recruiting brand, then use them the same way everywhere.
10. **Owner's username exposed.** [M] The site's public user list (`/wp-json/wp/v2/users`) returns 1 user: display name "Horizon", username "donnyparada1088", linked to a personal WordPress.com address (donnyparada1088-xurkw.wordpress.com, which redirects to this site). The same username appears in `/author/donnyparada1088/` and in the structured data on every page. No email address is exposed. (raw/wpjson-users-summary.json)
    **Fix:** change the author name and URL in WordPress.com settings and hide the author archive.
11. **Search-engine structure.** [M]
    - 0 H1 headings on all 8 main pages (blog posts have 1).
    - Meta descriptions run past about 160 characters on Terms (252), Contact (250), Apply (210) and Home (203).
    - The Organization structured data has only the name "Horizon" and a logo: no address, phone or social profiles. Pages are typed as "Article".
    - Two sitemap systems at once (Jetpack's sitemap.xml and Rank Math's sitemap_index.xml); robots.txt lists 3 sitemap URLs. Jetpack's image sitemap indexes theme demo images (Lovely-Customer_img, Partner_img 1–5, App-Store_img, Google-play_img, placeholder.png and others). "Uncategorized" is indexed.
    - 23 of 40 images on the main pages have empty alt text, including all 3 team headshots. One team-page carousel image has the alt text "Horizon contact page image".

    **Fix:** one H1 per page, local titles ("Field Sales Jobs in Charlotte, NC | Horizon…"), one sitemap system, full company details in the structured data, and real alt text.
12. **Contrast.** [M] White on brand orange #FF914D is 2.23:1. That covers the buttons (Let's Connect!, Get Started Today!, Take Me Home, contact Submit) and all footer text (address, phone, email, Text To Apply, links). Orange accent words in headings are 2.11–2.23:1. The apply Submit (white on #FFAC40) is 1.87:1. Grey hub excerpts are 3.32:1. 39 failing text/background pairs in total. (raw/contrast-2026-10-28.csv, raw/contrast-key-pairs-2026-10-28.txt)
    **Fix:** dark text on the orange (7.8:1) or a darker orange.
13. **Tap targets and text size.** See the Phone and tablet usability section.
14. **Email deliverability.** [M] DMARC is `p=none` with no reporting address. SendGrid is allowed to send for the domain, but no SendGrid DKIM key was found at the standard selectors (s1/s2) [I: it may use a custom one]. (raw/dns-2026-10-28.txt)
    **Fix:** add DMARC reports, then move to quarantine; verify SendGrid domain signing.
15. **Blog ("Business Growth Hub").** [M] It is the blog listing page with 3 posts of about 1,400 words. They went up 17 Jul, 7 Aug and 15 Sep 2026 at exact clock times (00:00:01 and 12:00:04 UTC), with featured images named like `image_6aa88a81d9cb02.24318493.png`. Nothing since 15 Sep. The posts use a different template (orange header bar, other fonts) with comments open. One post switches between "they" and "we" about Horizon.
    [I] The timing and file names suggest an automated, AI-written posting tool. The hub speaks to business owners, not recruits.
    **Fix:** decide who the hub is for; recruits need day-in-the-life, pay and training posts.
16. **Two separate form systems.** [M] Contact uses the WordPress Forminator plugin (posts to /wp-admin/admin-ajax.php). Apply uses an outside form service, whose code sends to forms-prod.apigateway.co/forms.v1.FormSubmissionService/CreateFormSubmission. The contact message is capped at 180 characters; its phone field is a plain text box with autofill off; first and last name both autofill as "name"; labels are 12 px. No CAPTCHA loads on either form (the apply form's code supports one, but none was active). [I] Leads probably arrive in two different places.
    **Fix:** one form system and one lead inbox; raise the message limit.
17. **Odd page structure.** [M]
    - Contact and Apply both open with a "Take Me Home" button that sends visitors away from the page they came to act on.
    - Team page: 3 people and no owner or leader. Its "Learn More!" goes to About, whose "Learn More" is dead.
    - At 1180 px (iPad landscape) the 7-item menu wraps onto 2 lines (screens/home-1180x820-fold.png).
18. **Security headers (low priority on managed hosting).** [M] No Content-Security-Policy, X-Frame-Options, X-Content-Type-Options or Referrer-Policy. /readme.html is public (200). xmlrpc.php is still advertised in the page code (`xmlrpc.php?rsd`), but every request to it came back 429 (rate-limited), so it couldn't be confirmed whether it is open.

## Phone and tablet usability
Measured in headless Chrome at 390×844 (phone), 820×1180 (iPad Air portrait) and 1180×820 (landscape), on 13 pages each. Per-page figures: raw/phone-tablet-usability-2026-10-28.csv; details: raw/phone-tablet-usability-detail-2026-10-28.json. Screenshots: screens/*-390-full.png, *-820x1180-*.png, *-1180x820-*.png, and screens/menu/. (The tablet screenshots were re-shot after a network drop; all 26 checked.)

- **Menu** [M]. A hamburger button shows at 390 and 820 px; it opens a side panel and all 7 items are reachable (each 350×43 px). It closes with the "X" button (45×42 px). The menu button itself is 45×29 px, under 44 px tall. At 1180 px the full menu shows across the top but wraps to 2 lines. No width has an Apply item.
- **Sideways overflow** [M]. Nothing can be dragged sideways at any width (body has `overflow-x: clip`). The page is a few pixels wider than the screen in 3 cases: Business Growth Hub at 390 (405 px) and 820 (835 px), Contact at 820 (825 px). [I] A phone may shrink the page slightly to fit.
- **Text size** [M]. Smallest body text is 12 px (contact form labels and the "0 / 180" counter). Menu and footer links are 15 px. The "Learn More" button is 13 px. On the phone, 166 text elements across the 13 pages are under 16 px; 0 are under 12 px.
- **Tap targets** [M]. 220 of 261 tappable items on the phone pages are under 44 px in at least one direction; 56 are under 24 px. Off-screen side-menu items (43 px tall) are counted on every page.
  - Real problems: footer links Home, Contact, Privacy Policy, Terms 20 px tall; social icons 40×40; testimonial slider dots 10–12 px; team carousel dots 6 px; previous/next arrows 25×25; contact consent link 17 px tall; menu button 45×29. (raw/tap-targets-phone-2026-10-28.csv)
- **Things fixed to the screen** [M]. No sticky header. The chat window is the only fixed element: a 390×120 px banner at the bottom on phones, and a 432×600 px panel at 820 and 1180 px (about 27% of the screen) until closed.
- **Images on phone** [M]. Nothing spills past the screen edge. The phone is sent huge files: the home hero arrives at 1320 px and 1,990 KB, and the team carousel loads all 5 images (288–326 KB each) up front.
- **Forms on phone** [M].
  - /apply/ fits at all three widths (370 / 800 / 1140 px wide). Email and phone keyboards are correct, every field is labelled, and the Submit button is reachable (79×38 px, under 44 px tall). When Submit sits at the bottom of the phone screen, the chat banner covers it.
  - The contact form fits too. Its phone field is plain text with a number keypad and autofill off; labels are 12 px.
  - Nothing was filled or submitted.
- **Tap to call or text** [M]. 0 on any page or width. Both numbers appear only as plain text.
- **How the layouts change between widths** [M]. The site switches to its tablet layout at 1024 px and its phone layout at 767 px.
  - At 820 the hero text sits flush left at 15 px while the logo is indented about 105 px (screens/about-us-820x1180-fold.png).
  - At 1180 the desktop menu wraps.
  - The blog posts use a different template on every device.
  - No broken layouts beyond these.

## Numbers (for charts)

**Phone speed, own lab test (not Lighthouse scores).** Headless Chrome 390×844, network slowed to 150 ms RTT and 1.6 Mbps down, CPU slowed 4×, empty cache. 2026-10-28, run over a phone hotspot, so real hotspot delay adds on top of the slowdown. Source: speed/speed-summary-2026-10-28.csv and speed/*.json.

| Page | Largest paint, s | First paint, s | Fully loaded, s | MB | Requests | Biggest file |
|---|---|---|---|---|---|---|
| Home run 1 | 2.7 | 2.0 | 29.8 | 5.55 | 59 | Header-Image.png 1,990 KB |
| Home run 2 | 1.8 | 1.7 | 28.9 | 5.55 | 59 | same |
| Home run 3 (timings) | 2.1 | 1.8 | 28.9 | 5.55 | 59 | hero photo finished at 28.6 s |
| About Us | 1.7 | 1.4 | 21.6 | 4.05 | 57 | What-Makes-Us-Different PNG 1,212 KB |
| Business Growth Hub | 3.8 | 3.2 | 20.8 | 3.47 | 52 | chat script 641 KB |
| Our Team run 1 | 4.0 | 3.3 | 24.7 | 4.18 | 65 | chat script 641 KB |
| Our Team run 2 | 2.7 | 1.8 | 23.7 | 4.18 | 65 | page jumped as it loaded (layout shift 1.001; run 1: 0.028) |
| Contact | 2.0 | 1.7 | 14.8 | 2.51 | 59 | chat script |
| Apply | 1.6 | 1.5 | 12.7 | 2.10 | 54 | chat script |
| Privacy | 2.2 | 1.9 | 13.9 | 2.33 | 50 | chat script |
| Terms | 1.8 | 1.7 | 13.4 | 2.33 | 50 | chat script |
| Blog posts (3) | 1.5–2.5 | 1.5–2.5 | 12.8–13.4 | 2.28 | 53 | chat script |

Chat window share: 1,516 KB on every page.

**Retest, 28 Oct afternoon (Matthew: "I feel like it loads fine on my phone").** iPhone 390×844, empty cache, two runs per setting, office Wi-Fi underneath. Script: scratchpad hop-web/speed2.mjs. Evidence: website/speed-retest/ (CSV plus screenshots at 2 s and 4 s).

| Home page | Text and button show | Main photo arrives | Everything done |
|---|---|---|---|
| Wi-Fi (no slowing) | 0.2 s | 0.4 s | 0.9 s |
| Typical 4G (40 ms, 20 Mbps, CPU 2×) | 0.4 s | 2.6 s | 2.8 s |
| Weak signal (150 ms, 1.6 Mbps, CPU 4×, same as the first test) | 1.5 s | 29.6–29.7 s | 30 s |

The Apply page finishes in 0.8 s on Wi-Fi and 1.8 s on 4G.

**What changed in the conclusion:**
- On a phone, the first screen is the headline, the text and the "Let's Connect!" button; the 2 MB photo sits below it (screens at 4 s). So the page is usable in under 2 s even on a weak signal.
- The first test's "29 s" was the last file on a weak signal. It was true, but it overstated how slow the page feels, so it was taken out of the PDF's headline.
- What stands is the size: about 5.5 MB to a phone (Chrome network log, first test). That costs data and battery and drags on a weak signal.
- The retest's own MB column under-counts, because browsers report 0 bytes for files from other servers (the chat window) without a Timing-Allow-Origin header. Use the first test's sizes.

**Clicks per task from the home page** [M]

| Task | Desktop | Phone | Result |
|---|---|---|---|
| Apply for a job | 2 clicks (Our Team → Join The Team!) | 3 taps | Hidden: not on home or in the menu |
| Text to apply | Number shown in footer | Must type the number by hand | No text link |
| Call the office | Number shown in footer | Must type the number by hand | No call link |
| Email | Plain text | Plain text | Link only on Terms |
| Contact form | 1 click (Let's Connect!) | 1 tap | Works (not submitted) |
| Find pay, hours, job location | no path | no path | Not on the site |
| Learn what the job is | no path | no path | Not on the site |
| Meet the team | 1 | 2 | 3 people |

**Links** [M] (raw/linkcheck-2026-10-28.csv): 49 unique.

| Kind | Count | Notes |
|---|---|---|
| Internal | 21 | All 200; one http→https redirect |
| `#` links | 19 | 18 go nowhere; 1 is the blog's skip-to-content link |
| External | 6 | 1 dead (`http://team`). Facebook, Instagram and X work in a browser; LinkedIn shows its login wall |
| No address | 2 | |
| Email | 1 | Terms page only |
| Phone call / text | 0 | |

**Other counts** [M]
- 13 public URLs.
- 0 of 8 main pages have an H1 heading.
- 23 of 40 main-page images have empty alt text.
- 39 text/background pairs fail contrast.
- No cookie banner on any page.
- 0 Wayback captures.
- Domain is 170 days old on 2026-10-28.

## Apply path for a job seeker, step by step [M]
1. **Home** (5,162 px tall on desktop, 7,593 px on phone). No Apply, Jobs or Careers link anywhere. The only hint is "Text To Apply: Text Apply to 704-765-0308" in the orange footer at the very bottom: not tappable, and the white-on-orange text is 2.23:1.
2. **Open the menu** (phone: tap the 45×29 menu button). It lists Home, About Us, Our Team, Contact, Business Growth Hub, Privacy Policy, Terms and Conditions. Nothing says Apply or Jobs; the seeker has to guess "Our Team".
3. **Our Team.** The hero button "Join The Team!" goes to /apply/. (screens/our-team-1440-full.png)
4. **/apply/.** The heading "Build Your Future with Horizon" sits next to a "Take Me Home" button that leads back to the home page. The intro asks people to "complete the application below". There is no role, pay, hours, location, requirements or next step, and on a phone the chat banner covers part of the form. (screens/apply-390-full.png)
5. **Form.** First name*, Last name*, Email*, Phone*, How did you hear about us?, Upload Resume (any file type), email consent box, text consent box, Submit.
   - Data goes to an outside form service (forms-prod.apigateway.co); no CAPTCHA.
   - Hidden fields record ad and campaign information (utm_*, gclid, fbclid, msclkid, google_places_id).
   - The consent boxes are coded as `marketingEmailConsent` and `marketingSmsConsent`, while the wording says "non-marketing".
   - Not submitted, so what happens afterwards is unknown.
6. **Also missing.** No jobs page, Indeed link, pay information or job locations (only the office address). The X account (@Horizon_opsales, 27 Oct) links to /apply/ directly, so the page works as a landing page but not as something people find from the home page.

## Inventory of pages [M]
Dates come from the site's own page records (raw/wpjson-pages.json, wpjson-posts.json) and are in the site's set time zone, UTC−6. [I] That looks like a Mountain-time setting on a Charlotte (Eastern) business.

| URL | Type | Created | Last changed | Words (1440) | In menu | H1 |
|---|---|---|---|---|---|---|
| / | Page | 2026-05-14 | 2026-07-29 | 645 | yes | 0 |
| /about-us/ | Page | 2026-05-21 | 2026-07-29 | 459 | yes | 0 |
| /our-team/ | Page | 2026-05-19 | 2026-07-29 | 167 | yes | 0 |
| /contact/ | Page | 2026-05-15 | 2026-05-27 | 132 | yes | 0 |
| /business-growth-hub/ | Page (blog listing) | 2026-07-17 | 2026-07-17 | 275 | yes | 0 |
| /apply/ | Page | 2026-07-24 | 2026-07-29 | 91 | **no** | 0 |
| /privacy-policy/ | Page | 2026-05-19 | 2026-05-27 | 330 | yes | 0 |
| /terms-and-conditions/ | Page | 2026-05-26 | 2026-05-28 | 1,751 | yes | 0 |
| /habits-for-career-growth-and-long-term-success/ | Post | 2026-07-17 | same | 1,405 | via hub | 1 |
| /master-sales-communication-skills-for-professional-growth/ | Post | 2026-08-07 | same | 1,409 | via hub | 1 |
| /horizon-outreach-partners-redefining-sales-success/ | Post | 2026-09-14 (local) | same | 1,397 | via hub | 1 |
| /category/uncategorized/ | Archive (indexed) | – | – | 211 | no | 1 |
| /author/donnyparada1088/ | Archive (noindex) | – | – | 211 | no | 1 |

**Team page** [M]: Sierra Browning (Event Operations Director), Dario Duany (Training Manager), Robyn Berry (Training Manager). No bios, no owner or founder listed. [M] Four June headshot files were uploaded (2026/06/1–4.png) but only 3 are shown; [I] one person was probably removed.

**Built with** [M]: WordPress.com Atomic hosting (Automattic; IPs 192.0.78.133 and .217; host headers mention WordPress.com and an "_atomic_dfw" cache), Elementor 4.3.5, ElementsKit Lite, Essential Addons Lite, GutenKit, Forminator, Rank Math, Jetpack 16.4-a.5, Akismet, a WPMU DEV hub connector, jQuery 3.7.1. [I] WordPress 7.1.3, going by the emoji script version.
- Domain: registrar Automattic, created 2026-05-11, expires 2027-05-11, WordPress.com nameservers.
- Email: Google Workspace.

**Images** [I]: the hero, carousel and two blog images look like stock office photos; not checked by reverse image search. The first blog post's photo (a group on a boat) is the only one that looks like real staff. [M] File names are generic (1.png, Header-Image.png).

## Could not check
- Wayback availability lookup was rate-limited; the full capture list came back empty (0 captures).
- xmlrpc.php answered 429 every time from two networks, so whether it is open is unknown.
- Google searches can't be fetched by script; Bing ignored the site: search; DuckDuckGo blocked brand-name searches.
- No reverse image search, so "looks like stock" is judgement only.

## Fact-check log
| Claim / item | Evidence file or URL | Checked how | Result |
|---|---|---|---|
| WordPress + Elementor 4.3.5 | raw/html-home.html (generator meta) | read page code | Confirmed |
| Hosted on WordPress.com | raw/headers-home.txt, raw/dns-2026-10-28.txt | headers, IP owner lookup | Confirmed (Automattic) |
| Domain created 2026-05-11 | raw/rdap.json | RDAP (rdap.org → Verisign) | Confirmed; registrar Automattic |
| No Wayback history | raw/wayback-cdx-home.json, wayback-cdx-all.json, wayback-cdx-domain.json | Wayback CDX, 3 queries | 0 captures; availability lookup rate-limited (429) |
| Apply page exists but isn't in the menu | raw/sm-sitemap-1.xml, raw/render-home-390.json, screens/menu/ | sitemap plus menu opened at 390, 820, 1180 | Confirmed |
| No tap-to-call or text links | raw/phone-tablet-usability-2026-10-28.csv, render-*.json | every link on 13 pages × 3 widths | 0 tel:/sms: links |
| Chat window size and cookies | speed/speed-*-run1.json, raw/cookies-set-2026-10-28.csv | network log, browser cookie list | 1,516 KB per page; cookie to 2027-12-02 |
| No ad or analytics trackers | raw/third-party-hosts-2026-10-28.csv | every request host, 26 page loads | None; WordPress.com stats only |
| No cookie banner | render-*.json (cookieBannerVisible), screenshots | fixed elements checked for "cookie" | None on 13 pages |
| Terms placeholder and date | raw/text-terms-and-conditions.txt | read in full | "STATE OF OFFICE"; "Last updated: January 28, 2025" |
| Privacy claims vs reality | raw/text-privacy-policy.txt vs network logs | read in full, compared with outside hosts | Says no third-party sharing; form and chat data go to apigateway.co |
| Company name variants | raw/text-*.txt, raw/external-link-visits-2026-10-28.json | text search, logged-out visits | Horizon / Horizon Outreach Partners / … and Events / horizonhopeinc / Horizon_opsales; HOPE absent |
| Testimonials (4 names) | raw/text-home.txt | read; looked for company, photo, link | No company or source; can't verify |
| "Proven process", "measurable growth" | raw/text-about-us.txt, text-home.txt | looked for any figure or client | Nothing backs them |
| Team names and roles | raw/text-our-team.txt | read | 3 people, as listed |
| Owner username public | raw/wpjson-users-summary.json, wpjson-users-fields.json | public user list (no emails recorded) | 1 user; username "donnyparada1088" |
| Phone speed | speed/speed-summary-2026-10-28.csv | own throttled headless Chrome runs | See Numbers; not Lighthouse |
| Hero photo 1.99 MB, finished at 28.6 s | speed/speed-home-run3-resources.json | browser resource timing | Confirmed |
| Dead `http://team` link | raw/linkcheck-2026-10-28.csv, screens/visit-05-team.png | fetch plus browser visit | No such site |
| Facebook, Instagram, X, LinkedIn links | raw/external-link-visits-2026-10-28.json | logged-out headless visits | FB 3 followers; IG 11 / 63 posts; X 84 posts / 0 followers; LinkedIn login wall |
| Indexed pages | raw/search-ddg-site.html | DuckDuckGo site search | 10 URLs, one a 404 |
| Google index | – | blocked to scripts | Not checked |
| Brand-name search ranking | – | DuckDuckGo bot check | Not checked |
| xmlrpc.php open | raw/headers-redirects-2026-10-28.txt | GET and harmless POST, two networks | Always 429; unknown |
| Email setup (SPF, DKIM, DMARC) | raw/dns-2026-10-28.txt, spf-lookup-count-2026-10-28.txt | DNS-over-HTTPS | SPF 5 lookups OK; Google DKIM yes; SendGrid DKIM not at s1/s2; DMARC p=none, no reports |
| Contrast | raw/contrast-2026-10-28.csv, contrast-key-pairs-2026-10-28.txt | WCAG formula on browser colours | 2.23:1 orange; 1.87:1 apply Submit |
| Stock photos | screenshots | visual judgement only | Unverified |
| Automated blog posting | raw/wpjson-posts.json, sm-image-sitemap-1.xml | post times and file names | Inferred, not proven |

## How Matthew can help (for the client deck)
1. **Fix the basics:**
   - Apply button in the header and hero, tap-to-call and tap-to-text links, dead links fixed.
   - Chat window no longer opens by itself, images compressed, fonts cut.
   - Contrast fixed, H1 headings and titles added, one sitemap system.
   - Legal pages rewritten with the real entity and texting terms (attorney to review).
   - Username hidden, DMARC reporting turned on.
2. **Make it a recruiting site:**
   - Jobs page per role with honest pay facts and locations, JobPosting markup and an Indeed feed.
   - A "what the job is" section with real team photos, and one form system feeding one inbox.
   - The HOPE recruiting site built on the same facts, under one settled legal name.
3. **Grow:** recruiting-focused posts (day in the life, training), measurement with consent (analytics and Meta Pixel plus a cookie banner), and monthly reporting.
