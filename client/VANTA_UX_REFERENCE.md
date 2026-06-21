# Vanta UX Reference — Veraha Build Guide

Complete walkthrough documentation for building Veraha Security, modeled on Vanta's interface. Captured from live Vanta + user screenshots. Use this as the primary UX reference for layout, patterns, and component structure.

---

## 1. Navigation Structure

**Sidebar (collapsible):**
- **My work:** Home, My work, Vanta Agent, Tests, Reports
- **Compliance (expandable):** Frameworks, Controls, Policies, Documents, Audits, Settings
- **Risk (expandable):** Overview, Risks, Risk library, Action tracker, Snapshots, Settings
- **Vendors (expandable):** Vendors
- **Other sections:** Customer trust, Privacy, Assets, Personnel, Integrations
- **Bottom:** My security tasks

**Top bar:** Logo, Help (ctrl+K), Vanta Agent, Help, Product updates, Comments, Settings, User avatar

---

## 2. Home / Dashboard

**URL:** `/home`

**Layout:**
- Page title: "Home" + "View open tasks" button
- **Compliance progress** (timestamp: "Last updated X ago")
  - Cards: SOC 2, ISO 27001:2022, HIPAA — each with % (e.g., 86%), progress bar, "X controls passing / Y total"
  - Link: "View all frameworks"
- **Monitoring** (4 cards)
  - Policies: Needs attention 0, X OK / Y total, progress bar
  - Tests: Needs attention 50, X OK / Y total, progress bar
  - Vendors: Needs attention 0, X OK / Y total, progress bar
  - Documents: Needs attention 5, X OK / Y total, progress bar
  - Each card links to filtered list view
- **Trust Center** (optional)
  - Total visits, Individual page views, Resource activity
  - Link: "View Trust Center page"

**Veraha mapping:** Dashboard summary, framework readiness, alerts, activity feed.

---

## 3. Frameworks

**URLs:** `/frameworks` (list), `/frameworks/:code` (detail), `/frameworks/:code/controls`

**List — Tabs:** Active | Available | Update notes
- **Active:** Table — Framework name, Evidence %, Control %, Audit ends, Status, Domain. Search + filters (Status, Domain, Source)
- **Available:** Card grid with Explore/Manage, "Schedule a call" CTAs
- **Update notes:** Table — Title, Framework, Release date, Type, Status

**Detail — Tabs:** Overview | Controls | Updates
- **Overview:** Left stats (Evidence %, Controls %, overlap); Right panel (description, audit steps, industries, scope)
- **Controls:** Left sidebar = Requirement categories; Main = compliance score, progress bars, collapsible chapters with control tables (Control name, Evidence count, Role, Owner)
- **Map Control modal:** Split — left = control list, right = control detail (Description, Domain, Frameworks, Add button)

**Veraha mapping:** Use `GET /frameworks`, `GET /frameworks/:code`, `GET /frameworks/:code/requirements`.

---

## 4. Controls

**URLs:** `/controls` (list), `/controls/:id` (detail via slide-out)

**List:**
- Header: Title + "Add control" dropdown (Add custom / Via import) + overflow (Export all / View deactivated)
- **Summary cards:** Assignment donut (Unassigned / Assigned / Needs reassignment); Controls passing % + Automated tests X/Y, Documents X/Y, control count bar
- **Filter bar:** Search + Framework, Owner, Domain, Source, Framework code, Status, "+ Add filter"
- **Table:** Checkbox | ID | Control (title + description) | Owner | Frameworks | Tests (e.g. 2/2 OK) | overflow (View, Manage framework mappings, Manage access, Deactivate)
- **Table settings:** Density (Dense/Regular/Comfortable), Column visibility

**Detail (slide-out panel):**
- Title, description, ID, Source, Domain, Owner, Note
- Tabs: Mapped elements | History | Comments
- Mapped elements: Tests section (pass/fail items), Documents section, "+" to add
- "Manage access" modal: Owner, General access (Can edit / Can view)

**New control modal:** Description, Domain, Control ID, Control name, Effective date, Framework code

**Veraha mapping:** Use controls API — list, detail, assess, bulk update. Use slide-out panel for detail.

---

## 5. Policies

**URLs:** `/policies` (list + library), `/policies/:id` (detail)

**List:**
- Header: "Add policy" dropdown (Add from policy library / Create new policy) + overflow
- **Add policy modal:** Policy title (0/200), Description, Cancel / Add
- **Policy library:** Search by name, Framework, Added status filters; Template cards (title, description, frameworks, "Added", "View template")
- **Download template modal:** Select language, Download (Word / Google Doc)

**Veraha mapping:** Use policies API — list, create, versions, attestations.

---

## 6. Documents (Evidence)

**URLs:** `/documents` (list), `/documents/:id` (detail)

**List:**
- Tabs: All 153 | Owned by me 95 | Needs document 5 | Draft 1
- Search, filters: Overall status, Owner, Renew by, Framework, Category, Document status, "+ Add filter"
- View toggle (grid/list), "Add document" button
- **Table:** Name (title + sub), Owner, Overall status (Overdue / Due soon / OK), Renew by, Framework, Tasks, overflow

