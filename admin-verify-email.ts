import { initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';

async function verifyEmails() {
  console.log("Initializing firebase-admin...");
  initializeApp({
    projectId: "gen-lang-client-0597692683"
  });

  const auth = getAuth();
  const emails = [
    "your-admin-email@example.com",
    "jessescaledyou_test@gmail.com",
    "jessescaledyou@gmail.com"
  ];

  for (const email of emails) {
    try {
      console.log(`Searching for Auth user: ${email}...`);
      const userRecord = await auth.getUserByEmail(email);
      console.log(`Found user: ${userRecord.uid}. Current email_verified: ${userRecord.emailVerified}`);
      
      if (!userRecord.emailVerified) {
        console.log("Updating emailVerified to true...");
        await auth.updateUser(userRecord.uid, {
          emailVerified: true
        });
        console.log(`-> SUCCESS! Email ${email} is now officially VERIFIED!`);
      } else {
        console.log(`-> Already verified.`);
      }
    } catch (err: any) {
      console.error(`-> FAILED for ${email}:`, err.message || err);
    }
  }
}

verifyEmails();
