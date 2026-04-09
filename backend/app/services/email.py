import smtplib
from email.message import EmailMessage
from html import escape
import logging
import socket

from app.core.config import settings

logger = logging.getLogger(__name__)


def _smtp_configured() -> bool:
    return all(
        [
            settings.SMTP_HOST,
            settings.SMTP_PORT,
            settings.SMTP_USER,
            settings.SMTP_PASSWORD,
            settings.EMAILS_FROM_EMAIL,
        ]
    )


def _sender_header() -> str:
    sender_email = _smtp_sender_email()
    if settings.EMAILS_FROM_NAME:
        return f"{settings.EMAILS_FROM_NAME} <{sender_email}>"
    return sender_email


def _smtp_sender_email() -> str:
    from_email = (settings.EMAILS_FROM_EMAIL or "").strip()
    smtp_user = (settings.SMTP_USER or "").strip()
    smtp_host = (settings.SMTP_HOST or "").strip().lower()

    # Gmail SMTP commonly rejects custom From addresses unless configured as a verified alias.
    if "gmail.com" in smtp_host and smtp_user and from_email.lower() != smtp_user.lower():
        return smtp_user
    return from_email or smtp_user


def _brand_email_html(*, eyebrow: str, title: str, intro: str, action_label: str | None = None, action_url: str | None = None, outro: str | None = None) -> str:
    button_html = ""
    if action_label and action_url:
        button_html = (
            f'<p style="margin: 28px 0 20px;">'
            f'<a href="{escape(action_url, quote=True)}" '
            f'style="display:inline-block;padding:14px 20px;border-radius:12px;'
            f'background:#0079C1;color:#ffffff;text-decoration:none;font-weight:700;">'
            f"{escape(action_label)}</a></p>"
        )

    footer = escape(outro or "If you need help, reply to this email and the InsightFlow team will assist you.")
    return f"""\
<!DOCTYPE html>
<html lang="en">
  <body style="margin:0;padding:0;background:#EEF2F7;font-family:'Plus Jakarta Sans',Arial,sans-serif;color:#1A2332;">
    <div style="padding:32px 16px;">
      <div style="max-width:620px;margin:0 auto;background:#ffffff;border:1px solid #E2E8F0;border-radius:24px;overflow:hidden;box-shadow:0 22px 60px rgba(0,0,0,.08);">
        <div style="padding:28px 32px;background:linear-gradient(135deg,#00355F 0%,#00457C 45%,#0079C1 100%);color:#ffffff;">
          <div style="display:inline-block;padding:7px 12px;border-radius:999px;background:rgba(255,255,255,.14);border:1px solid rgba(255,255,255,.18);font-size:11px;font-weight:700;letter-spacing:.12em;text-transform:uppercase;">{escape(eyebrow)}</div>
          <h1 style="margin:18px 0 8px;font-size:30px;line-height:1.1;letter-spacing:-.02em;">{escape(title)}</h1>
          <p style="margin:0;font-size:15px;line-height:1.65;color:rgba(255,255,255,.9);">{escape(intro)}</p>
        </div>
        <div style="padding:30px 32px;">
          {button_html}
          {'<p style="margin:0 0 14px;color:#475569;line-height:1.7;">Open this link in your browser if the button does not work:</p><p style="margin:0 0 18px;word-break:break-word;"><a href="' + escape(action_url, quote=True) + '" style="color:#0079C1;text-decoration:none;">' + escape(action_url) + '</a></p>' if action_url else ''}
          <div style="padding-top:18px;border-top:1px solid #F1F5F9;">
            <p style="margin:0;color:#64748B;font-size:13px;line-height:1.7;">{footer}</p>
          </div>
        </div>
      </div>
    </div>
  </body>
</html>
"""


