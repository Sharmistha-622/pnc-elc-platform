/**
 * Onboarding email templates.
 *
 * Extracted verbatim from the Google Apps Script `gmail.gs` so the copy, links
 * and formatting People & Culture already rely on carry over unchanged. Only the
 * placeholders were re-pointed at the typed `EmailTemplateContext` below.
 *
 * Do not edit the markup by hand to fix a broken link — fix it here and treat
 * this file as the single source of truth now that the script is retired.
 */

import type { EmployeeType } from '@/types/onboarding'

export type EmailTemplateContext = {
  employeeName: string
  officialEmail: string | null
  personalEmail: string | null
  employeeType: EmployeeType
  /**
   * Only ever supplied for a credential email that a human is sending by hand.
   * This application never stores account passwords.
   */
  temporaryPassword?: string
}

export type RenderedEmail = {
  subject: string
  html: string
}

/** Wraps a body fragment in the standard NavGurukul email shell. */
const wrapHtml = (body: string): string => `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
</head>
<body style="font-family: Arial, sans-serif; font-size: 14px; line-height: 1.6; color: #333333;">
  ${body}
</body>
</html>`

const credentialEmail = (context: EmailTemplateContext): RenderedEmail => ({
  subject: 'Welcome to NavGurukul! \u{1F389} | Your Pre-Joining Setup',
  html: wrapHtml(`
<p>Hi ${context.employeeName},</p>

<p>Welcome to <strong>NavGurukul! 🎉</strong> We’re so excited to have you join us and look forward to welcoming you soon.</p>

<p>Before your Date of Joining (DOJ), here are a few quick things to help you get set up:</p>

<h3>Action</h3>
<ul style="list-style-type: none; padding-left: 0;">
  <li style="margin-bottom: 10px;">
    📧 <strong>Activate your official email</strong> — Please log in using the credentials shared below and start using this email for all official communication.
  </li>
  <li style="margin-bottom: 10px;">
    📝 <strong>Complete the <a href="https://docs.google.com/forms/u/0/d/1iD0qz2XjAJ-PLJFHlOxZZjuMVtIX1ZCUbQwgWWiZa-k/preview" target="_blank">NG Annual Database Form</a></strong> — Please use your official email and ensure your bank details, PAN and other information are accurate.
  </li>
</ul>

<p style="text-align: center; background-color: #fff4cc; padding: 10px; border-radius: 4px; font-weight: bold; margin-top: 15px; margin-bottom: 15px;">
  ⏰ We recommend completing the above action items within 24 hours of receiving this email to ensure a smooth onboarding experience.
</p>

<h3>Your official email:</h3>
<table cellpadding="6" cellspacing="0" style="border-collapse: collapse; background-color: #f9f9f9; border: 1px solid #ddd; width: 100%; max-width: 400px;">
  <tr>
    <td><strong>Username:</strong></td>
    <td>${context.officialEmail ?? ""}</td>
  </tr>
  <tr>
    <td><strong>Temporary Password:</strong></td>
    <td>${context.temporaryPassword ?? "(shared separately by People &amp; Culture)"}</td>
  </tr>
</table>

<br>
<p>🔐 <strong>For security, please change your temporary password after your first login.</strong></p>

<p>If you have any trouble accessing your email or completing the form, simply reply to this email—we’re happy to help.</p>

<p>We’re looking forward to having you with us!</p>

<p>Warmly,<br>
<strong>People & Culture Team</strong><br>
NavGurukul</p>
`),
})

