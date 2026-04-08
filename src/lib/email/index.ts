import { Resend } from "resend";
import { getAppUrl } from "@/lib/utils";

function getResend() {
  return new Resend(process.env.RESEND_API_KEY);
}
const from = () => process.env.EMAIL_FROM || "Pulsr <hello@pulsr.app>";

export async function sendMagicLinkEmail(email: string, token: string) {
  const url = `${getAppUrl()}/auth/callback?token=${token}`;

  await getResend().emails.send({
    from: from(),
    to: email,
    subject: "Your Pulsr login link",
    html: `
      <div style="font-family: Inter, system-ui, sans-serif; max-width: 480px; margin: 0 auto; padding: 40px 20px;">
        <h1 style="font-size: 24px; font-weight: 800; margin: 0 0 8px;">
          <span style="background: linear-gradient(135deg, #A855F7, #EC4899); -webkit-background-clip: text; -webkit-text-fill-color: transparent;">Pulsr</span>
        </h1>
        <p style="color: #71717a; margin: 0 0 32px; font-size: 14px;">All your stats. One bold dashboard.</p>
        <p style="color: #e4e4e7; font-size: 16px; line-height: 1.6; margin: 0 0 24px;">
          Click the button below to sign in to Pulsr. This link expires in 15 minutes.
        </p>
        <a href="${url}" style="display: inline-block; background: linear-gradient(135deg, #A855F7, #EC4899); color: white; font-weight: 600; font-size: 14px; padding: 12px 32px; border-radius: 8px; text-decoration: none;">
          Sign in to Pulsr
        </a>
        <p style="color: #52525b; font-size: 12px; margin-top: 32px; line-height: 1.5;">
          If you didn't request this email, you can safely ignore it.
        </p>
      </div>
    `,
  });
}

export async function sendTrialReminderEmail(email: string) {
  const billingUrl = `${getAppUrl()}/settings/billing`;

  await getResend().emails.send({
    from: from(),
    to: email,
    subject: "Your Pulsr trial ends tomorrow",
    html: `
      <div style="font-family: Inter, system-ui, sans-serif; max-width: 480px; margin: 0 auto; padding: 40px 20px;">
        <h1 style="font-size: 24px; font-weight: 800; margin: 0 0 8px;">
          <span style="background: linear-gradient(135deg, #A855F7, #EC4899); -webkit-background-clip: text; -webkit-text-fill-color: transparent;">Pulsr</span>
        </h1>
        <p style="color: #e4e4e7; font-size: 16px; line-height: 1.6; margin: 0 0 16px;">
          Hey! Your 7-day Pulsr trial ends <strong>tomorrow</strong>.
        </p>
        <p style="color: #a1a1aa; font-size: 14px; line-height: 1.6; margin: 0 0 24px;">
          Upgrade to Pulsr Pro ($29/mo) to keep your dashboard, scheduling, and analytics running smoothly.
        </p>
        <a href="${billingUrl}" style="display: inline-block; background: linear-gradient(135deg, #A855F7, #EC4899); color: white; font-weight: 600; font-size: 14px; padding: 12px 32px; border-radius: 8px; text-decoration: none;">
          Upgrade now
        </a>
      </div>
    `,
  });
}
