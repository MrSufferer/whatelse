// Run via playwright-cli run-code --filename after installing browser-wallet.js.
// Local Anvil, migrated dedicated PostgreSQL, and production Next server required.
async (page) => {
  const name = `Browser Reviewed Fixture ${Date.now()}`;
  const launcher = "0x70997970C51812dc3A010C7d01b50e0d17dc79C8";
  const participant = "0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC";
  const login = async (index) => {
    await page.evaluate((i) => window.__issue32Wallet.setAccount(i), index);
    await page
      .getByRole("button", { name: "Sign in with wallet", exact: true })
      .click();
  };
  const canonical = async () =>
    page
      .getByText(
        "Canonical receipt recorded. Review history is preserved; inclusion is provisional.",
        { exact: true },
      )
      .waitFor();
  await page.getByRole("link", { name: "Proposal", exact: true }).click();
  await login(1);
  await page.getByLabel("Token name (required)", { exact: true }).fill(name);
  await page.getByLabel("Symbol (required)", { exact: true }).fill("BTEST");
  await page
    .getByLabel("Community links (HTTPS, one per line)")
    .fill("https://example.com/browser-community");
  await page
    .getByRole("button", { name: "Submit for review", exact: true })
    .click();
  await page
    .getByText("Proposal saved for operator review.", { exact: true })
    .waitFor();
  await page.getByRole("link", { name: "Operator", exact: true }).click();
  await login(0);
  await page
    .getByLabel("Reason (required)")
    .fill("Reviewed fictional browser fixture");
  await page
    .getByLabel("Review source (required)")
    .fill("Issue 53 local browser walkthrough");
  await page.getByLabel("Wallet (required)", { exact: true }).fill(participant);
  await page
    .getByRole("button", { name: "Approve / invite participant", exact: true })
    .click();
  await page
    .getByText("Participant admission saved.", { exact: true })
    .waitFor();
  await page.getByLabel("Wallet (required)", { exact: true }).fill(launcher);
  await page
    .getByRole("combobox", { name: "Role", exact: true })
    .selectOption("launcher");
  await page
    .getByRole("button", { name: "Approve / invite launcher", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Review and sign in wallet", exact: true })
    .click();
  await canonical();
  const article = page
    .getByRole("article")
    .filter({
      has: page.getByRole("heading", { name: `${name} / BTEST`, exact: true }),
    });
  await article
    .getByRole("button", { name: "approve proposal", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Review and sign in wallet", exact: true })
    .click();
  await canonical();
  await page.getByRole("link", { name: "Proposal", exact: true }).click();
  await login(1);
  const mine = page
    .getByRole("article")
    .filter({
      has: page.getByRole("heading", { name: `${name} / BTEST`, exact: true }),
    });
  await mine
    .getByRole("link", { name: "Create reviewed Launch", exact: true })
    .click();
  await page
    .getByText("Approved proposal matches your wallet and form.", {
      exact: true,
    })
    .waitFor();
  await page.evaluate(() => window.__issue32Wallet.rejectNextTransaction());
  await page
    .getByRole("button", { name: "Create zero-supply token", exact: true })
    .click();
  await page.getByText(/Creation not completed:/).waitFor();
  await page
    .getByRole("button", { name: "Create zero-supply token", exact: true })
    .click();
  await page.waitForURL(/\/token\/31337\//);
  await page.getByRole("heading", { name, exact: true }).waitFor();
  await page
    .getByRole("heading", { name: `${name} / BTEST`, exact: true })
    .waitFor();
  await page
    .getByRole("link", {
      name: "https://example.com/browser-community",
      exact: true,
    })
    .waitFor();
  const createdUrl = page.url();
  await page.screenshot({
    path: "output/playwright/issue53/reviewed-detail.png",
    fullPage: true,
  });
  await page.getByRole("link", { name: "Explore", exact: true }).click();
  await login(2);
  await page
    .getByRole("heading", { name: "Registered launches", exact: true })
    .waitFor();
  if (
    await page
      .getByRole("heading", { name: "Admission required", exact: true })
      .count()
  )
    throw Error("invited Participant blocked");
  // A deleted/expired session must remove previously cached authorization.
  await page.evaluate(() => fetch("/api/beta/session", { method: "DELETE" }));
  await page
    .getByRole("heading", {
      name: "Sign in to the Controlled Beta",
      exact: true,
    })
    .waitFor({ timeout: 25000 });
  await page
    .getByRole("button", { name: "Sign in with wallet", exact: true })
    .click();
  await page.getByRole("link", { name: "Operator", exact: true }).click();
  await login(0);
  await page
    .getByLabel("Reason (required)")
    .fill("Revoke browser Participant interface admission");
  await page
    .getByLabel("Review source (required)")
    .fill("Issue 53 local browser walkthrough");
  await page.getByLabel("Wallet (required)", { exact: true }).fill(participant);
  await page
    .getByRole("combobox", { name: "Role", exact: true })
    .selectOption("participant");
  await page
    .getByRole("button", { name: "Revoke participant admission", exact: true })
    .click();
  await page
    .getByText("Participant admission saved.", { exact: true })
    .waitFor();
  await page.getByRole("link", { name: "Explore", exact: true }).click();
  await login(2);
  await page
    .getByRole("heading", { name: "Admission required", exact: true })
    .waitFor();
  await page.screenshot({
    path: "output/playwright/issue53/revoked-participant.png",
    fullPage: true,
  });
  await page.goto(createdUrl);
  await page.getByRole("heading", { name, exact: true }).waitFor();
  await page
    .getByRole("link", {
      name: "https://example.com/browser-community",
      exact: true,
    })
    .waitFor();
  for (const width of [375, 768, 1280]) {
    await page.setViewportSize({ width, height: 900 });
    if (
      await page.evaluate(
        () => document.documentElement.scrollWidth > innerWidth,
      )
    )
      throw Error(`overflow at ${width}`);
  }
  return {
    name,
    createdUrl,
    proposalReviewed: true,
    launcherApproved: true,
    participantInvited: true,
    cancelledCreationRecovered: true,
    cachedSessionDeleted: true,
    participantRevoked: true,
    publicDetailPreserved: true,
    responsiveWidths: [375, 768, 1280],
  };
};