const preJoiningEmail = (context: EmailTemplateContext): RenderedEmail => ({
  subject: 'Getting Ready for Day 1 at NavGurukul',
  html: wrapHtml(`
<p>Hi ${context.employeeName},</p>

<p>We’re almost there!</p>

<p>As you get ready to begin your journey at NavGurukul, we’re sharing a few tools and resources to help you get familiar with how we communicate, work, and collaborate.</p>

<table cellpadding="8" cellspacing="0" style="border-collapse: collapse; border: 1px solid #ccc; width: 100%;">
  <tr style="background-color: #f9f9f9;">
    <th style="border: 1px solid #ccc; text-align: left;">Resource</th>
    <th style="border: 1px solid #ccc; text-align: left;">What it’s for</th>
    <th style="border: 1px solid #ccc; text-align: left;">What you need to do</th>
  </tr>
  <tr>
    <td style="border: 1px solid #ccc;"><a href="https://drive.google.com/file/d/1oWCgaThcG_EFKsvMe4UX6QfY7GK92FdU/view?usp=sharing" target="_blank">NG Deck</a></td>
    <td style="border: 1px solid #ccc;">A quick introduction to NavGurukul, our mission, programs, and impact</td>
    <td style="border: 1px solid #ccc;">Read, understand, and reflect</td>
  </tr>
  <tr>
    <td style="border: 1px solid #ccc;"><a href="https://drive.google.com/file/d/1hWQ9km-Hyt3tw-1OWTyhQvaQaR2s9nBI/view?usp=drive_link" target="_blank">Employee Handbook</a></td>
    <td style="border: 1px solid #ccc;">An overview of our policies and ways of working</td>
    <td style="border: 1px solid #ccc;">Please read it and submit the signed acknowledgment through the <a href="https://docs.google.com/forms/d/e/1FAIpQLSdoJRjZK0HBeyQPuHHJnFHjk3GLCYy_Z24el0YKnlNsgzlSnQ/viewform?usp=preview" target="_blank">submission form</a></td>
  </tr>
  <tr>
    <td style="border: 1px solid #ccc;"><a href="https://www.notion.so/navgurukul/NG-Values-Cultural-Principles-2cca93c7c3918084990ad262e78eaec4" target="_blank">Culture Principles</a></td>
    <td style="border: 1px solid #ccc;">A glimpse into our values and how we work together</td>
    <td style="border: 1px solid #ccc;">Read, understand, and reflect</td>
  </tr>
  <tr>
    <td style="border: 1px solid #ccc;"><a href="https://navgurukul.slack.com/ssb/redirect" target="_blank">Slack</a></td>
    <td style="border: 1px solid #ccc;">Our primary space for team communication<br><br>Key channels include:<br>#everybody, #team-everybody, #random, #celebrations &amp; #help_pnc</td>
    <td style="border: 1px solid #ccc;">Sign in using your official NavGurukul email ID and join <a href="http://navgurukul.slack.com/" target="_blank">navgurukul.slack.com</a><br><br>Refer to the <a href="https://drive.google.com/file/d/1iTtQ9Hy7UscNNdp5SUva0Ig8iBFjPuIO/view?usp=sharing" target="_blank">Slack &amp; Async Guide</a></td>
  </tr>
  <tr>
    <td style="border: 1px solid #ccc;"><a href="https://discord.com/invite/Rwf9YBTY" target="_blank">Discord</a></td>
    <td style="border: 1px solid #ccc;">Used especially for campus and student-related coordination<br><br>Mandatory for residential teams and optional for remote/non-residential roles</td>
    <td style="border: 1px solid #ccc;">Refer to the <a href="https://docs.google.com/document/d/1lGYTqEAEeGZF14CSQbEw6NR9digF0mGjhSN_E-vN3iI/edit?tab=t.0" target="_blank">Discord Guide</a></td>
  </tr>
  <tr>
    <td style="border: 1px solid #ccc;"><a href="https://stub-client.navgurukul.org/tracker" target="_blank">Activity Tracker</a></td>
    <td style="border: 1px solid #ccc;">Used to record your attendance, tasks, projects, and time spent and payroll</td>
    <td style="border: 1px solid #ccc;">Fill the <a href="https://docs.google.com/forms/u/0/d/1iD0qz2XjAJ-PLJFHlOxZZjuMVtIX1ZCUbQwgWWiZa-k/preview" target="_blank">NG Annual Database Form</a>, if you haven’t already; your account will be activated within ~24 hours<br><br>Start updating the tracker daily from Day 1</td>
  </tr>
</table>

<br>
<h3>What to Expect on Day 1</h3>
<ul>
  <li>Welcome session: NavGurukul, culture, team, role &amp; initial setup</li>
  <li>Technical onboarding: Key tools, systems &amp; day-to-day processes</li>
</ul>

<p>We’re looking forward to welcoming you and having you join the NavGurukul journey. 🎉</p>
<p>If you have any questions along the way, we’re just a message away! 😊</p>

<p>Warmly,<br>
<strong>People &amp; Culture Team</strong><br>
NavGurukul</p>
`),
})

