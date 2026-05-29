import sgMail from '@sendgrid/mail';

const FROM = 'no-reply@nibley.online';
const APP = 'Kickoff 2026';

function clientUrl(path) {
  return `${process.env.CLIENT_URL || 'http://localhost:5173'}${path}`;
}

async function send(msg) {
  if (!process.env.SENDGRID_API_KEY) {
    console.warn('[email] SENDGRID_API_KEY not set — skipping email to', msg.to);
    return;
  }
  sgMail.setApiKey(process.env.SENDGRID_API_KEY);
  try {
    await sgMail.send(msg);
    console.log('[email] Sent successfully to', msg.to);
  } catch (err) {
    console.error('[email] Failed to send to', msg.to);
    console.error('[email] Message:', err.message);
    if (err.response?.body) {
      console.error('[email] SendGrid error body:', JSON.stringify(err.response.body, null, 2));
    }
    throw err;
  }
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// ── Public send functions ─────────────────────────────────────────────────────

export function sendVerificationCode(to, name, code) {
  return send({
    to,
    from: { email: FROM, name: APP },
    subject: `Your ${APP} verification code`,
    html: codeHtml({
      name,
      code,
      title: 'Verify your email',
      subtitle: 'Enter this code on the registration page to complete your sign-up.',
      minutes: 10,
    }),
  });
}

export function sendPasswordResetCode(to, name, code) {
  return send({
    to,
    from: { email: FROM, name: APP },
    subject: `Your ${APP} password reset code`,
    html: codeHtml({
      name,
      code,
      title: 'Reset your password',
      subtitle: 'Enter this code along with your new password to reset your account.',
      minutes: 10,
    }),
  });
}

// ── HTML template ─────────────────────────────────────────────────────────────

function codeHtml({ name, code, title, subtitle, minutes }) {
  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:Arial,Helvetica,sans-serif">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0"
         style="background:#f1f5f9;padding:40px 16px">
    <tr><td align="center">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0"
             style="max-width:480px;background:#ffffff;border-radius:12px;overflow:hidden;
                    box-shadow:0 1px 3px rgba(0,0,0,.1)">

        <!-- Header -->
        <tr>
          <td style="background:#0f172a;padding:24px 32px">
            <p style="margin:0;font-size:20px;font-weight:700;color:#10b981">&#9917; ${APP}</p>
          </td>
        </tr>

        <!-- Body -->
        <tr>
          <td style="padding:32px">
            <h1 style="margin:0 0 8px;font-size:22px;font-weight:700;color:#0f172a">${title}</h1>
            <p style="margin:0 0 4px;font-size:15px;color:#475569;line-height:1.6">
              Hi ${escapeHtml(name)},
            </p>
            <p style="margin:0 0 28px;font-size:15px;color:#475569;line-height:1.6">
              ${subtitle}
            </p>

            <!-- Code box -->
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0"
                   style="margin:0 0 28px">
              <tr>
                <td align="center"
                    style="background:#f8fafc;border:2px dashed #e2e8f0;border-radius:12px;padding:24px 16px">
                  <p style="margin:0 0 4px;font-size:11px;font-weight:700;letter-spacing:2px;
                             color:#94a3b8;text-transform:uppercase">Your code</p>
                  <p style="margin:0;font-size:44px;font-weight:900;letter-spacing:14px;
                             color:#10b981;font-family:'Courier New',monospace">${code}</p>
                </td>
              </tr>
            </table>

            <p style="margin:0;font-size:13px;color:#94a3b8;line-height:1.5">
              This code expires in <strong>${minutes} minutes</strong> and can only be used once.
              If you didn't request this, you can safely ignore this email.
            </p>
          </td>
        </tr>

        <!-- Footer -->
        <tr>
          <td style="border-top:1px solid #e2e8f0;padding:16px 32px;background:#f8fafc">
            <p style="margin:0;font-size:12px;color:#94a3b8">
              Sent by ${APP} &middot;
              <a href="mailto:${FROM}" style="color:#94a3b8;text-decoration:none">${FROM}</a>
            </p>
          </td>
        </tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`;
}
