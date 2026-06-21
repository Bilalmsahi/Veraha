# MODULE 1: Security Awareness Training
## (SOC 2 Type II + ISO 27001 Combined)

---

### Training Metadata

| Field | Details |
|-------|---------|
| **Title** | Security Awareness Training: Protecting Our Organization (SOC 2 + ISO 27001) |
| **Description** | This foundational security awareness training covers the core principles every employee must understand to protect our organization's information assets, systems, and people. Aligned with SOC 2 Trust Service Criteria and ISO 27001:2022 controls, this module equips you with practical knowledge to recognize threats, respond correctly, and contribute to a strong security culture. |
| **Estimated Reading Time** | 45–60 minutes |
| **Completion Requirement** | Read all sections + pass quiz with ≥80% (minimum 5 of 6 questions correct) |
| **Certification Validity** | 12 months |
| **Frameworks Covered** | SOC 2 Type II (CC6, CC7, CC9), ISO 27001:2022 (Annex A Controls) |

---

### Learning Objectives

Upon completing this module, you will be able to:

1. Explain the CIA Triad and why it matters to your daily work
2. Identify phishing emails, social engineering attempts, and common cyber threats
3. Create and manage strong passwords and use Multi-Factor Authentication (MFA) correctly
4. Apply the principle of least privilege in your access requests
5. Classify data appropriately and handle it according to company policy
6. Recognize and report security incidents promptly
7. Practice safe remote work and device security habits
8. Understand your responsibilities under our Acceptable Use Policy

---

## SECTION 1: Building a Security Culture

### Why Security Is Everyone's Job

Imagine arriving at the office one morning to find that your company's entire customer database — names, addresses, payment details — has been stolen overnight. The investigation reveals it started with one employee clicking a link in a suspicious email. That one click cost the organization $4.2 million in breach response, legal fees, regulatory fines, and lost business.

This is not a hypothetical scenario. According to the Verizon Data Breach Investigations Report, over 74% of all breaches involve a human element — meaning people, not just technology, are at the center of most security failures.

**Security is not the IT department's problem alone.** It is the collective responsibility of every person in the organization, from the CEO to the newest intern. You are both a potential target and a critical line of defense.

### What a Strong Security Culture Looks Like

Organizations that maintain strong security cultures share common characteristics:

- **Employees speak up** when something feels wrong, even if they're not sure
- **Leaders model secure behaviors** — they use MFA, lock their screens, and don't bypass security controls
- **Security policies are understood** — not just distributed and ignored
- **Mistakes are reported quickly** — not hidden out of fear
- **Security awareness is continuous** — not a once-a-year checkbox

Our organization is committed to achieving and maintaining ISO 27001 certification and SOC 2 Type II attestation. Both frameworks require that employees actively participate in information security — not just technical teams. When auditors review our controls, they look at your training completion records, your behavior logs, and your incident reports. You are part of our compliance evidence.

### The Cost of Complacency

Security mistakes happen for predictable reasons:
- "I was in a hurry"
- "I thought it was probably fine"
- "I didn't think it would happen to us"
- "I didn't want to bother IT"

These attitudes are exactly what attackers count on. Cybercriminals spend enormous time studying organizations, identifying the least security-aware employees, and exploiting moments of inattention. One moment of carelessness can cascade into a company-wide crisis.

> **Quick Tip:** If something feels off — an unusual email, an unexpected request, a login you don't recognize — trust your instincts and report it. It takes 30 seconds to forward a suspicious email to security@yourcompany.com. It takes months to recover from a breach.

---

## SECTION 2: The CIA Triad — The Foundation of Information Security

Every security control, policy, and decision our organization makes is grounded in three core principles: **Confidentiality, Integrity, and Availability** — collectively known as the CIA Triad.

### Confidentiality

Confidentiality means ensuring that information is accessible only to those who are authorized to see it.

**In practice, this means:**
- Customer data is not shared with unauthorized colleagues
- Financial records are not left on shared drives without access controls
- Sensitive emails are not sent to the wrong recipients
- Confidential documents are not discussed in public spaces