const accessEmail = (context: EmailTemplateContext): RenderedEmail => ({
  subject: `Access & Onboarding Information | ${context.employeeName}`,
  html: wrapHtml(`
<p>Hi ${context.employeeName},</p>

<p>Good morning and welcome once again to <strong>NavGurukul</strong>!</p>

<p>
As you begin your journey with us today, we are sharing a few important tools and forms that will help you get set up and ready for Day 1. Please go through the instructions below and complete the required steps.
</p>

<p><strong>1. NG Database Form & Activity Tracker</strong></p>

<p>
We request you to complete the <a href="https://docs.google.com/forms/u/0/d/1iD0qz2XjAJ-PLJFHlOxZZjuMVtIX1ZCUbQwgWWiZa-k/preview" target="_blank"><strong>NG Annual Database Form</strong></a> using the official NavGurukul email ID shared with you. This information is important for official records and processes such as salary and internal documentation, so please make sure the details are accurate.
</p>

<p><strong>Important points:</strong></p>

<ul>
  <li>Please use your <strong>team email ID</strong> while filling the form.</li>
  <li>If you are an <strong>NG Alumni</strong>, please avoid using your student email ID.</li>
  <li>Once the database form is submitted, it will take <strong>around 24 hours</strong> for your <strong>Activity Tracker</strong> to get activated.</li>
</ul>

<p>
After 24 hours, you can log in to the <a href="https://stub-client.navgurukul.org/tracker" target="_blank"><strong>Activity Tracker</strong></a> using your official email ID. The tracker works like your <strong>attendance and daily work log</strong>, where you will record your attendance, tasks, projects, and the time spent on them.
</p>

<p><strong>2. Communication Tools – Slack & Discord</strong></p>

<h4><a href="https://navgurukul.slack.com/ssb/redirect" target="_blank"><strong>Slack</strong></a></h4>

<p>
We use <strong>Slack</strong> for most of our <strong>asynchronous team communication</strong>. Different channels help us keep conversations organized and ensure smooth coordination across teams.
</p>

<p>Some key Slack channels you will see:</p>

<ul>
  <li><strong>#everybody</strong> – Organization-wide announcements</li>
  <li><strong>#team-everybody</strong> – Internal updates and alignment messages</li>
  <li><strong>#random</strong> – Informal conversations with teammates</li>
  <li><strong>#celebrations</strong> – Birthdays, milestones, and achievements</li>
  <li><strong>#help_pnc</strong> – For any People &amp; Culture related queries</li>
</ul>

<p>
We are also attaching a <strong>short video guide on how to use Slack and asynchronous communication</strong> to help you get started. <a href="https://drive.google.com/file/d/1iTtQ9Hy7UscNNdp5SUva0Ig8iBFjPuIO/view?usp=sharing" target="_blank">Link</a>
</p>

<hr>

<h4><a href="https://discord.com/invite/Rwf9YBTY" target="_blank"><strong>Discord</strong></a></h4>

<p>
We also use <strong>Discord</strong> as an important communication space, especially for <strong>campus and student-related coordination</strong>. Many of our students and residential teams communicate here regularly, as it helps us stay closely connected with the learning environment.
</p>

<ul>
  <li>If you are part of a <strong>residential team</strong>, joining the Discord server is <strong>mandatory</strong> as most student and campus coordination happens there.</li>
  <li>If you are in a <strong>remote or non-residential role</strong>, Slack will be enough for official communication, but you are still welcome to join Discord to stay connected with the community.</li>
</ul>

<p>
We are attaching a <strong>guide on how to join the Discord server</strong> as well. <a href="https://docs.google.com/document/d/1lGYTqEAEeGZF14CSQbEw6NR9digF0mGjhSN_E-vN3iI/edit?tab=t.0" target="_blank">Link</a>
</p>

<p>
We are really happy to have you here and wish you a great start to your journey at <strong>NavGurukul</strong>.
</p>

<p>
Warmly,<br>
People &amp; Culture Team<br>
NavGurukul
</p>
`),
})

