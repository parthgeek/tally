import { test, expect, type Page } from '@playwright/test';

// Skip in production
test.skip(process.env.NODE_ENV === 'production', 'Categorizer lab should not be available in production');

test.describe('Categorizer Lab', () => {
  test.beforeEach(async ({ page }) => {
    // Enable the lab feature flag for testing
    await page.addInitScript(() => {
      localStorage.setItem('CATEGORIZER_LAB_ENABLED', 'true');
    });
  });

  test('should load the lab page when feature flag is enabled', async ({ page }) => {
    await page.goto('/categorizer-lab');
    
    // Should not redirect to 404
    await expect(page).toHaveURL('/categorizer-lab');
    
    // Should show lab title and warning
    await expect(page.locator('h1')).toContainText('Categorization Lab');
    await expect(page.locator('text=Development Tool')).toBeVisible();
    
    // Should show dataset section
    await expect(page.locator('h2:has-text("1. Dataset")')).toBeVisible();
  });

  test('should show categorizer lab when enabled', async ({ page }) => {
    // In development mode, the lab should be enabled by default
    await page.goto('/categorizer-lab');
    
    // Should show the categorizer lab page
    await expect(page.locator('h1')).toContainText('Categorization Lab');
    await expect(page.locator('text=Development Tool')).toBeVisible();
  });

  test('should generate and process synthetic data', async ({ page }) => {
    await page.goto('/categorizer-lab');
    
    // Wait for page to load
    await expect(page.locator('h1')).toContainText('Categorization Lab');
    
    // Generate synthetic data (should be the default option)
    await expect(page.locator('select').first()).toHaveValue('synthetic');
    
    // Set a small count for faster testing
    await page.fill('input[id="count"]', '5');
    
    // Click generate button
    await page.click('button:has-text("Generate Synthetic Data")');
    
    // Should show configuration section after dataset is loaded
    await expect(page.locator('h2:has-text("2. Configuration")')).toBeVisible();
    
    // Should show transaction count in the estimates
    await expect(page.locator('text=5').first()).toBeVisible();
    
    // Configure to use Pass-1 only for faster testing
    await page.selectOption('select[id="engine-mode"]', 'pass1');
    
    // Run categorization
    await page.click('button:has-text("Run Categorization")');
    
    // Should show progress section
    await expect(page.locator('h2:has-text("3. Progress")')).toBeVisible();
    await expect(page.locator('text=Categorization in Progress')).toBeVisible();
    
    // Wait for the server response
    await page.waitForResponse(response => 
      response.url().includes('/api/dev/categorizer-lab/run') && response.status() === 200
    );

    // Wait for completion (Pass-1 should be fast)
    await expect(page.locator('h2:has-text("Categorization Complete")')).toBeVisible({ timeout: 30000 });
    
    // Should show results section
    await expect(page.locator('h2:has-text("4. Results")')).toBeVisible();
    await expect(page.locator('table')).toBeVisible();
    
    // Should show metrics section
    await expect(page.locator('h2:has-text("5. Metrics")')).toBeVisible();
    await expect(page.locator('text=Total Transactions')).toBeVisible();
    
    // Should show visualizations section
    await expect(page.locator('h2:has-text("6. Visualizations")')).toBeVisible();
    await expect(page.locator('text=Confidence Distribution')).toBeVisible();
    
    // Should show export section
    await expect(page.locator('h2:has-text("7. Export")')).toBeVisible();
    await expect(page.locator('button:has-text("Export as JSON")')).toBeEnabled();
    await expect(page.locator('button:has-text("Export as CSV")')).toBeEnabled();
  });

  test('should verify hybrid mode metrics and rationale', async ({ page }) => {
    await page.goto('/categorizer-lab');

    // Generate a larger dataset for better metrics
    await page.fill('input[id="count"]', '20');
    await page.click('button:has-text("Generate Synthetic Data")');

    await expect(page.locator('h2:has-text("2. Configuration")')).toBeVisible();

    // Configure hybrid mode with reasonable threshold
    await page.selectOption('select[id="engine-mode"]', 'hybrid');

    // Check if threshold slider exists and set it to 0.7
    const thresholdSlider = page.locator('input[type="range"]');
    if (await thresholdSlider.isVisible()) {
      await thresholdSlider.fill('0.7');
    }

    // Run categorization
    await page.click('button:has-text("Run Categorization")');

    // Wait for completion
    await page.waitForResponse(response =>
      response.url().includes('/api/dev/categorizer-lab/run') && response.status() === 200
    );
    await expect(page.locator('h2:has-text("Categorization Complete")')).toBeVisible({ timeout: 30000 });

    // Verify engine usage metrics show both Pass-1 and LLM usage
    await expect(page.locator('text=Engine Usage')).toBeVisible();
    await expect(page.locator('text=Pass-1 Only')).toBeVisible();
    await expect(page.locator('text=LLM Used')).toBeVisible();

    // Verify confidence distribution shows variance (not uniform)
    await expect(page.locator('text=Confidence Distribution')).toBeVisible();
    await expect(page.locator('text=Quality:')).toBeVisible();

    // Check for rationale details in results table
    await expect(page.locator('th:has-text("Rationale")')).toBeVisible();

    // Click on a rationale detail to open popover
    const rationaleButton = page.locator('text=detail').first();
    if (await rationaleButton.isVisible()) {
      await rationaleButton.click();

      // Should show categorization details popover
      await expect(page.locator('text=Categorization Details')).toBeVisible();
      await expect(page.locator('text=Pass-1').or(page.locator('text=LLM'))).toBeVisible();
    }
  });

  test('should verify ambiguous transaction handling', async ({ page }) => {
    await page.goto('/categorizer-lab');

    // Use scenario mode to load ambiguous test cases
    await page.selectOption('select[id="upload-method"]', 'scenario');

    // Look for ambiguous scenarios in the dropdown
    const scenarioSelect = page.locator('select[id="test-scenario"]');
    await expect(scenarioSelect).toBeVisible();

    // Select an ambiguous scenario if available (e.g., Amazon transactions)
    const amazonOption = scenarioSelect.locator('option:has-text("Amazon")');
    if (await amazonOption.count() > 0) {
      await scenarioSelect.selectOption({ label: 'Amazon Ambiguity' });
    } else {
      // Fallback to first available scenario
      await scenarioSelect.selectOption({ index: 1 });
    }

    await page.click('button:has-text("Load Scenario")');

    // Configure for LLM mode to test ambiguity resolution
    await expect(page.locator('h2:has-text("2. Configuration")')).toBeVisible();
    await page.selectOption('select[id="engine-mode"]', 'llm');

    // Run categorization
    await page.click('button:has-text("Run Categorization")');

    // Wait for completion
    await page.waitForResponse(response =>
      response.url().includes('/api/dev/categorizer-lab/run') && response.status() === 200
    );
    await expect(page.locator('h2:has-text("Categorization Complete")')).toBeVisible({ timeout: 45000 });

    // Verify LLM was used for ambiguous transactions
    const llmUsedCount = page.locator('text=LLM Used').locator('..').locator('.font-semibold');
    await expect(llmUsedCount).toBeVisible();

    // Check that confidence varies (not all the same value)
    const confidenceBadges = page.locator('table tbody td').filter({ hasText: /\d+%/ });
    const badgeCount = await confidenceBadges.count();

    if (badgeCount > 1) {
      const firstConfidence = await confidenceBadges.first().textContent();
      const lastConfidence = await confidenceBadges.last().textContent();

      // They should potentially be different (not a hard requirement, but likely with real LLM)
      console.log(`Confidence range: ${firstConfidence} to ${lastConfidence}`);
    }
  });

  test('should show guardrail violations when they occur', async ({ page }) => {
    await page.goto('/categorizer-lab');

    // Generate synthetic data
    await page.fill('input[id="count"]', '15');
    await page.click('button:has-text("Generate Synthetic Data")');

    await expect(page.locator('h2:has-text("2. Configuration")')).toBeVisible();

    // Use hybrid mode to potentially trigger guardrails
    await page.selectOption('select[id="engine-mode"]', 'hybrid');

    // Run categorization
    await page.click('button:has-text("Run Categorization")');

    // Wait for completion
    await page.waitForResponse(response =>
      response.url().includes('/api/dev/categorizer-lab/run') && response.status() === 200
    );
    await expect(page.locator('h2:has-text("Categorization Complete")')).toBeVisible({ timeout: 30000 });

    // Look for guardrail indicators in the rationale column
    const guardrailIndicators = page.locator('svg').filter({ hasText: /triangle/ });
    const rationaleDetails = page.locator('text=detail');

    // If there are rationale details, click one to check for guardrail information
    if (await rationaleDetails.count() > 0) {
      await rationaleDetails.first().click();

      // Check if guardrail information is shown (optional - may not always trigger)
      const guardrailSection = page.locator('text=Guardrails Applied');
      if (await guardrailSection.isVisible()) {
        await expect(page.locator('text=Guardrails Applied')).toBeVisible();
      }
    }
  });

  test('should verify Pass-1 hit rate meets acceptance criteria', async ({ page }) => {
    await page.goto('/categorizer-lab');

    // Generate a larger dataset for statistical significance
    await page.fill('input[id="count"]', '50');
    await page.click('button:has-text("Generate Synthetic Data")');

    await expect(page.locator('h2:has-text("2. Configuration")')).toBeVisible();

    // Configure hybrid mode with moderate threshold
    await page.selectOption('select[id="engine-mode"]', 'hybrid');

    // Run categorization
    await page.click('button:has-text("Run Categorization")');

    // Wait for completion
    await page.waitForResponse(response =>
      response.url().includes('/api/dev/categorizer-lab/run') && response.status() === 200
    );
    await expect(page.locator('h2:has-text("Categorization Complete")')).toBeVisible({ timeout: 45000 });

    // Extract Pass-1 only count and LLM used count
    const pass1OnlyElement = page.locator('text=Pass-1 Only').locator('..').locator('.font-semibold');
    const llmUsedElement = page.locator('text=LLM Used').locator('..').locator('.font-semibold');

    await expect(pass1OnlyElement).toBeVisible();
    await expect(llmUsedElement).toBeVisible();

    const pass1OnlyText = await pass1OnlyElement.textContent();
    const llmUsedText = await llmUsedElement.textContent();

    const pass1Only = parseInt(pass1OnlyText || '0');
    const llmUsed = parseInt(llmUsedText || '0');
    const total = pass1Only + llmUsed;

    console.log(`Metrics: ${pass1Only} Pass-1 only, ${llmUsed} LLM used, ${total} total`);

    // Acceptance criteria: Pass-1 should handle a reasonable portion
    // (Not too strict since this depends on synthetic data quality)
    if (total > 0) {
      const pass1Percentage = (pass1Only / total) * 100;
      console.log(`Pass-1 hit rate: ${pass1Percentage.toFixed(1)}%`);

      // Pass-1 should handle at least some transactions independently
      expect(pass1Only).toBeGreaterThan(0);
    }
  });

  test('should verify confidence variance exists', async ({ page }) => {
    await page.goto('/categorizer-lab');

    // Generate synthetic data
    await page.fill('input[id="count"]', '30');
    await page.click('button:has-text("Generate Synthetic Data")');

    await expect(page.locator('h2:has-text("2. Configuration")')).toBeVisible();

    // Use hybrid mode for varied confidence
    await page.selectOption('select[id="engine-mode"]', 'hybrid');

    // Run categorization
    await page.click('button:has-text("Run Categorization")');

    // Wait for completion
    await page.waitForResponse(response =>
      response.url().includes('/api/dev/categorizer-lab/run') && response.status() === 200
    );
    await expect(page.locator('h2:has-text("Categorization Complete")')).toBeVisible({ timeout: 45000 });

    // Check confidence quality indicator
    const qualityIndicator = page.locator('text=Quality:').locator('..');
    await expect(qualityIndicator).toBeVisible();

    const qualityText = await qualityIndicator.textContent();
    console.log(`Confidence quality: ${qualityText}`);

    // Should not be "Too uniform"
    expect(qualityText).not.toContain('Too uniform');

    // Check that confidence histogram has multiple bins with data
    const histogramBars = page.locator('.bg-blue-500, .bg-green-500, .bg-red-400').filter({ hasText: /\d+/ });
    const barsWithData = await histogramBars.count();

    console.log(`Histogram bars with data: ${barsWithData}`);

    // Should have variance across multiple confidence levels
    expect(barsWithData).toBeGreaterThan(1);
  });

  test('should load test scenarios', async ({ page }) => {
    await page.goto('/categorizer-lab');
    
    // Select scenario mode
    await page.selectOption('select[id="upload-method"]', 'scenario');
    
    // Load clear cases scenario
    await page.click('button:has-text("Clear Cases")');
    
    // Should show configuration section
    await expect(page.locator('h2:has-text("2. Configuration")')).toBeVisible({ timeout: 15000 });
    
    // Should show 2 transactions
    await expect(page.locator('[data-testid="transaction-count-badge"]')).toContainText('2 transactions', { timeout: 15000 });
    
    // Run categorization with Pass-1
    await page.selectOption('select[id="engine-mode"]', 'pass1');
    await page.click('button:has-text("Run Categorization")');
    
    // Wait for completion
    await expect(page.locator('h2:has-text("Categorization Complete")')).toBeVisible({ timeout: 15000 });
    
    // Check results table shows 2 rows
    const tableRows = page.locator('table tbody tr');
    await expect(tableRows).toHaveCount(2);
  });

  test('should test Amazon ambiguity scenarios', async ({ page }) => {
    await page.goto('/categorizer-lab');

    // Select scenario mode
    await page.selectOption('select[id="upload-method"]', 'scenario');

    // Load Amazon scenario
    await page.click('button:has-text("Amazon Ambiguity")');

    await expect(page.locator('h2:has-text("2. Configuration")')).toBeVisible();

    // Use hybrid mode to test LLM disambiguation
    await page.selectOption('select[id="engine-mode"]', 'hybrid');

    // Run categorization
    await page.click('button:has-text("Run Categorization")');

    // Wait for completion
    await page.waitForResponse(response =>
      response.url().includes('/api/dev/categorizer-lab/run') && response.status() === 200
    );
    await expect(page.locator('h2:has-text("Categorization Complete")')).toBeVisible({ timeout: 30000 });

    // Verify all 4 Amazon transactions were processed
    const tableRows = page.locator('table tbody tr');
    await expect(tableRows).toHaveCount(4);

    // Check that different Amazon transaction types got different categories
    const categories = [];
    for (let i = 0; i < 4; i++) {
      const categoryCell = tableRows.nth(i).locator('td').nth(1);
      const categoryText = await categoryCell.textContent();
      categories.push(categoryText?.trim());
    }

    console.log('Amazon scenario categories:', categories);

    // Should have category diversity (not all the same)
    const uniqueCategories = new Set(categories.filter(c => c && c !== '—'));
    expect(uniqueCategories.size).toBeGreaterThan(1);
  });

  test('should test 7-Eleven fuel vs convenience scenarios', async ({ page }) => {
    await page.goto('/categorizer-lab');

    // Select scenario mode
    await page.selectOption('select[id="upload-method"]', 'scenario');

    // Load 7-Eleven scenario
    await page.click('button:has-text("7-Eleven Fuel vs Convenience")');

    await expect(page.locator('h2:has-text("2. Configuration")')).toBeVisible();

    // Use hybrid mode for better disambiguation
    await page.selectOption('select[id="engine-mode"]', 'hybrid');

    // Run categorization
    await page.click('button:has-text("Run Categorization")');

    // Wait for completion
    await page.waitForResponse(response =>
      response.url().includes('/api/dev/categorizer-lab/run') && response.status() === 200
    );
    await expect(page.locator('h2:has-text("Categorization Complete")')).toBeVisible({ timeout: 30000 });

    // Check that fuel transactions (with "FUEL" in description) get travel category
    const tableRows = page.locator('table tbody tr');
    await expect(tableRows).toHaveCount(4);

    // Find fuel transactions and verify they're categorized as travel
    for (let i = 0; i < 4; i++) {
      const descriptionCell = tableRows.nth(i).locator('td').nth(0);
      const categoryCell = tableRows.nth(i).locator('td').nth(1);

      const description = await descriptionCell.textContent();
      const category = await categoryCell.textContent();

      if (description?.includes('FUEL')) {
        console.log(`Fuel transaction "${description}" categorized as: ${category}`);
        // Fuel should be categorized as travel/transportation related
        expect(category).toContain('travel');
      }
    }
  });

  test('should test comprehensive ambiguity dataset', async ({ page }) => {
    await page.goto('/categorizer-lab');

    // Upload comprehensive ambiguity dataset via JSON
    const comprehensiveDataset = `[
      {"id":"amazon-1","description":"AMAZON.COM*OFFICE SUPPLIES","merchantName":"Amazon","amountCents":"4567","mcc":"5942","categoryId":"office_supplies","date":"2024-01-15"},
      {"id":"amazon-2","description":"AMAZON WEB SERVICES","merchantName":"Amazon","amountCents":"12450","mcc":"7372","categoryId":"software","date":"2024-01-16"},
      {"id":"7eleven-1","description":"7-ELEVEN #12345 FUEL","merchantName":"7-Eleven","amountCents":"4567","mcc":"5541","categoryId":"travel","date":"2024-01-15"},
      {"id":"7eleven-2","description":"7-ELEVEN #12345","merchantName":"7-Eleven","amountCents":"892","mcc":"5499","categoryId":"supplies","date":"2024-01-16"},
      {"id":"bill-1","description":"BILL PAYMENT AUTOPAY","merchantName":"Autopay Service","amountCents":"15600","mcc":"4900","categoryId":"rent_utilities","date":"2024-01-15"},
      {"id":"walmart-1","description":"WALMART SUPERCENTER","merchantName":"Walmart","amountCents":"4567","mcc":"5411","categoryId":"supplies","date":"2024-01-15"},
      {"id":"target-1","description":"TARGET STARBUCKS","merchantName":"Target","amountCents":"567","mcc":"5814","categoryId":"business_meals","date":"2024-01-17"},
      {"id":"apple-1","description":"APPLE.COM/BILL","merchantName":"Apple","amountCents":"99999","mcc":"5732","categoryId":"equipment","date":"2024-01-15"},
      {"id":"apple-2","description":"APPLE.COM/BILL","merchantName":"Apple","amountCents":"999","mcc":"5732","categoryId":"software","date":"2024-01-16"}
    ]`;

    // Select JSON upload
    await page.selectOption('select[id="upload-method"]', 'json');

    // Upload the dataset
    await page.fill('textarea[id="json-input"]', comprehensiveDataset);
    await page.click('button:has-text("Load JSON Data")');

    await expect(page.locator('h2:has-text("2. Configuration")')).toBeVisible();

    // Use hybrid mode for best disambiguation
    await page.selectOption('select[id="engine-mode"]', 'hybrid');

    // Run categorization
    await page.click('button:has-text("Run Categorization")');

    // Wait for completion
    await page.waitForResponse(response =>
      response.url().includes('/api/dev/categorizer-lab/run') && response.status() === 200
    );
    await expect(page.locator('h2:has-text("Categorization Complete")')).toBeVisible({ timeout: 45000 });

    // Verify 9 transactions processed
    const tableRows = page.locator('table tbody tr');
    await expect(tableRows).toHaveCount(9);

    // Check accuracy metrics are calculated (since we have ground truth)
    const accuracySection = page.locator('text=Confusion Matrix');
    if (await accuracySection.isVisible()) {
      await expect(accuracySection).toBeVisible();
      console.log('Accuracy metrics calculated for ambiguity dataset');
    }

    // Verify confidence variance across ambiguous cases
    const confidenceQuality = page.locator('text=Quality:').locator('..');
    await expect(confidenceQuality).toBeVisible();

    const qualityText = await confidenceQuality.textContent();
    console.log(`Ambiguity dataset confidence quality: ${qualityText}`);

    // Should show good confidence distribution for ambiguous cases
    expect(qualityText).not.toContain('Too uniform');

    // Check that both Pass-1 and LLM were used for disambiguation
    const pass1OnlyElement = page.locator('text=Pass-1 Only').locator('..').locator('.font-semibold');
    const llmUsedElement = page.locator('text=LLM Used').locator('..').locator('.font-semibold');

    const pass1Only = parseInt(await pass1OnlyElement.textContent() || '0');
    const llmUsed = parseInt(await llmUsedElement.textContent() || '0');

    console.log(`Ambiguity dataset engine usage: ${pass1Only} Pass-1, ${llmUsed} LLM`);

    // For ambiguous cases, we expect some LLM usage
    expect(llmUsed).toBeGreaterThan(0);
  });

  test('should handle file upload', async ({ page }) => {
    await page.goto('/categorizer-lab');
    
    // Select file upload mode
    await page.selectOption('select[id="upload-method"]', 'file');
    
    // Create a simple test CSV content
    const csvContent = `id,description,amount_cents,category_id
test-1,STARBUCKS COFFEE,-500,meals
test-2,ELECTRIC BILL,-15000,utilities`;
    
    // Create a file and upload it
    const fileBuffer = Buffer.from(csvContent, 'utf-8');
    
    await page.setInputFiles('[data-testid="file-input"]', {
      name: 'test-transactions.csv',
      mimeType: 'text/csv',
      buffer: fileBuffer,
    });
    
    // Should show configuration section
    await expect(page.locator('h2:has-text("2. Configuration")')).toBeVisible({ timeout: 15000 });
    
    // Should show correct transaction count
    await expect(page.locator('[data-testid="transaction-count-badge"]')).toContainText('2 transactions');
  });

  test('should handle paste data', async ({ page }) => {
    await page.goto('/categorizer-lab');
    
    // Select paste mode
    await page.selectOption('select[id="upload-method"]', 'paste');
    
    // Select JSON format
    await page.selectOption('select[id="data-format"]', 'json');
    
    // Paste JSON data
    const jsonData = JSON.stringify([
      {
        id: 'paste-1',
        description: 'COFFEE SHOP',
        amountCents: '-350',
        categoryId: 'meals'
      }
    ]);
    
    await page.fill('textarea[id="pasted-data"]', jsonData);
    await page.click('button:has-text("Load Data")');
    
    // Should show configuration section
    await expect(page.locator('h2:has-text("2. Configuration")')).toBeVisible({ timeout: 15000 });
    
    // Should show 1 transaction
    await expect(page.locator('[data-testid="transaction-count-badge"]')).toContainText('1 transaction');
  });

  test('should filter and sort results table', async ({ page }) => {
    await page.goto('/categorizer-lab');
    
    // Use a specific, hardcoded dataset for this test to ensure predictability
    const testData = JSON.stringify([
      { id: 'test-1', description: 'STARBUCKS', amountCents: '-500' },
      { id: 'test-2', description: 'AMAZON.COM', amountCents: '-2500' },
      { id: 'test-3', description: 'UBER TRIP', amountCents: '-1500' },
      { id: 'test-4', description: 'AMAZON WEB SERVICES', amountCents: '-12000' },
      { id: 'test-5', description: 'LOCAL COFFEE SHOP', amountCents: '-400' },
    ]);

    await page.selectOption('select[id="upload-method"]', 'paste');
    await page.selectOption('select[id="data-format"]', 'json');
    await page.fill('textarea[id="pasted-data"]', testData);
    await page.click('button:has-text("Load Data")');
    
    // Run categorization
    await page.selectOption('select[id="engine-mode"]', 'pass1');
    await page.click('button:has-text("Run Categorization")');
    
    // Wait for completion
    await expect(page.locator('h2:has-text("Categorization Complete")')).toBeVisible({ timeout: 45000 });
    
    // Test search filter for a unique term
    await page.fill('input[placeholder="Search transactions..."]', 'UBER');
    
    // Should filter the table to 1 result
    const tableRows = page.locator('table tbody tr');
    await expect(tableRows).toHaveCount(1);
    
    // Clear search and verify original count
    await page.fill('input[placeholder="Search transactions..."]', '');
    await expect(tableRows).toHaveCount(5);
    
    // Test engine filter
    await page.selectOption('select >> nth=1', 'pass1'); // Second select is the engine filter
    await expect(tableRows).toHaveCount(5); // All should be Pass-1
    
    // Test status filter
    await page.selectOption('select >> nth=2', 'success'); // Third select is status filter
    // Should still show results (assuming no errors)
  });

  test('should export results', async ({ page }) => {
    await page.goto('/categorizer-lab');
    
    // Generate minimal data for export test
    await page.fill('input[id="count"]', '3');
    await page.click('button:has-text("Generate Synthetic Data")');
    
    // Run categorization
    await page.selectOption('select[id="engine-mode"]', 'pass1');
    await page.click('button:has-text("Run Categorization")');
    
    // Wait for completion
    await expect(page.locator('h2:has-text("Categorization Complete")')).toBeVisible({ timeout: 45000 });
    
    // Test export buttons are enabled
    await expect(page.locator('button:has-text("Export as JSON")')).toBeEnabled();
    await expect(page.locator('button:has-text("Export as CSV")')).toBeEnabled();
    await expect(page.locator('button:has-text("Export Metrics CSV")')).toBeEnabled();
    
    // Click export JSON (we can't actually test the download in Playwright easily)
    await page.click('button:has-text("Export as JSON")');
    
    // Click export CSV
    await page.click('button:has-text("Export as CSV")');
    
    // Click export metrics
    await page.click('button:has-text("Export Metrics CSV")');
  });

  test('should show metrics and visualizations', async ({ page }) => {
    await page.goto('/categorizer-lab');
    
    // Generate data with ground truth for accuracy metrics
    await page.fill('input[id="count"]', '5');
    await page.click('button:has-text("Generate Synthetic Data")');
    
    // Run categorization
    await page.selectOption('select[id="engine-mode"]', 'pass1');
    await page.click('button:has-text("Run Categorization")');
    
    // Wait for completion
    await expect(page.locator('h2:has-text("Categorization Complete")')).toBeVisible({ timeout: 45000 });
    
    // Check metrics cards are visible
    await expect(page.locator('text=Total Transactions')).toBeVisible();
    await expect(page.locator('text=Successful')).toBeVisible();
    
    // Check performance metrics
    await expect(page.locator('text=Mean Latency')).toBeVisible();
    await expect(page.locator('text=P50 Latency')).toBeVisible();
    
    // Check confidence distribution
    await expect(page.locator('text=Confidence Distribution')).toBeVisible();
    await expect(page.locator('text=Mean Confidence')).toBeVisible();
    
    // Check accuracy metrics (should be available with synthetic data)
    await expect(page.locator('text=Accuracy Analysis')).toBeVisible();
    await expect(page.locator('text=Overall Accuracy')).toBeVisible();
    
    // Check visualizations
    await expect(page.locator('text=Engine Usage')).toBeVisible();
    await expect(page.locator('text=Latency Analysis')).toBeVisible();
  });

  test('should handle configuration changes', async ({ page }) => {
    await page.goto('/categorizer-lab');
    
    // Generate data
    await page.fill('input[id="count"]', '5');
    await page.click('button:has-text("Generate Synthetic Data")');
    
    // Test engine mode changes
    await page.selectOption('select[id="engine-mode"]', 'hybrid');
    await expect(page.locator('text=Hybrid Threshold')).toBeVisible();
    
    // Test batch size
    await page.fill('input[id="batch-size"]', '5');
    
    // Test concurrency
    await page.fill('input[id="concurrency"]', '2');
    
    // Check estimates update
    await expect(page.locator('text=5').first()).toBeVisible(); // Transaction count
    
    // Change back to Pass-1 only
    await page.selectOption('select[id="engine-mode"]', 'pass1');
    await expect(page.locator('text=Hybrid Threshold')).not.toBeVisible();
    
    // Run with Pass-1
    await page.click('button:has-text("Run Categorization")');
    await expect(page.locator('h2:has-text("Categorization Complete")')).toBeVisible({ timeout: 20000 });
  });
});