import { expect, test, type Page } from "@playwright/test";

// L'API Go n'est pas lancée par Playwright : chaque scénario la simule avec `page.route`.

const saved = {
  id: "1",
  name: "Mamie",
  sex: "girl",
  birthDate: "2027-04-12",
  heightCm: 50,
  weightKg: 3.4,
  eyeColor: "hazel",
  firstName: "Zoé",
  createdAt: "2026-11-14T10:00:00Z",
};

async function fillPrediction(page: Page): Promise<void> {
  await page.getByTestId("prediction-name").fill("Mamie");
  await page.getByTestId("prediction-sex-girl").check();
  await page.getByTestId("prediction-birth-day").selectOption("12");
  await page.getByTestId("prediction-birth-month").selectOption({ label: "avril" });
  await page.getByTestId("prediction-height").fill("50");
  await page.getByTestId("prediction-weight").fill("3.4");
  await page.getByTestId("prediction-eye-hazel").check();
  await page.getByTestId("prediction-first-name").fill("Zoé");
}

test("tabs switch between the hunt and the predictions", async ({ page }) => {
  await page.goto("/");
  await page.getByTestId("tab-predictions").click();
  await expect(page).toHaveURL(/\/pronostics$/);
  await expect(page.getByTestId("prediction-submit")).toBeVisible();

  await page.goBack();
  await expect(page.getByTestId("step-padlock")).toBeVisible();
  await expect(page.getByTestId("tab-hunt")).toHaveAttribute("aria-current", "page");
});

test("sends a prediction and thanks the visitor", async ({ page }) => {
  let body: unknown = null;
  await page.route("**/api/predictions", async (route) => {
    body = route.request().postDataJSON();
    await route.fulfill({ status: 201, json: saved });
  });

  await page.goto("/pronostics");
  await fillPrediction(page);
  await page.getByTestId("prediction-submit").click();

  await expect(page.getByTestId("prediction-thanks")).toBeVisible();
  expect(body).toEqual({
    name: "Mamie",
    sex: "girl",
    birthDate: "2027-04-12",
    heightCm: 50,
    weightKg: 3.4,
    eyeColor: "hazel",
    firstName: "Zoé",
  });
});

test("shows the server message when a prediction is rejected", async ({ page }) => {
  await page.route("**/api/predictions", (route) =>
    route.fulfill({
      status: 400,
      json: { error: "Le prénom doit faire entre 1 et 40 caractères." },
    }),
  );

  await page.goto("/pronostics");
  await fillPrediction(page);
  await page.getByTestId("prediction-submit").click();

  await expect(page.getByTestId("prediction-error")).toHaveText(
    "Le prénom doit faire entre 1 et 40 caractères.",
  );
  await expect(page.getByTestId("prediction-first-name")).toHaveValue("Zoé");
});

test("admin logs in, lists and deletes predictions", async ({ page }) => {
  await page.route("**/api/admin/predictions", (route) => {
    const auth = route.request().headers()["authorization"];
    return auth === "Basic OnNlY3JldA=="
      ? route.fulfill({ json: [saved, { ...saved, id: "2", name: "Papi" }] })
      : route.fulfill({ status: 401, json: { error: "Mot de passe incorrect." } });
  });
  await page.route("**/api/admin/predictions/1", (route) => route.fulfill({ status: 204 }));
  page.on("dialog", (dialog) => void dialog.accept());

  await page.goto("/admin");
  await page.getByTestId("admin-password").fill("faux");
  await page.getByTestId("admin-login").click();
  await expect(page.getByTestId("admin-error")).toHaveText("Mot de passe incorrect.");

  await page.getByTestId("admin-password").fill("secret");
  await page.getByTestId("admin-login").click();
  await expect(page.getByTestId("admin-row")).toHaveCount(2);

  await page.getByTestId("admin-delete").first().click();
  await expect(page.getByTestId("admin-row")).toHaveCount(1);
  await expect(page.getByTestId("admin-table")).not.toContainText("Mamie");
});