const onboardingTasksEmail = (context: EmailTemplateContext): RenderedEmail => ({
  subject: `Welcome to NavGurukul \u2013 Your Induction Journey | ${context.employeeName}`,
  html: wrapHtml(`
<p>Good morning, and once again, a warm welcome to NavGurukul! 🌱</p>

<p>
We’re excited to introduce the <strong>NavGurukul Induction Challenge</strong> — a two-week journey to help you understand our culture, ways of working, values, AI practices, and mission.
</p>

<p>
📎 <strong>Induction Journey Document:</strong> <a href="https://docs.google.com/document/d/1_b0L7KlxhS4wUAnQ5UlDN5M6Lyd9MONz/edit?usp=sharing&ouid=100861502354267487540&rtpof=true&sd=true" target="_blank">NavGurukul_Onboarding_Journey</a>
</p>

<p>You’ll also have:</p>

<ul>
  <li>A dedicated onboarding Slack channel with your <strong>manager, buddy, and P&amp;C team.</strong></li>
  <li>An <a href="https://app.notion.com/p/navgurukul/388a93c7c391807ab9c1f42b7793ea71?pvs=106" target="_blank"><strong>Induction Submission Link (Notion)</strong></a> to submit your work and reflections.</li>
</ul>

<p><strong>Please note:</strong></p>

<ul>
  <li>Complete the entire induction journey <strong>within 14 days of your Date of Joining (DOJ)</strong></li>
  <li>Follow the timelines mentioned for each focus area and complete the tasks within the specified period</li>
  <li>If a focus area has multiple sub-tasks, such as <strong>2A, 2B, and 2C</strong>, complete <strong>all the sub-tasks</strong> and submit them together as <strong>one document under Focus Area 2</strong></li>
  <li>In total, you are expected to submit <strong>6 documents</strong>, one for each focus area</li>
</ul>

<p>
Take this opportunity to explore, reflect, and ask questions along the way. We look forward to your reflections!
</p>

<br>
<p>
Delightfully,<br>
<strong>People &amp; Culture Team | NavGurukul</strong>
</p>
`),
})

const week1FollowupEmail = (context: EmailTemplateContext): RenderedEmail => ({
  subject: `Week 1 Check-In | ${context.employeeName}`,
  html: wrapHtml(`
<p>Hi ${context.employeeName},</p>

<p>Hope you're having a great time settling in at NavGurukul!</p>

<p>How are the Induction challenges going so far? We would love to hear how you're finding them and what you're learning along the way.</p>

<p>This is a quick reminder that the induction challenges need to be completed and submitted by the end of Week 2 of your joining.</p>

<p>
🔗 <strong>Induction Submission Link</strong><br>
<a href="https://app.notion.com/p/navgurukul/388a93c7c391807ab9c1f42b7793ea71?pvs=106" target="_blank">Link to form</a>
</p>

<p>If you need any support along the way, feel free to reach out on your onboarding Slack channel. We are happy to help.</p>

<p>Looking forward to receiving your submission!</p>

<br>
<p>
Warm Regards,<br><br>
<strong>People &amp; Culture Team</strong><br>
<strong>NavGurukul</strong>
</p>
`),
})