**Common Mistake:** Sending a document containing customer PII to an external contractor using a personal Gmail account because it was "faster." This violates confidentiality and may trigger legal and regulatory consequences.

**Scenario:** Sarah from the marketing team receives a request from someone claiming to be a new sales manager asking for the full customer contact list. Sarah doesn't recognize the name but sees the email came from an internal address. She forwards the list. Later, it turns out the account was compromised. The attacker now has thousands of customer records. Confidentiality was violated because Sarah didn't verify the request through a separate channel.

### Integrity

Integrity means ensuring that information is accurate, complete, and has not been tampered with — either accidentally or maliciously.

**In practice, this means:**
- Financial records should not be altered without proper authorization and audit trails
- Software code should not be modified without version control and review
- Customer records should accurately reflect reality
- Log files should not be deleted or modified

**Common Mistake:** A developer makes a "quick fix" directly in the production database without going through the change management process. Even if the fix is correct, the integrity of the change process has been bypassed — and if something goes wrong, there's no clean audit trail.

### Availability

Availability means ensuring that authorized users can access information and systems when they need them.

**In practice, this means:**
- Systems are protected from denial-of-service attacks
- Backups exist and are tested regularly
- Disaster recovery plans are maintained
- Dependencies on single points of failure are minimized

**Common Mistake:** An employee installs unauthorized software that consumes excessive system resources, slowing down shared services for the entire team. Even without malicious intent, this impacts availability.

> **Remember:** All three pillars matter equally. A system can be highly available but not confidential (if anyone can access it). It can be confidential and available but lack integrity (if data can be silently modified). Our controls are designed to protect all three.

---

## SECTION 3: Password Security

### Why Passwords Still Matter

Despite advances in biometrics and passwordless authentication, passwords remain one of the most widely exploited vulnerabilities in any organization. Attackers use techniques like **credential stuffing** (using passwords leaked from other sites), **brute force attacks** (trying millions of combinations automatically), and **password spraying** (trying common passwords against many accounts) to compromise accounts.

### What Makes a Strong Password

A strong password has the following characteristics:

