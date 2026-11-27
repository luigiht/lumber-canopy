import Link from 'next/link';
import type { Metadata } from 'next';
import styles from './page.module.css';

export const metadata: Metadata = {
  title: 'Privacy',
  description: 'What Lumber & Canopy collects (only what’s needed to save your game), why, and how to delete it.',
  alternates: { canonical: '/privacy' },
};

const LAST_UPDATED = '26 November 2026';

/*
 * Plain-language privacy notice. Keep it in step with what the game does (src/services/account,
 * supabase/schema.sql). Placeholders in [brackets] must be filled in, and the final wording
 * reviewed (GDPR / UK GDPR), before launch.
 */
export default function PrivacyPage() {
  return (
    <main className={styles.page}>
      <article className={styles.paper}>
        <h1>Privacy</h1>
        <p className={styles.meta}>Last updated: {LAST_UPDATED}</p>

        <p>
          Lumber &amp; Canopy only asks for what it needs to save your game. Here’s exactly what that is and what we do
          with it.
        </p>

        <h2>What we collect</h2>
        <ul>
          <li>
            <strong>Your name</strong>: whatever you tell us to call you in the game.
          </li>
          <li>
            <strong>Your email address</strong>: used as your sign-in.
          </li>
          <li>
            <strong>Your password</strong>: stored only as a secure hash by our sign-in provider. We never see it.
          </li>
          <li>
            <strong>Your game progress</strong>: your inventory, tools, cabin, plants and tutorial progress.
          </li>
        </ul>

        <h2>Why we collect it</h2>
        <p>
          Only to create your account and save your game, so you can sign in and carry on from any device. We don’t
          send marketing emails, and we don’t sell or share your email with anyone. The only emails you’ll get are
          account emails: confirming your address and resetting your password if you ask.
        </p>

        <h2>Where it’s stored</h2>
        <p>
          Accounts and saves are stored with Supabase, our database and sign-in provider, in the [region to be
          confirmed] region. Each player can only read and change their own data.
        </p>
        <p>
          Until online accounts are switched on, the game runs in offline mode: your account and saves stay in this
          browser on this device and are never sent anywhere. With online accounts, the game also keeps a copy of your
          latest save in your browser, so closing the tab never loses progress. Your display settings (brightness and
          text size) are kept in your browser too.
        </p>

        <h2>How long we keep it</h2>
        <p>
          Until you delete your account. [Any period after which inactive accounts are removed will be listed here.]
        </p>

        <h2>Your choices</h2>
        <ul>
          <li>
            <strong>Delete your account</strong>: in the game, open Settings (the gear), go to Account and choose
            “Delete account”. This permanently removes your account, your profile and all your progress.
          </li>
          <li>
            <strong>Questions or requests</strong>, including getting a copy of your data: contact us at [privacy
            contact email].
          </li>
        </ul>

        <p>
          <Link href="/">Back to the game</Link>
        </p>
      </article>
    </main>
  );
}