const week2FollowupEmail = (context: EmailTemplateContext): RenderedEmail => ({
  subject: `Complete Your Induction Journey | ${context.employeeName}`,
  html: wrapHtml(`
<p>Hi ${context.employeeName},</p>

<p>Hope you're doing well and settling in comfortably at NavGurukul! 🌱</p>

<p>It's been about two weeks since you joined us, so we wanted to check in on your induction journey.</p>

<p>
If you haven't already, please take some time to complete your induction journey and submit your remaining reflections and activities through the <strong>Induction Submission Form</strong>.
</p>

<p>
🔗 <strong>Induction Submission Form</strong><br>
<a href="https://app.notion.com/p/navgurukul/388a93c7c391807ab9c1f42b7793ea71?pvs=106" target="_blank">Link to form</a>
</p>

<p>Your reflections and feedback are valuable to us, and we'd love to hear about your experience.</p>

<p>
If you need any support or have questions, please feel free to reach out to your buddy, manager, or the People &amp; Culture Team, would love to help you.
</p>

<p>
Thank you for being a part of this journey. We wish you all the very best as you continue your journey at NavGurukul!
</p>

<br>
<p>
Warm Regards,<br><br>
<strong>People &amp; Culture Team</strong><br>
<strong>NavGurukul</strong>
</p>
`),
})

const milestoneEmail = (context: EmailTemplateContext): RenderedEmail => ({
  subject: `${context.employeeType === 'intern' ? 'Internship' : 'Probation'} Completion Reminder | ${context.employeeName}`,
  html: wrapHtml(`
<p>Hi ${context.employeeName},</p>

<p>Welcome to <strong>NavGurukul! 🎉</strong> We’re so excited to have you join us and look forward to welcoming you soon.</p>

<p>Before your Date of Joining (DOJ), here are a few quick things to help you get set up:</p>

<h3>Action</h3>
<ul style="list-style-type: none; padding-left: 0;">
  <li style="margin-bottom: 10px;">
    📧 <strong>Activate your official email</strong> — Please log in using the credentials shared below and start using this email for all official communication.
  </li>
  <li style="margin-bottom: 10px;">
    📝 <strong>Complete the <a href="https://docs.google.com/forms/u/0/d/1iD0qz2XjAJ-PLJFHlOxZZjuMVtIX1ZCUbQwgWWiZa-k/preview" target="_blank">NG Annual Database Form</a></strong> — Please use your official email and ensure your bank details, PAN and other information are accurate.
  </li>
</ul>

<p style="text-align: center; background-color: #fff4cc; padding: 10px; border-radius: 4px; font-weight: bold; margin-top: 15px; margin-bottom: 15px;">
  ⏰ We recommend completing the above action items within 24 hours of receiving this email to ensure a smooth onboarding experience.
</p>

<h3>Your official email:</h3>
<table cellpadding="6" cellspacing="0" style="border-collapse: collapse; background-color: #f9f9f9; border: 1px solid #ddd; width: 100%; max-width: 400px;">
  <tr>
    <td><strong>Username:</strong></td>
    <td>${context.officialEmail ?? ""}</td>
  </tr>
  <tr>
    <td><strong>Temporary Password:</strong></td>
    <td>${context.temporaryPassword ?? ""}</td>
  </tr>
</table>

<br>
<p>🔐 <strong>For security, please change your temporary password after your first login.</strong></p>

<p>If you have any trouble accessing your email or completing the form, simply reply to this email—we’re happy to help.</p>

<p>We’re looking forward to having you with us!</p>

<p>Warmly,<br>
<strong>People & Culture Team</strong><br>
NavGurukul</p>
`),
})

