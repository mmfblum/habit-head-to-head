

# Fix Email Sign-Up

## The Problem

During earlier testing, **auto-confirm email** was enabled so test accounts could work instantly. This means:
- No confirmation emails are ever sent to new users
- Your account (mmfblum@gmail.com) already exists and is confirmed -- you just need to sign in, not sign up
- Any new signups are also auto-confirmed without email delivery

## The Fix

### Step 1: Disable auto-confirm emails

Turn off auto-confirm so that new users must verify their email before they can log in. This restores the confirmation email flow that the app already has UI for (the "Check Your Email" screen).

### Step 2: Handle the built-in email service limitations

The built-in email service has strict rate limits (about 3-4 emails per hour). For a production app, this means:
- A few signups per hour will work fine
- If you expect higher volume, you would need to configure a custom email provider (like Resend, SendGrid, or Mailgun) later

### What this means for you

- **Your existing account** (mmfblum@gmail.com): Already confirmed. Just sign in with your password on the published site.
- **New users signing up**: Will receive a confirmation email and must click the link before they can log in.
- **The "Check Your Email" screen**: Will work as designed, showing new users instructions to verify.

### Files changed

No code changes needed -- this is a backend configuration change only.