- **Length:** At least 14 characters (longer is better)
- **Complexity:** Mix of uppercase, lowercase, numbers, and special characters
- **Uniqueness:** Never reused across different accounts
- **Unpredictability:** Not based on personal information (birthday, pet's name, etc.)

**Strong password example:** `T!ger$Moon@2024#Lamp` — a passphrase-style construction that's both strong and memorable.

**Weak password examples:**
- `password123` — one of the most common passwords in the world
- `CompanyName2024` — predictable and organization-specific
- `John1990` — based on personal information

### Password Managers

Our organization provides access to an approved password manager. You are required to use it for all work-related accounts. A password manager:

- Generates unique, complex passwords for every service
- Stores them encrypted so you don't need to memorize them
- Autofills login credentials securely
- Alerts you if a password has appeared in a known breach

**Never:**
- Write passwords on sticky notes near your monitor
- Store passwords in a plain text file on your desktop
- Share passwords via email, chat, or phone
- Use the same password for your work account and personal accounts

**Warning:** If you suspect your password has been compromised — you see unusual account activity, receive unexpected password reset emails, or a colleague mentions receiving a strange message from your account — change your password immediately and notify the IT security team.

### Password Sharing Policy

Under our Acceptable Use Policy and ISO 27001 controls, **password sharing is strictly prohibited**. Every employee must have their own unique credentials. If a team member needs access to a system, submit a formal access request. Do not work around this process — it exists to protect you, your colleagues, and our customers.

---

## SECTION 4: Multi-Factor Authentication (MFA)

### What Is MFA and Why Is It Non-Negotiable

Multi-Factor Authentication requires you to verify your identity using two or more of the following:

1. **Something you know** — a password or PIN
2. **Something you have** — a phone, hardware token, or smart card
3. **Something you are** — a fingerprint or facial recognition

Even if an attacker steals your password (through phishing, a data breach on a third-party site, or malware), MFA ensures they still cannot access your account without the second factor.

Microsoft's research shows that MFA blocks **99.9% of automated account compromise attacks**. This is one of the single most impactful security controls you can use.

### MFA Is Mandatory

Our organization requires MFA for:
- All email and productivity suite logins (e.g., Microsoft 365, Google Workspace)
- VPN access
- Cloud service consoles (AWS, Azure, GCP)
- Financial systems
- HR platforms
- Any system containing sensitive or regulated data

### Types of MFA (From Strongest to Weakest)

| Method | Security Level | Notes |
|--------|---------------|-------|
| Hardware security key (FIDO2/WebAuthn) | Highest | Best protection, phishing-resistant |
| Authenticator app (TOTP) | High | Use Google Authenticator, Authy, or Microsoft Authenticator |
| Push notification (app-based) | Medium-High | Beware of MFA fatigue attacks (see below) |
| SMS one-time code | Medium | Susceptible to SIM swapping attacks |
| Email one-time code | Lower | Weakest MFA option |

### MFA Fatigue Attacks — A Growing Threat

A new attack trend targets employees who use push notification MFA. The attacker obtains your password and then bombards your phone with MFA approval requests, sometimes at 2 AM, hoping you'll approve one just to make it stop.

**If you receive unexpected MFA requests you did not initiate:**
1. **Do not approve them**
2. Change your password immediately
3. Report it to the IT security team
4. Consider whether your password was compromised

**Scenario:** James receives a series of MFA push notifications on his phone at 11 PM on a Friday. He's tired and just wants to sleep, so he approves one to stop the notifications. On Monday, he discovers his email account was accessed and used to send phishing emails to 200 of his contacts. A single approval, made in a moment of fatigue, compromised not just his account but potentially the accounts of everyone he emailed.

---

## SECTION 5: Access Control and the Principle of Least Privilege

### Understanding Access Control

Access control is the practice of ensuring that only authorized individuals can access specific systems, data, and resources — and only to the extent necessary to perform their job.

Our organization implements multiple layers of access control aligned with ISO 27001 Annex A controls and SOC 2 Logical Access criteria:

- **Role-Based Access Control (RBAC):** Access is granted based on your job role, not individual request
- **Need-to-Know Basis:** Even within authorized roles, access is limited to information required for specific tasks
- **Periodic Access Reviews:** IT conducts quarterly reviews of who has access to what and removes unnecessary permissions

### The Principle of Least Privilege

Least privilege means every user, system, and application should operate with the minimum level of access necessary — nothing more.

**Why it matters:**
- If an attacker compromises an account with limited access, the damage is contained
- If an employee makes a mistake, fewer systems and records are affected
- It creates clear audit trails — only authorized people accessed sensitive data

**Common Mistake:** An IT administrator uses their privileged admin account for everyday tasks like browsing the web and checking email. If malware is downloaded or a phishing link is clicked while using an admin account, the attacker inherits full administrative privileges. Best practice: use a separate, standard account for daily tasks and an admin account only when admin-level access is required.

### What You Should Do

- **Request only the access you need** — don't ask for broad access "just in case"
- **Return access when no longer needed** — notify IT when you change roles or complete a project
- **Never share your credentials** — if a colleague needs access, they should request it properly
- **Report unauthorized access** — if you can access something you don't think you should be able to, report it

> **Quick Tip:** Think of access like a master key to a building. Even if you could have one, you shouldn't — you only need keys to the rooms where you work. Least privilege is that same principle, applied to data and systems.

---

## SECTION 6: Phishing and Social Engineering

### The Human Operating System — The Most Targeted Layer

Phishing is the single most common attack vector used against organizations worldwide. It works because it targets human psychology rather than technical vulnerabilities. Attackers don't need to break through your firewall if they can convince you to open the door.

### Types of Phishing

**Email Phishing:** Mass emails impersonating trusted brands (Microsoft, PayPal, banks) designed to steal credentials or install malware.

**Spear Phishing:** Highly targeted emails tailored specifically to you, using your name, role, company information, and sometimes details from your LinkedIn profile or public data.

**Whaling:** Spear phishing targeting executives. Emails may impersonate the CEO, CFO, or board members. Common attack: an email appearing to come from the CEO asking the finance team to wire funds urgently.

**Vishing (Voice Phishing):** Phone calls from attackers impersonating IT support, banks, government agencies, or vendors. They create urgency and ask you to reveal credentials or grant remote access.

**Smishing (SMS Phishing):** Text messages with malicious links, often impersonating delivery services, banks, or HR systems.

### How to Spot a Phishing Email

Look for these red flags:

1. **Sender address mismatch:** Display name says "Microsoft Support" but email is from `microsoftsupport@gmail-secure.com`
2. **Urgency and pressure:** "Your account will be locked in 24 hours!" or "Immediate action required!"
3. **Generic greetings:** "Dear Customer" instead of your name
4. **Suspicious links:** Hover over links before clicking — the URL shown at the bottom of your screen often differs from what's displayed
5. **Unexpected attachments:** An invoice from a vendor you don't recognize, or a "voicemail" file from an unknown number
6. **Grammar and spelling errors:** Though sophisticated attacks are increasingly grammatically correct
7. **Requests for credentials:** Legitimate IT will never ask for your password via email
8. **Unusual sender behavior:** An email from a colleague asking for something out of character

### Real-World Phishing Scenario

**Situation:** You receive an email from `it-helpdesk@yourcompany-support.net` (not your company's actual domain). The email says: *"We've detected unusual sign-in activity on your account. Please verify your identity within 2 hours to avoid suspension. Click here to confirm your identity."* The link goes to a page that looks exactly like your company's login portal.

**What to do:**
1. Do NOT click the link
2. Do NOT enter any credentials
3. Report the email by forwarding it to `security@yourcompany.com` or using your email client's "Report Phishing" button
4. If you're unsure whether the email is legitimate, contact IT through a verified phone number or internal chat — not by replying to the suspicious email

### Social Engineering Beyond Email

Attackers also use non-digital social engineering:

**Pretexting:** Creating a fabricated scenario to extract information. Example: "Hi, I'm from the external audit team and I need access to your system to complete our review. Can you give me your login?"

**Tailgating/Piggybacking:** Following an authorized employee through a secured door without badging in.

**Baiting:** Leaving a USB drive labeled "Salary Information Q4" in the parking lot, knowing a curious employee will plug it in.

**Quid Pro Quo:** Offering a benefit in exchange for information. "I'm from IT — I can fix that software issue you've been having. I just need your login credentials."

**If you encounter social engineering:**
- Verify the identity of the requester through official channels
- Never provide credentials, even to people claiming to be from IT
- Do not allow physical tailgating — politely require everyone to badge in
- Do not plug in unknown USB devices

---

## SECTION 7: Malware and Ransomware

### What Is Malware?

Malware (malicious software) is any software intentionally designed to cause harm to a computer, server, or network. Categories include:

- **Viruses:** Attach to legitimate programs and spread when executed
- **Trojans:** Appear legitimate but contain hidden malicious functionality
- **Spyware:** Secretly monitor and transmit your activities and keystrokes
- **Adware:** Display unwanted advertisements, often bundled with other malware
- **Rootkits:** Conceal malware by modifying the operating system itself
- **Worms:** Self-replicating programs that spread across networks without user interaction

### Ransomware — The Most Devastating Threat

Ransomware is a type of malware that encrypts your files — or your entire organization's files — and demands payment (usually in cryptocurrency) for the decryption key. Modern ransomware attacks often combine encryption with data exfiltration: attackers threaten to publish your stolen data publicly if you don't pay.

**The average ransomware attack costs organizations $4.54 million** in downtime, recovery, legal fees, and potential regulatory fines — far beyond the ransom itself.

**How ransomware spreads:**
- Phishing emails with malicious attachments or links
- Compromised websites (drive-by downloads)
- Exploiting unpatched vulnerabilities
- Remote Desktop Protocol (RDP) exposed to the internet
- Compromised third-party software updates (supply chain attacks)

### How to Protect Yourself

**Never:**
- Download software from unofficial or untrusted sources
- Open email attachments you were not expecting, even from known contacts
- Disable antivirus or endpoint detection software
- Plug in USB devices of unknown origin
- Click pop-ups claiming your computer is infected and offering to "fix" it

**Always:**
- Keep your operating system and software up to date (apply patches promptly)
- Let IT manage software installations
- Save important work to network drives or cloud storage (which are backed up)
- Report unusual system behavior — unexpected slowness, files you can't open, strange pop-ups — immediately

**Warning:** If you see a message on your screen saying your files have been encrypted and demanding payment, do not pay the ransom and do not try to fix it yourself. **Immediately disconnect your device from the network** (unplug the Ethernet cable or disable Wi-Fi) and call the IT security team. Speed matters — isolating the infected device can prevent ransomware from spreading across the entire network.

---

## SECTION 8: Device Security

### Every Device Is an Entry Point

Your work laptop, desktop, mobile phone, and any other device you use to access company systems is a potential entry point for attackers. Securing these devices is fundamental to our ISO 27001 and SOC 2 controls.

### Laptop and Desktop Security

- **Lock your screen** every time you step away, even for two minutes. Use `Windows Key + L` (Windows) or `Control + Command + Q` (Mac). Configure auto-lock after 5 minutes of inactivity.
- **Never leave your device unattended in public places** — coffee shops, airports, conference rooms
- **Enable full-disk encryption** — our IT team manages this centrally. If you have a personal device used for work, confirm encryption is enabled (BitLocker for Windows, FileVault for Mac)
- **Do not install unauthorized software** — only applications approved by IT
- **Apply updates promptly** — when IT pushes an update, install it. Delayed patches leave known vulnerabilities open

### Mobile Device Security

- Use a strong PIN or biometric authentication
- Enable remote wipe capability (in case of loss or theft)
- Only install apps from official stores (App Store, Google Play)
- Do not connect to unsecured public Wi-Fi without a VPN
- Enable automatic OS updates
- Report lost or stolen devices to IT immediately — the sooner we can remotely wipe the device, the less risk of data exposure

### Removable Media

Treat USB drives, external hard drives, and memory cards with extreme caution:
- Only use company-approved, encrypted storage devices
- Never plug in USB drives found in public places
- Do not store sensitive or classified company data on personal USB drives

---

## SECTION 9: Remote Work Security

### The Extended Perimeter

When employees work remotely, the organizational network perimeter effectively extends to every home office, coffee shop, and hotel room. This dramatically increases the attack surface.

### Using a VPN

A Virtual Private Network (VPN) encrypts your internet traffic and routes it through a secure tunnel to our network. **You are required to use the company VPN whenever accessing company resources from outside the office.**

Never access:
- Company email
- Internal systems
- Cloud platforms with sensitive data
- Customer records

...without first connecting to the VPN (unless using systems specifically approved for direct access).

### Home Network Security

Your home router is part of our extended security perimeter when you work remotely:

- Change your router's default username and password
- Use WPA3 or WPA2 encryption (not WEP, which is outdated and easily cracked)
- Keep your router's firmware updated
- Consider setting up a separate Wi-Fi network for your work devices (most modern routers support this)

### Public Wi-Fi — Assume It's Hostile

Public Wi-Fi networks at coffee shops, airports, hotels, and libraries are fundamentally insecure. Attackers can:

- Perform **Man-in-the-Middle attacks** — intercepting your traffic
- Set up **Evil Twin** access points — fake Wi-Fi networks with the same name as a legitimate one
- Capture unencrypted data passing through the network

**Rule:** If you must use public Wi-Fi, always use the company VPN. Never access banking sites, sensitive company systems, or personal accounts without the VPN on an untrusted network.

### Physical Security While Remote

- Do not work on confidential documents in public places where screens can be viewed (shoulder surfing)
- Use a **privacy screen filter** on your laptop when working in public
- Do not leave your device unlocked in a shared living space
- Be aware of who can hear you during phone or video calls discussing confidential information

---

## SECTION 10: Secure Email Usage

### Email Is the Primary Attack Surface

Over 90% of cyberattacks begin with email. Even legitimate email systems can be exploited through misconfiguration, credential theft, or forwarding rules set by attackers.

### Best Practices for Sending Email

- **Verify the recipient before sending** — email autocomplete can default to the wrong person, especially with similar names
- **Encrypt sensitive attachments** — if you must send sensitive files by email, use password-protected archives and share the password via a separate channel (e.g., SMS)
- **Avoid sending PII, financial data, or credentials via email** — use approved secure file sharing platforms instead
- **Do not forward business emails to personal accounts** — this bypasses our security controls and may violate compliance requirements

### Email Rules and Forwarding

Attackers who compromise email accounts often set up forwarding rules to silently copy all incoming emails to an external address. These rules can persist even after the password is changed.

**Regularly check your email forwarding settings.** If you see any rules you didn't create, report it immediately to IT.

### Handling Confidential Email

Label emails containing sensitive information according to our Data Classification Policy (see Section 11). When sending confidential information:
- Use the encrypted email option where available
- Limit recipients to those with a need to know
- Do not CC or BCC people who don't need the information

---

## SECTION 11: Data Classification

### Not All Data Is Equal

Our organization handles many types of data, each with different sensitivity levels and handling requirements. Data classification ensures we apply the right controls to the right data.

### Our Data Classification Levels

**Public**
- Definition: Information approved for public release
- Examples: Marketing materials, published reports, product documentation
- Handling: No special restrictions

**Internal**
- Definition: Information for internal use only, not for public sharing
- Examples: Internal policies, meeting notes, organizational charts
- Handling: Do not share externally without authorization

**Confidential**
- Definition: Sensitive business information that could harm the organization if disclosed
- Examples: Financial records, contracts, employee data, customer lists, business strategies
- Handling: Access on need-to-know basis; encrypt when transmitting; do not share externally without approval

**Restricted (Highly Confidential)**
- Definition: The most sensitive information; disclosure could cause severe harm
- Examples: Personally Identifiable Information (PII), Protected Health Information (PHI), payment card data, trade secrets, cryptographic keys
- Handling: Strictly controlled access; always encrypted; dedicated secure systems; audit logs required

### Your Responsibilities

- Identify the classification level of data before handling, transmitting, or storing it
- Apply the appropriate controls for that classification level
- Do not store Restricted data on personal devices or unauthorized cloud storage
- Do not print Confidential or Restricted documents unless absolutely necessary — and shred securely afterward
- Label documents and files with their classification level where required

---

## SECTION 12: Incident Reporting

### The Importance of Prompt Reporting

Security incidents — or even suspected incidents — must be reported immediately. The longer an incident goes unreported, the more time an attacker has to cause harm. Under our SOC 2 controls and ISO 27001 requirements, we have mandatory incident response procedures that depend on timely notification.

### What Counts as a Security Incident?

- Clicking a phishing link or opening a malicious attachment
- Receiving unexpected MFA requests you didn't initiate
- Discovering unauthorized access to your account
- Losing or having a device stolen
- Accidentally sending an email with sensitive data to the wrong recipient
- Finding confidential documents left in a public area
- Observing someone accessing systems they shouldn't have
- Noticing unusual system behavior (slowness, strange files, unexpected logins)

### How to Report

1. **Immediately notify IT Security** via `security@yourcompany.com` or the internal incident hotline
2. **Do not attempt to investigate or fix the issue yourself** — you may inadvertently destroy evidence or worsen the situation
3. **Preserve evidence** — do not delete emails, logs, or files related to the incident
4. **Document what happened** — time, date, what you observed, what actions you took

### You Will Not Be Punished for Reporting

Our organization maintains a **no-blame culture** around security incident reporting. Employees who make honest mistakes and report them promptly are helping protect the organization. Employees who notice problems and don't report them are creating far greater risk.

**The only behavior that results in disciplinary action is intentional misconduct or deliberate failure to report a known incident.**

---

## SECTION 13: Insider Threats

### What Is an Insider Threat?

An insider threat is a security risk that comes from within the organization — current or former employees, contractors, or business partners who have inside knowledge and access. Insider threats can be:

- **Malicious:** Deliberate theft of data, sabotage, or fraud
- **Negligent:** Unintentional actions that cause harm — leaving a laptop unlocked, clicking a phishing link, misconfiguring a system
- **Compromised:** An employee whose credentials or device have been taken over by an external attacker

### Warning Signs

- Accessing data or systems outside normal working hours
- Downloading unusually large volumes of data
- Accessing data unrelated to their role
- Using personal storage devices or cloud accounts for work data
- Expressing strong grievances or announcing intent to leave combined with unusual access patterns
- Attempting to access restricted areas or systems

### What You Should Do

If you observe behavior that suggests an insider threat, report it to your manager, HR, or the security team through our confidential reporting channel. You are not accusing a colleague — you are protecting the organization and potentially your colleague as well. Legitimate activities will be confirmed; suspicious activities will be investigated appropriately.

---

## SECTION 14: Physical Security

### Securing the Physical Environment

Digital security controls are meaningless if an attacker can physically walk into your workspace and access systems, steal hardware, or photograph confidential documents.

### Access Control

- Always badge in and out — do not allow tailgating (others following you through secured doors without badging)
- Verify the identity of visitors and ensure they are escorted at all times in restricted areas
- Report lost or stolen access badges immediately
- Lock the office when leaving as the last person

### Clean Desk Policy

- Remove all confidential materials from your desk at the end of the day
- Shred documents containing sensitive information rather than placing them in recycling
- Lock file cabinets containing sensitive documents
- Do not leave passwords written on notes near your workstation

### Screen Privacy

- Position monitors so they cannot be viewed by passersby or visitors
- Use privacy screen filters in open-plan offices
- Lock your screen before leaving your desk, even for a moment

---

## SECTION 15: Acceptable Use Policy

### Overview

The Acceptable Use Policy (AUP) defines how company technology resources — computers, networks, email, software, and data — may and may not be used. By using company systems, you agree to abide by these rules.

### Permitted Use

- Work-related tasks using approved tools and systems
- Incidental personal use that does not interfere with work or security (checking a personal email briefly, for example)

### Prohibited Use

- Accessing, downloading, or distributing illegal content
- Using company systems to harass, threaten, or discriminate against others
- Installing unauthorized software or browser extensions
- Circumventing security controls (disabling antivirus, using personal VPNs to bypass company VPN, etc.)
- Mining cryptocurrency or running personal server applications on company hardware
- Storing personal data that would complicate e-discovery or audit processes
- Accessing company data for personal benefit or competitive purposes

### Monitoring

Employees should be aware that company-owned devices and networks may be monitored for security purposes. This monitoring is conducted in accordance with applicable law and company policy, and is not intended to intrude on personal privacy, but rather to protect company and customer data.

---

## SECTION 16: Summary and Key Takeaways

You have completed the content for Module 1. Here are the most critical points to remember:

1. **Security is everyone's responsibility** — you are a critical line of defense
2. **Use strong, unique passwords** managed in the approved password manager
3. **Enable and use MFA everywhere** — never approve unexpected MFA requests
4. **Be suspicious of every email** — phishing is the #1 attack vector
5. **Follow least privilege** — request only the access you need
6. **Classify and protect data** appropriately based on sensitivity
7. **Report incidents immediately** — no blame, no delay
8. **Secure your devices** — lock screens, encrypt disks, update promptly
9. **Use the VPN** for all remote work on sensitive systems
10. **Physical security matters** — badge in, clean desk, shred sensitive documents

---