const mergeEmail = (context: EmailTemplateContext): RenderedEmail => ({
  subject: 'Welcome to NavGurukul! | Pre-Joining Setup & Official Email',
  html: wrapHtml(`
<p>Hi ${context.employeeName},</p>

<p>Welcome to NavGurukul!</p>
<p>We’re so excited to have you join us and look forward to welcoming you tomorrow!</p>
<p>As you get ready to begin your journey at NavGurukul, here are a few important actions, tools, and resources to help you complete your pre-joining setup and get familiar with how we communicate, work, and collaborate.</p>

<h3>Before Your First Day</h3>
<p>Please complete the following action items before your Date of Joining (DOJ):</p>

<ul>
  <li>📧 <strong>Activate your official email</strong> — Please log in using the credentials shared below and start using this email for all official communication.</li>
  <li>📝 <strong>Complete the <a href="https://docs.google.com/forms/u/0/d/1iD0qz2XjAJ-PLJFHlOxZZjuMVtIX1ZCUbQwgWWiZa-k/preview" target="_blank">NG Annual Database Form</a></strong> — Please use your official email and ensure your bank details, PAN, and other information are accurate.</li>
</ul>

<p>We recommend completing the above action items within 24 hours of receiving this email to ensure a smooth onboarding experience.</p>

<p><strong>Your official email:</strong><br>
<strong>Username:</strong> ${context.officialEmail ?? ""}<br>
<strong>Temporary Password:</strong> ${context.temporaryPassword ?? "(shared separately by People &amp; Culture)"}</p>

<p>🔐 For security, please change your temporary password after your first login.</p>

<h3>Resources to Get You Started</h3>

<table cellpadding="8" cellspacing="0" style="border-collapse: collapse; border: 1px solid #ccc; width: 100%;">
  <tr style="background-color: #f9f9f9;">
    <th style="border: 1px solid #ccc; text-align: left;">Resource</th>
    <th style="border: 1px solid #ccc; text-align: left;">What it’s for</th>
    <th style="border: 1px solid #ccc; text-align: left;">What you need to do</th>
  </tr>
  <tr>
    <td style="border: 1px solid #ccc;"><a href="https://drive.google.com/file/d/1oWCgaThcG_EFKsvMe4UX6QfY7GK92FdU/view?usp=sharing" target="_blank">NG Deck</a></td>
    <td style="border: 1px solid #ccc;">A quick introduction to NavGurukul, our mission, programs, and impact</td>
    <td style="border: 1px solid #ccc;">Read, understand, and reflect</td>
  </tr>
  <tr>
    <td style="border: 1px solid #ccc;"><a href="https://drive.google.com/file/d/1hWQ9km-Hyt3tw-1OWTyhQvaQaR2s9nBI/view?usp=drive_link" target="_blank">Employee Handbook</a></td>
    <td style="border: 1px solid #ccc;">An overview of our policies and ways of working</td>
    <td style="border: 1px solid #ccc;">Please read it and submit the signed acknowledgment through the <a href="https://docs.google.com/forms/d/e/1FAIpQLSdoJRjZK0HBeyQPuHHJnFHjk3GLCYy_Z24el0YKnlNsgzlSnQ/viewform?usp=preview" target="_blank">submission form</a></td>
  </tr>
  <tr>
    <td style="border: 1px solid #ccc;"><a href="https://www.notion.so/navgurukul/NG-Values-Cultural-Principles-2cca93c7c3918084990ad262e78eaec4" target="_blank">Culture Principles</a></td>
    <td style="border: 1px solid #ccc;">A glimpse into our values and how we work together</td>
    <td style="border: 1px solid #ccc;">Read, understand, and reflect</td>
  </tr>
  <tr>
    <td style="border: 1px solid #ccc;"><a href="https://navgurukul.slack.com/ssb/redirect" target="_blank">Slack</a></td>
    <td style="border: 1px solid #ccc;">Our primary space for team communication<br><br>Key channels include:<br>#everybody, #team-everybody, #random, #celebrations &amp; #help_pnc</td>
    <td style="border: 1px solid #ccc;">Sign in using your official NavGurukul email ID and join <a href="http://navgurukul.slack.com/" target="_blank">navgurukul.slack.com</a><br><br>Refer to the <a href="https://drive.google.com/file/d/1iTtQ9Hy7UscNNdp5SUva0Ig8iBFjPuIO/view?usp=sharing" target="_blank">Slack &amp; Async Guide</a></td>
  </tr>
  <tr>
    <td style="border: 1px solid #ccc;"><a href="https://discord.com/invite/Rwf9YBTY" target="_blank">Discord</a></td>
    <td style="border: 1px solid #ccc;">Used especially for campus and student-related coordination<br><br>Mandatory for residential teams and optional for remote/non-residential roles</td>
    <td style="border: 1px solid #ccc;">Refer to the <a href="https://docs.google.com/document/d/1lGYTqEAEeGZF14CSQbEw6NR9digF0mGjhSN_E-vN3iI/edit?tab=t.0" target="_blank">Discord Guide</a></td>
  </tr>
  <tr>
    <td style="border: 1px solid #ccc;"><a href="https://stub-client.navgurukul.org/tracker" target="_blank">Activity Tracker</a></td>
    <td style="border: 1px solid #ccc;">Used to record your attendance, tasks, projects, time spent, and payroll</td>
    <td style="border: 1px solid #ccc;">Your account will be activated within ~24 hours after completing the NG Annual Database Form.<br><br>Start updating the tracker daily from Day 1</td>
  </tr>
</table>

<br>
<h3>What to Expect on Day 1</h3>
<ul>
  <li>🎉 Welcome session: NavGurukul, culture, team, role &amp; initial setup</li>
  <li>💻 Technical onboarding: Key tools, systems &amp; day-to-day processes</li>
</ul>

<p>If you have any trouble accessing your email, completing the form, or accessing any of the resources, simply reply to this email — we’re happy to help.</p>
<p>We’re looking forward to welcoming you and having you join the NavGurukul journey!</p>

<p>Warmly,<br>
<strong>People &amp; Culture Team</strong><br>
NavGurukul</p>
`),
})