def _send_email(*, to_email: str, subject: str, text_body: str, html_body: str) -> bool:
    if not _smtp_configured():
        return False

    message = EmailMessage()
    message["Subject"] = subject
    message["From"] = _sender_header()
    message["To"] = to_email
    configured_reply_to = (settings.EMAILS_FROM_EMAIL or "").strip()
    if configured_reply_to and configured_reply_to.lower() != _smtp_sender_email().lower():
        message["Reply-To"] = configured_reply_to
    message.set_content(text_body)
    message.add_alternative(html_body, subtype="html")

    try:
        if settings.SMTP_USE_SSL:
            server = smtplib.SMTP_SSL(
                settings.SMTP_HOST,
                settings.SMTP_PORT,
                timeout=settings.SMTP_TIMEOUT_SECONDS,
            )
        else:
            server = smtplib.SMTP(
                settings.SMTP_HOST,
                settings.SMTP_PORT,
                timeout=settings.SMTP_TIMEOUT_SECONDS,
            )

        with server:
            logger.info("Connecting to SMTP server %s:%s ssl=%s tls=%s", settings.SMTP_HOST, settings.SMTP_PORT, settings.SMTP_USE_SSL, settings.SMTP_USE_TLS)
            server.ehlo()
            if settings.SMTP_USE_TLS and not settings.SMTP_USE_SSL:
                logger.info("Starting SMTP TLS negotiation")
                server.starttls()
                server.ehlo()
            logger.info("Authenticating SMTP user %s", settings.SMTP_USER)
            server.login(settings.SMTP_USER, settings.SMTP_PASSWORD)
            logger.info("Sending email '%s' to %s", subject, to_email)
            server.send_message(message)
    except (smtplib.SMTPException, OSError, socket.timeout) as exc:
        logger.warning(
            "Failed to send email '%s' to %s via %s:%s (ssl=%s tls=%s): %s",
            subject,
            to_email,
            settings.SMTP_HOST,
            settings.SMTP_PORT,
            settings.SMTP_USE_SSL,
            settings.SMTP_USE_TLS,
            exc,
        )
        return False

    return True


def send_welcome_email(to_email: str, full_name: str | None = None) -> bool:
    display_name = full_name or "there"
    subject = "Welcome to InsightFlow"
    intro = (
        f"Hi {display_name}, your InsightFlow account is ready. "
        "You can now create surveys, collect responses, and generate AI-driven insights."
    )
    text_body = (
        f"Hi {display_name},\n\n"
        "Welcome to InsightFlow. Your account has been created successfully.\n\n"
        f"Open InsightFlow here: {settings.FRONTEND_APP_URL}\n\n"
        "You can now create surveys, collect responses, and generate reports.\n"
    )
    html_body = _brand_email_html(
        eyebrow="Welcome",
        title="Your InsightFlow account is ready",
        intro=intro,
        action_label="Open InsightFlow",
        action_url=settings.FRONTEND_APP_URL,
        outro="You are receiving this email because a new InsightFlow account was created with this address.",
    )
    return _send_email(to_email=to_email, subject=subject, text_body=text_body, html_body=html_body)


def send_password_reset_email(to_email: str, reset_link: str) -> bool:
    subject = "Reset your InsightFlow password"
    text_body = (
        "You requested a password reset.\n\n"
        f"Use this link to reset your password: {reset_link}\n\n"
        "If you did not request this, you can safely ignore this email."
    )
    html_body = _brand_email_html(
        eyebrow="Security",
        title="Reset your password",
        intro="We received a request to reset your InsightFlow password. Use the secure link below to continue.",
        action_label="Reset Password",
        action_url=reset_link,
        outro="If you did not request a password reset, no changes were made and you can ignore this email.",
    )
    return _send_email(to_email=to_email, subject=subject, text_body=text_body, html_body=html_body)


def send_workspace_invitation_email(
    to_email: str,
    *,
    workspace_name: str,
    role: str,
    inviter_name: str,
    app_link: str,
) -> bool:
    subject = f"You've been invited to {workspace_name} on InsightFlow"
    intro = (
        f"{inviter_name} added you to the workspace \"{workspace_name}\" as a {role.replace('_', ' ')}. "
        "Open InsightFlow to start collaborating with your team."
    )
    text_body = (
        f"Hi,\n\n"
        f"{inviter_name} invited you to join the workspace \"{workspace_name}\" on InsightFlow as a {role.replace('_', ' ')}.\n\n"
        f"Open the app here: {app_link}\n\n"
        "If you were not expecting this invitation, you can ignore this email.\n"
    )
    html_body = _brand_email_html(
        eyebrow="Workspace Invite",
        title=f"You're invited to {workspace_name}",
        intro=intro,
        action_label="Open InsightFlow",
        action_url=app_link,
        outro="You are receiving this email because your account was added to a workspace on InsightFlow.",
    )
    return _send_email(to_email=to_email, subject=subject, text_body=text_body, html_body=html_body)