**Detail:**
- Breadcrumb: "← Back to Documents"
- Title, description, tags (Needs reassignment, Renew annually)
- Tabs: Evidence | Instructions | Tasks 0 | Controls 1 | Audits | Comments 1
- Document instructions card, Renewal card (due date, "Renew" button)
- Latest version: Files with thumbnails, expiry, "Copy files to new draft"
- Version history (collapsible)

**New custom document modal:** Document name, Description, Sensitive document checkbox, Recurrence (Annually), Time sensitivity (Upload anytime / Upload during SOC 2 observation window)

**Veraha mapping:** Use evidence API — list, create (file upload), detail, review, link controls.

---

## 7. Tests (Automated + Document Tests)

**URLs:** `/tests` (list)

**Layout:**
- **Tests passing panel:** 93%, 282 of 303 passing, progress bar; Breakdown: Automated tests (88%), Documents (98%)
- **Tests that need attention panel:** Count (e.g. 55); Overdue, Needs remediation, Due soon
- **Table:** Search + filters (Category, Framework, Control, Integration, Owner, Type, Status, Rollout)
- **Columns:** Checkbox | Name (title + sub) | Owner | Status | Failing entities | Due date | overflow

**Veraha mapping:** Tests = automated + document evidence. Use controls + evidence APIs; group by test type.

---

## 8. Risk

**URLs:** `/risk-management/reporting-dashboard` (Overview), `/risk-management/risk-register` (Risks), `/risk-management/risk-library`, `/risk-management/action-tracker`, `/risk-management/snapshots`, `/risk-management/settings`

**Risk register (list):**
- Header: "Share" + "Add scenario" dropdown
- Banner: "You're using the new risk details experience" — "Switch to legacy view"
- Search + filters: Status, Owner, Categories, Inherent, Residual, Approver, "+ Add filter"
- **Table:** Checkbox | ID | Risk scenario (title) | Status | Owner | Inherent risk (badge)

**Veraha mapping:** Use risks API — list, stats, matrix, top, create, detail, close, reopen, link controls.

---

## 9. Vendors

**URLs:** `/vendors`, `/vendors/managed`, `/vendors?vendorState=ACTIVE`

**List:**
- Tabs: Vendors | Discovery
- Status tabs: Active 9 | Archived 3 | All 12
- Header: Export, "Add vendor" dropdown
- Optional promo: "Proactively manage third-party risk" (capabilities, Try for free, Schedule a call)

**Detail:** Vendor profile, CAIQ questionnaire (security review), certifications, contacts, linked controls.

**Veraha mapping:** Use vendors API — list, create, detail, status, assess, link controls, certifications.

---

## 10. Audits

**URLs:** `/audits` (list)

**Layout:**
- Tabs: Active | Completed
- Search + filters: Audit firm, Framework, Status, Audit type
- Empty state: "Add your first audit" — options: Manage audit firm access | Add audit
- **Add audit modal:** Intro text, bullet list (auditor permissions), "Next" button, link to Compliance Settings

**Veraha mapping:** Backend has Audit model; no audit CRUD routes yet. Plan for future.

---

## 11. Compliance Settings

**URL:** `/compliance-settings`

**Sections:**
- **Scoping survey:** Edit scoping survey button
- **Audit visibility:** Upgrade required — custom visibility for auditor
- **Auditor actions:** Toggles — Modify control mappings, Add new audits, Add others to engagements
- **Document approval:** Upgrade required — approval workflow
- **Custom fields for controls:** Upgrade required — custom fields

**Veraha mapping:** Org settings, framework toggles, setup wizard. Use organization API.

---

## 12. Shared Patterns

- **Slide-out panel** for entity detail (Controls, Documents) — not always full-page
- **Tabbed lists** (Active / Available, All / Owned by me, etc.)
- **Summary cards** at top before tables
- **Filter bar:** Search + dropdowns + "+ Add filter"
- **Table density + column visibility** settings
- **Overflow (kebab) menu** on rows: View, Manage, Deactivate
- **Add X dropdown** — multiple creation paths (custom, import, from library)
- **Status badges:** Overdue (red), Due soon (orange), OK (green), Needs attention
- **Progress bars** for % completion
- **Modal wizard** for multi-step flows (Add audit, Add policy)

---

## 13. URL Map (Vanta → Veraha)

| Vanta | Veraha Route |
|-------|--------------|
| /home | /dashboard |
| /frameworks | /frameworks |
| /frameworks/:code | /frameworks/:code |
| /controls | /controls |
| /policies | /policies |
| /documents | /evidence |
| /tests | /tests (or combined with evidence) |
| /risk-management/risk-register | /risks |
| /vendors | /vendors |
| /audits | /audits |
| /compliance-settings | /settings |
| /personnel | /personnel |

---

*Document generated from live Vanta walkthrough + user screenshots. Update as Veraha evolves.*
