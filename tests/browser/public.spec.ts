import { test, expect } from "@playwright/test";

const widths = [375,390,414,430,768,1024,1280,1440,1920];

test("public routes render without console errors or horizontal overflow", async ({ page }) => {
  test.setTimeout(300000);
  const errors: string[] = [];
  page.on("pageerror", error => errors.push(error.message));
  for (const route of ["/","/p/amaka","/how-it-works","/for-providers","/for-businesses","/explore","/pathfinder","/learn","/opportunities","/login","/signup","/terms","/privacy"]) {
    const response = await page.goto(route);
    expect(response?.status(), route).toBe(200);
    await expect(page.locator("h1").first()).toBeVisible();
    await expect(page.getByRole("heading", { name: /page not found/i })).toHaveCount(0);
    for (const width of widths) {
      await page.setViewportSize({ width, height: 900 });
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
      expect(overflow, route + " at " + width).toBe(false);
    }
  }
  expect(errors).toEqual([]);
});

test("public transaction IDs have no sample fallback and use the required missing-record screen", async ({ page }) => {
  for (const publicId of ["sample-website-project", "aaaaaaaaaaaaaaaaaaaaaaaa"]) {
    await page.goto("/j/" + publicId);
    await expect(page.getByRole("heading", { name: "Transaction Record Not Found", exact: true })).toBeVisible();
    await expect(page).toHaveTitle(/Transaction Record Not Found/);
  }
});

test("route handlers and the global missing route fail safely", async ({ page }) => {
  await page.goto("/auth/confirm");
  await expect(page).toHaveURL(/\/login\?confirmation=failed$/);
  const response = await page.goto("/route-that-does-not-exist");
  expect(response?.status()).toBe(404);
  await expect(page.getByRole("heading", { name: "Page not found.", exact: true })).toBeVisible();
});

test("simulator uses the same record and updates entered terms", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("link", { name: /view an example/i })).toHaveAttribute("href", "#preview");
  const preview = page.locator("#preview");
  await preview.getByLabel("Service", { exact: true }).fill("Solar installation");
  await preview.getByLabel("Fee (NGN)").fill("250000");
  await expect(preview.locator("article")).toContainText("Solar installation");
  await expect(preview.locator("article")).toContainText("250,000");
  await expect(preview.getByText("Nothing here is saved or published.", { exact: false })).toBeVisible();
});

test("mobile menu, keyboard dialog, example preview and auth guards", async ({ page, context }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await page.getByRole("button", { name: "Toggle navigation menu" }).click();
  await expect(page.locator("#mobile-navigation")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.locator("#mobile-navigation")).not.toBeVisible();
  await page.goto("/explore");
  await page.getByRole("button", { name: /details|explore|view/i }).first().click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).not.toBeVisible();
  await page.goto("/#preview");
  await expect(page.getByText("Live example preview", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: /accept/i })).toHaveCount(0);
  await context.addCookies([{ name: "tl_session_token", value: Buffer.from("usr_amaka_okafor:amaka@example.com:amaka:ADMIN").toString("base64"), domain: "127.0.0.1", path: "/" }]);
  for (const route of ["/dashboard","/dashboard/jobs/new","/admin","/admin/events"]) {
    await page.goto(route);
    await expect(page).toHaveURL(/\/login$/);
  }
});

test("missing auth configuration is honest and examples remain filterable", async ({ page }) => {
  await page.goto("/login");
  await page.getByLabel("Email address").fill("person@example.com");
  await page.getByLabel(/password/i).fill("not-a-real-password");
  await page.getByRole("button", { name: /log in/i }).click();
  await expect(page.locator("main").getByRole("alert")).toContainText("not configured");
  await page.goto("/opportunities");
  await page.getByLabel("Search examples").fill("no matching record 91827");
  await expect(page.getByText("No examples match these filters.", { exact: false })).toBeVisible();
});

test("interrupted account submissions show an error and can be retried", async ({ page }) => {
  for (const route of ["/login","/signup"]) {
    await page.goto(route);
    await page.route("**/*", async request => request.request().method() === "POST" ? request.abort("failed") : request.continue());
    if (route === "/signup") await page.getByLabel("Full name or business name").fill("Test Provider");
    await page.getByLabel("Email address").fill("person@example.test");
    await page.getByLabel(/password/i).fill("test-password-only");
    const button = page.getByRole("button", { name: route === "/login" ? /log in to/i : /get started free/i });
    await button.click();
    await expect(page.locator("main").getByRole("alert")).toContainText("Connection interrupted");
    await expect(button).toBeEnabled();
    await page.unrouteAll();
  }
});

test("capture desktop and mobile product surfaces", async ({ page }) => {
  for (const [name,route] of [["home","/"],["record-preview","/#preview"],["profile","/p/amaka"],["how-it-works","/how-it-works"],["for-providers","/for-providers"],["for-businesses","/for-businesses"],["explore","/explore"],["login","/login"],["signup","/signup"]]) {
    for (const width of [390,1440]) {
      await page.setViewportSize({ width, height: 1000 });
      await page.goto(route);
      await page.screenshot({ path: "test-results/" + name + "-" + width + ".png", fullPage: true, caret: "initial" });
    }
  }
});
