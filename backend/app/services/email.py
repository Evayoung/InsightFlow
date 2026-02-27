import smtplib
from email.mime.text import MIMEText

from app.core.config import settings


def send_password_reset_email(to_email: str, reset_link: str) -> bool:
    if not settings.SMTP_HOST or not settings.SMTP_USER or not settings.SMTP_PASSWORD or not settings.EMAILS_FROM_EMAIL:
        return False

    subject = "InsightFlow Password Reset"
    body = (
        "You requested a password reset.\n\n"
        f"Use this link to reset your password: {reset_link}\n\n"
        "If you did not request this, ignore this email."
    )

    message = MIMEText(body)
    message["Subject"] = subject
    message["From"] = settings.EMAILS_FROM_EMAIL
    message["To"] = to_email

    with smtplib.SMTP(settings.SMTP_HOST, settings.SMTP_PORT) as server:
        server.starttls()
        server.login(settings.SMTP_USER, settings.SMTP_PASSWORD)
        server.sendmail(settings.EMAILS_FROM_EMAIL, [to_email], message.as_string())

    return True

