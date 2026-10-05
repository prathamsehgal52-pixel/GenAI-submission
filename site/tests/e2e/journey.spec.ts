import { expect, test } from '@playwright/test'
import path from 'node:path'

const FIX = path.resolve('tests/fixtures')

/**
 * The main product journey, end to end in a real browser:
 * sign up → onboarding → upload → review/edit → wardrobe → style → save
 * → discover → save product → sign out → sign back in → data persisted.
 *
 * External services: the AI and product sources are the explicit test
 * fixtures configured in .env.e2e (APP_ENV=test). Database, storage, auth,
 * the background worker and the web app are the real implementations.
 */
test('a new user builds a wardrobe, gets styled and saves a find', async ({ page }, info) => {
  const email = `journey-${info.project.name}-${Date.now()}@example.com`
  const password = 'correct horse battery staple'

  // 1. Landing → sign up
  await page.goto('/')
  await page.getByRole('button', { name: 'Build my wardrobe' }).first().click()
  await expect(page).toHaveURL(/\/signup$/)
  await page.getByLabel('Your name').fill('Jamie Rivera')
  await page.getByLabel('Email').fill(email)
  await page.getByLabel('Password').fill(password)
  await page.getByRole('button', { name: 'Create account' }).click()

  // 2. Onboarding
  await expect(page).toHaveURL(/\/onboarding$/)
  const cont = page.getByRole('button', { name: 'Continue' })
  await expect(cont).toBeDisabled()
  await page.getByRole('checkbox').check()
  await cont.click()
  await page.getByRole('button', { name: 'Minimal' }).click()
  await cont.click()
  await cont.click() // colours: keep defaults
  await page.getByRole('button', { name: 'Weekend' }).click()
  await cont.click()
  await page.getByRole('button', { name: 'Womenswear' }).click()
  await cont.click()
  await page.getByRole('button', { name: 'Start my wardrobe' }).click()

  // 3. Upload photos (dialog opens automatically after onboarding)
  await expect(page).toHaveURL(/\/app\/wardrobe/)
  await expect(page.getByRole('heading', { name: 'Add clothes' })).toBeVisible()
  await page.getByLabel('Choose photos to upload').setInputFiles(['white-top.jpg', 'grey-top.jpg', 'navy-bottom.jpg', 'black-bottom.jpg', 'brown-shoes.jpg'].map((f) => path.join(FIX, f)))
  await expect(page.getByText('5 of 5 uploaded')).toBeVisible({ timeout: 30_000 })

  // 4. Review recognised garments (processed asynchronously by the worker)
  await page.getByRole('link', { name: 'Review pieces' }).click()
  await expect(page).toHaveURL(/\/app\/wardrobe\/review/)
  await expect(page.locator('article select[id^=cat-]')).toHaveCount(5, { timeout: 30_000 })
  // Edit one detected garment before accepting it.
  const first = page.locator('article').first()
  await first.getByLabel('Name').fill('Favourite tee')
  await first.getByRole('button', { name: 'Add to wardrobe' }).click()
  await expect(page.locator('article select[id^=cat-]')).toHaveCount(4)
  await page.getByRole('button', { name: /Add all 4 as detected/ }).click()
  await expect(page.getByText('All caught up')).toBeVisible()

  // 5. Wardrobe shows all five pieces, including the edited one
  await page.goto('/app/wardrobe')
  await expect(page.getByText('5 pieces', { exact: true })).toBeVisible()
  await expect(page.getByText('Favourite tee')).toBeVisible()
  await page.getByRole('button', { name: /^Bottoms/ }).click()
  await expect(page.locator('article')).toHaveCount(2)

  // 6–7. Generate and save an outfit
  await page.goto('/app/style')
  await page.getByRole('radiogroup', { name: 'Occasion' }).getByRole('button', { name: 'Weekend' }).click()
  await page.getByRole('button', { name: 'Style me', exact: true }).last().click()
  const look = page.locator('article').filter({ has: page.getByRole('button', { name: 'Save look' }) }).first()
  await expect(look).toBeVisible({ timeout: 30_000 })
  await expect(look.getByText('Pieces from your wardrobe')).toBeVisible()
  await look.getByRole('button', { name: 'Save look' }).click()
  await expect(page.getByText('Saved to your looks.')).toBeVisible()

  // 8–9. Discover a product and save it
  await page.goto('/app/discover')
  await page.getByRole('button', { name: /Refresh finds/ }).first().click()
  const find = page.locator('article').filter({ hasText: 'Test catalogue' }).first()
  await expect(find).toBeVisible({ timeout: 45_000 })
  await expect(find.getByText(/Pairs with \d+ of your pieces/)).toBeVisible()
  await expect(find.getByRole('link', { name: /View at/ })).toHaveAttribute('href', /^https:\/\//)
  await find.getByRole('button', { name: 'Save' }).click()
  await expect(page.getByText('Saved.')).toBeVisible()

  // 10. Sign out, sign back in, and find everything persisted
  await page.context().clearCookies()
  await page.goto('/signin?next=/app/looks')
  await page.getByLabel('Email').fill(email)
  await page.getByLabel('Password').fill(password)
  await page.getByRole('button', { name: 'Sign in' }).click()
  await expect(page).toHaveURL(/\/app\/looks$/)
  await expect(page.getByText('1 saved', { exact: true })).toBeVisible()
  await page.goto('/app/discover')
  await page.getByRole('tab', { name: 'Saved' }).click()
  await expect(page.locator('article').filter({ hasText: 'Test catalogue' })).toHaveCount(1)
  await page.goto('/app/wardrobe')
  await expect(page.getByText('5 pieces', { exact: true })).toBeVisible()
})

test('signed-out visitors are sent to sign in', async ({ page }) => {
  await page.goto('/app/wardrobe')
  await expect(page).toHaveURL(/\/signin\?next=%2Fapp%2Fwardrobe/)
})
