const RESEND_ENDPOINT = "https://api.resend.com/emails";

export function isPasswordResetEmailConfigured() {
  return Boolean(process.env.RESEND_API_KEY && process.env.AUTH_EMAIL_FROM);
}

export async function sendPasswordResetEmail(input: { to: string; name: string; resetUrl: string }) {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.AUTH_EMAIL_FROM;
  if (!apiKey || !from) throw new Error("Password reset email delivery is not configured.");

  const response = await fetch(RESEND_ENDPOINT, {
    method: "POST",
    headers: { authorization: `Bearer ${apiKey}`, "content-type": "application/json" },
    body: JSON.stringify({
      from,
      to: [input.to],
      subject: "Reset your Agent.Raven password",
      text: `Hello ${input.name},\n\nUse this one-time link to reset your Agent.Raven password:\n${input.resetUrl}\n\nThe link expires in one hour. If you did not request this, you can ignore this email.`,
    }),
  });
  if (!response.ok) throw new Error(`Password reset email provider returned ${response.status}.`);
}