const techResourcesEmail = (context: EmailTemplateContext): RenderedEmail => ({
  subject: 'Your Technical Onboarding | Session Recap & Resources',
  html: wrapHtml(`
  <p>Hi ${context.employeeName},</p>
  <p>In the Technical Onboarding session, we covered the key tools, systems, and processes to help you get started.</p>
  <p>You can revisit the <a href="https://gamma.app/docs/Welcome-to-NavGurukul-bz2v24p71iyt06x?mode=doc" target="_blank">Technical Onboarding Deck</a> for a quick refresher.</p>
  <p>Please access the <a href="https://assets.navgurukul.org/" target="_blank">Asset Dashboard</a> to raise requests for laptops and other assets.</p>
  <p>If you have any questions, feel free to reach out. We’re happy to support you as you settle in.</p>
  <p>Warm regards,<br>People & Culture Team<br>NavGurukul</p>
  
`),
})

const techReminderEmail = (context: EmailTemplateContext): RenderedEmail => ({
  subject: `Mandatory: Technical Onboarding Call | ${context.employeeName}`,
  html: wrapHtml(`
  <p>Hi ${context.employeeName},</p>
  <p>We noticed that you did not attend the technical onboarding call.</p>
  <p>Attendance for this session is <strong>mandatory and non-negotiable.</strong></p>
  <p>The session covers the daily work tracking process, which is directly linked to payroll and is therefore an essential process that every team member is expected to understand and follow correctly.</p>
  <p>Missing the session may result in gaps in understanding the process and can impact the accuracy of your work tracking and payroll processing.</p>
  <p>Please connect with the PnC team and ensure that you attend the next scheduled technical onboarding session.</p>
  <p>Thank you for your cooperation.</p>
  <p>Warm regards,<br>People & Culture Team<br>NavGurukul</p>
  
`),
})

/** Email renderers, keyed by onboarding step. */
export const EMAIL_TEMPLATES: Record<
  string,
  (context: EmailTemplateContext) => RenderedEmail
> = {
  credential_email: credentialEmail,
  pre_joining_email: preJoiningEmail,
  access_email: accessEmail,
  onboarding_tasks_email: onboardingTasksEmail,
  week1_followup_email: week1FollowupEmail,
  week2_followup_email: week2FollowupEmail,
  milestone_email: milestoneEmail,
  merge_email: mergeEmail,
  tech_resources_email: techResourcesEmail,
  tech_reminder_email: techReminderEmail,
}
