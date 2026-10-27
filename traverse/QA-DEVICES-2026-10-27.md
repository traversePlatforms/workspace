# Device QA sweep — 27 Oct 2026 (phones, tablets, desktop; light and dark)

**Asked:** Matthew 26 Oct: "Can you make sure everything runs properly on phone and tablets, all the stuff weve done and changed around."
**How:** headless Chrome over CDP with device emulation (touch, mobile user agent, device pixel ratio):
- **Devices:** iPhone 13/14 at 390×844, a small Android at 360×780, iPad portrait at 820×1180, iPad landscape at 1180×820, and desktop at 1382×854 as the reference.
- **Themes:** light, plus dark on the iPhone and iPad portrait. The desks ran dark on every device.
- **Accounts:** the live sites, with read-only Claude Check accounts. The Prospects desk used Matthew's own code, read-only: nothing was saved, queued or sent.

**What each screen was checked for (automatic audit):**
- sideways page scroll;
- anything past the right edge, outside boxes that scroll sideways on purpose;
- tap targets under 40 px;
- text contrast under 3:1;
- page errors.

Screenshots were reviewed by eye on a sample. This pass changed no code.

Runner and data are in the scratchpad: `C:\Users\SURGEI~1\AppData\Local\Temp\claude\c--Users-Surge-Inc-Desktop-claude-test-2\db3e1153-072f-46a3-b860-134f689b5a09\scratchpad\qa\`. The scripts are `qa-lib.mjs`, `run-desks.mjs`, `run-field.mjs` and `taps.mjs`, with results in `desks-results.json`, `field-results.json` and `taps.json`. Screenshots are `<app>-<screen>-<device>-<theme>.png` and `field-<install>-<screen>-<device>-<theme>.png`.

## Part 1 — Hub, Prospects desk, Peak desk, Assistant

**130 screens:**
- hub bar;
- Prospects: list, Fit A, Reach Social, company detail, Email tab, Settings;
- Peak: Lists, Board, New leads, company detail, More;
- Assistant: sign-in.

Each was run on 5 devices × light and dark.

- **No sideways scroll, no overflow, no low-contrast text and no page errors on any of the 130.**
- Dark mode reads well. For example, `prospects-detail-iphone-dark.png` shows the A badge, status buttons, socials and email warnings all clear.

| # | Screen | Device | Problem | Severity | Suggested fix | Screenshot |
|---|---|---|---|---|---|---|
| D1 | Prospects: tabs, filter chips (Trade/Where/Fit/Reach/Stage), status buttons, `+ Add a company`, `Tick all`, Settings Look buttons | iPhone, Android | Tap targets 31–32 px tall (chips 39×32, tabs 121×31, status 102×31) | Medium | Raise to ≥ 40 px on phones (`min-height:40px` for `.chips button`, `.tabs button`, `.seg button`, `.btn.small`, `.btn`) | `prospects-list-iphone-light.png`, `prospects-detail-iphone-light.png` |
| D2 | Prospects + Peak: `Sign out` link | phones | 47×21 px | Low | Pad to 40 px tall | `prospects-list-iphone-light.png` |
| D3 | Peak: tabs (111×31), chips (141×34), status buttons (102×31), `Save and look up` (32 tall), `Follow-ups due` | phones, iPad | Tap targets 31–34 px | Medium | Same as D1 | `peak-detail-ipadP-light.png`, `peak-lists-iphone-light.png` |
| D4 | Hub top bar: app tabs 44×35, bell / look / reload / open 38×30 | phones | Under 40 px tall | Medium | Make the bar's buttons 40–44 px tall on phones | `hub-bar-iphone-light.png` |
| D5 | Prospects Email tab: Trade / Where / Only chip rows | Android 360, iPhone | Rows scroll sideways on purpose (`overflow-x:auto`) but the scrollbar is hidden on phones and chips are cut mid-word ("Roofing and", "Next to our t"), so nothing shows there's more | Low–Medium | Let these rows wrap on narrow screens (as the Prospects tab's chips do) or add an edge fade | `prospects-email-android-light.png` |
| D6 | Prospects Email tab | all | Opens with **all 1,222 emailable companies ticked**. Not a layout bug, but on launch day pressing Queue without narrowing would line up everyone, not just A-ranked companies in our towns. The cap of 40 a day limits the damage. | Medium (launch risk) | Start with nothing ticked, or with the Prospects tab's current filter ("Email these"), and show the count on the Queue button | `prospects-email-android-light.png` |
| D7 | Hub on a phone, Field app tab | iPhone | The field app's own "Add Sixfold 365 to your Home Screen" banner shows **inside the hub**, which is itself the installed app. Confusing: installing the field app separately isn't needed. | Low | Hide the install banner when the field app runs inside the hub (in a frame) | `hub-bar-iphone-light.png` |
| D8 | Assistant sign-in: input 302×39, `Sign in` 302×35 | phones | Slightly under 40 px | Low | `min-height:44px` on the sign-in input and button | `assistant-signin-iphone-light.png` |
| D9 | Prospects Settings: the Roofing template's subject still says "Door-knocking app for …" | — | Content, not layout. Matthew asked (26 Oct) not to call it a door-knocking app. | Note | Rewrite with the agreed wording (the email talk is on 27 Oct) | `prospects-settings-iphone-light.png` |

Not covered: the Assistant past its sign-in screen. It uses Matthew's own password and there's no read-only account for it.

## Part 2 — Field app (Sixfold, Roofing, Pest)

**Build:** the live build after TR-33 and the code-review fixes (e7216c9, f2f1fd2..354c257; live `version.txt` eb8d6f854bda).

**Coverage:** 259 screens across 7 device/theme pairs: iPhone light and dark, Android light, iPad portrait light and dark, iPad landscape light, desktop light. Screens:
- home, Pipeline, an open lead card, Jobs, Customers, Stats;
- Doors: town, then neighbourhood, then a door card;
- Profile;
- Sixfold: the signing form, including **No deposit**;
- Roofing and Pest: Setup checklist, Prices and terms, Payments, and Billing (Roofing).

A second contrast pass used a background test that handles gradients and photos and blends see-through layers. The first pass wrongly flagged the gradient app bars.

Results are in `field2-results.json` and `contrast2.json`. Screenshots are `f2-<install>-<screen>-<device>-<theme>.png`, `c2-*.png` and `kit-*.png`.

**What passed:**
- **No sideways scroll, no overflow and no page errors on any of the 259 screens.**
- The **desktop workspace fix** holds: on iPad landscape and desktop the map and door list are visible (`field-sixfold-doors-ipadL-light.png`).
- **Profile** reads "Turn on alerts on this device", the old "storm and fire alerts" wording is gone, and **Data credits** are present. That held in all 21 install × device/theme runs.
- **No deposit** shows on the Sixfold signing form.
- Roofing's **Billing** is reachable from Setup on a phone.
- The **TR-33 screens** load on phone and iPad: the Setup checklist (1 of 9 done), starter prices, and Payments (Square and Stripe).

| # | Screen | Device | Problem | Severity | Suggested fix | Screenshot |
|---|---|---|---|---|---|---|
| F1 | Sixfold lead card: "Start the quote" / "Price this lawn in the Quote" | iPhone dark, iPad dark | White text on a light sage button, **1.95:1**: hard to read | **High** | Darken that button's background in dark mode, or use dark text on it | `c2-sixfold-lead-iphone-dark.png` |
| F2 | Door card: "Quote sent" result button | iPhone dark (Sixfold) | Stays a white button with orange text, **2.5:1**, in dark mode (the dark-contrast worker noted it but didn't fix it) | Medium | Give the selected/secondary result button a dark-mode background (like "No answer") | `c2-sixfold-door-iphone-dark.png` |
| F3 | Toast ("Undo") | dark, all installs | The toast keeps its light colours in dark mode; "Undo" is orange on cream, **2.6:1** | Medium | Dark-mode toast colours (dark card, light text, accent link) | `c2-sixfold-home-iphone-dark.png` |
| F4 | Pipeline: "Results: which houses turn into jobs ›" and the ClickUp "Show" button | all, light and dark | Render as plain browser-default grey buttons (square corners, grey fill), unlike every other button | Medium (looks unfinished) | Style `.lnk.subnav` and the ClickUp `Show` like the app's link or ghost buttons | `f2-sixfold-pipeline-iphone-light.png`, `c2-sixfold-lead-iphone-dark.png` |
| F5 | Small tap targets on phones | iPhone, Android | Under 40 px: the find bar's "Address/Customer/Person" select and "Find an address" input, the toast "Undo", Pipeline source chips (Everyone, Meta ad…), "Results ›", tree chips, "Take off" links on Days off, small "‹" buttons, the brand button | Medium | `min-height:40px` on these; most other buttons already meet it | `f2-*-iphone-light.png` |
| F6 | Score badges (white on #1F8A4C) and green info pills ("52 best doors to knock", lawn and Firewise pills) | all | 4.2–4.4:1, just under the 4.5:1 guideline for small text | Low | Darken the green slightly (e.g. #1B7A43) or make the text bold/larger | `c2-sixfold-doors-iphone-light.png` |
| F7 | Billing as a read-only account | iPhone (Roofing) | Shows only "This account only looks, so nothing is saved." instead of the plan, so the read-only check account can't see what Billing looks like | Low | Let read-only accounts see the billing state (still block checkout) | `field-traverse-office-iphone-light.png` |
| F8 | Setup checklist / Prices and terms when the connection drops | phones | The screen says only "Needs signal." with no way to retry except leaving and coming back. The offline banner itself behaves correctly. | Low | Add a "Try again" button to the kit screens' offline message | `f2-traverse-kit-checklist-iphone-light.png` |
| F9 | iPad landscape (1180 px) | iPad L | Gets the desktop top menu; "Quote builder" wraps onto two lines and the bar is tight | Low | Shorten to "Quotes" in the bar below about 1280 px, or tighten the spacing | `field-sixfold-doors-ipadL-light.png` |

**Not a bug (re-checked):** during the run the laptop's connection dropped (hotel Wi-Fi). That produced the app's "Slow or no signal" banner and "Needs signal" on the kit screens in some captures (`f2-traverse-kit-*.png`). Re-checked on the current connection: no banner, and `kit` answers in 160–370 ms. A fresh first visit on all three installs showed no banner, with every API call under 0.7 s. The offline helper waits 6 s (`sw.js` `TIMEOUT = 6000`) before falling back to saved data. That's the right behaviour; on a weak cell signal users will see the banner, by design.

**Not covered:**
- The super-admin views (the My/Full pipeline switch, Matthew's own view): the check accounts aren't super admins.
- The editions' "Build a quote" and "They said yes" on a lead: the Roofing and Pest pipelines have no leads to open. TR-33's own kit screen tests (31/31) cover them.
- The customer pages `q.html` and `sign.html`: they need a real link token.
- Desktop and iPad-landscape steps that use phone-only tiles (Routes, the Setup group): the computer layout reaches those through Doors and the Office menu, which the run didn't script.

## Top issues to fix first
1. **F1** (lead card "Start the quote" unreadable in dark), **F2** ("Quote sent" white in dark) and **F3** (light toast in dark): the dark-mode leftovers.
2. **D6**: the Prospects Email tab starts with all 1,222 companies ticked. That's a launch-day risk.
3. **F4**: the two browser-default grey buttons on the Pipeline.
4. **D1, D3, D4, F5**: tap targets under 40 px on phones. The hub bar, desk chips/tabs/status buttons and the field-app find bar are the most used.
5. **D5**: the Email tab's chip rows are cut mid-word with no sign they scroll.
6. **D9**: the Roofing email template still says "door-knocking app" (content, for the email talk).
