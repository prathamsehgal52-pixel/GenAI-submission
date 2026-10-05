import { betterAuth } from 'better-auth'
import { drizzleAdapter } from 'better-auth/adapters/drizzle'
import { config } from './config'
import { db, schema } from './db/client'
import { deleteUserData } from './services/account'
import { esc, layout, sendEmail } from './services/email'

/**
 * Email + password authentication with database sessions (httpOnly, Secure in
 * production, SameSite=Lax cookies). Passwords are hashed by Better Auth
 * (scrypt); plaintext is never stored.
 */
export const auth = betterAuth({
  appName: 'Armoire',
  baseURL: config.APP_URL,
  basePath: '/api/auth',
  secret: config.AUTH_SECRET,
  trustedOrigins: [config.APP_URL],
  database: drizzleAdapter(db, {
    provider: 'pg',
    schema: { user: schema.user, session: schema.session, account: schema.account, verification: schema.verification },
  }),
  emailAndPassword: {
    enabled: true,
    minPasswordLength: 10,
    maxPasswordLength: 128,
    autoSignIn: true,
    revokeSessionsOnPasswordReset: true,
    resetPasswordTokenExpiresIn: 60 * 60,
    sendResetPassword: async ({ user, url }) => {
      await sendEmail({
        to: user.email,
        subject: 'Reset your Armoire password',
        text: `Use this link to choose a new password. It expires in one hour.\n\n${url}\n\nIf you didn't ask for this, you can ignore this email.`,
        html: layout(
          'Reset your password',
          `<p style="font-size:15px;line-height:1.5;color:#55595e">Hi ${esc(user.name)}, use the button below to choose a new password. The link expires in one hour.</p><p style="font-size:13px;color:#8b9096">If you didn't ask for this, you can ignore this email.</p>`,
          { label: 'Choose a new password', url },
        ),
      })
    },
  },
  session: {
    expiresIn: 60 * 60 * 24 * 30,
    updateAge: 60 * 60 * 24,
  },
  user: {
    deleteUser: {
      enabled: true,
      beforeDelete: async (u) => {
        await deleteUserData(u.id)
      },
    },
  },
  rateLimit: {
    enabled: config.APP_ENV !== 'test',
    window: 60,
    max: 30,
    customRules: {
      '/sign-in/email': { window: 60, max: 8 },
      '/sign-up/email': { window: 60, max: 5 },
      '/request-password-reset': { window: 300, max: 3 },
    },
  },
  advanced: {
    useSecureCookies: config.APP_ENV === 'production',
    database: { generateId: () => crypto.randomUUID() },
    ipAddress: { ipAddressHeaders: ['x-armoire-client-ip'] },
  },
  telemetry: { enabled: false },
})

export type Session = typeof auth.$Infer.Session
