/**
 * GNCP Academic & Enrollment System — Automated Test & Audit Suite
 * 
 * Automates:
 * 1. PHP Syntax Validation (php -l check across all backend files)
 * 2. JavaScript Syntax & Console Error Checking (Node VM execution & syntax analysis)
 * 3. HTML Asset Link & Script Integrity Verification
 * 4. Frontend-to-Backend API Route Contract Auditing
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const vm = require('vm');

const ROOT_DIR = path.resolve(__dirname, '..');

// Terminal Color Formatting
const COLORS = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
  gray: '\x1b[90m'
};

function logHeader(title) {
  console.log(`\n${COLORS.bright}${COLORS.cyan}====================================================${COLORS.reset}`);
  console.log(`${COLORS.bright}${COLORS.cyan} ${title}${COLORS.reset}`);
  console.log(`${COLORS.bright}${COLORS.cyan}====================================================${COLORS.reset}`);
}

function findFiles(dir, extensions, fileList = []) {
  if (!fs.existsSync(dir)) return fileList;
  const files = fs.readdirSync(dir);
  for (const file of files) {
    if (file === 'node_modules' || file === '.git' || file === 'tests') continue;
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);
    if (stat.isDirectory()) {
      findFiles(filePath, extensions, fileList);
    } else if (extensions.includes(path.extname(file).toLowerCase())) {
      fileList.push(filePath);
    }
  }
  return fileList;
}

// Locate PHP Executable
function getPhpBinary() {
  const xamppPhp = 'C:\\xampp\\php\\php.exe';
  if (fs.existsSync(xamppPhp)) return `"${xamppPhp}"`;
  try {
    execSync('php -v', { stdio: 'ignore' });
    return 'php';
  } catch (e) {
    return null;
  }
}

let totalTests = 0;
let passedTests = 0;
let failedTests = 0;
const failures = [];

function recordResult(testName, success, errorMsg = '') {
  totalTests++;
  if (success) {
    passedTests++;
    console.log(`  ${COLORS.green}✓ PASS${COLORS.reset} - ${testName}`);
  } else {
    failedTests++;
    console.log(`  ${COLORS.red}✗ FAIL${COLORS.reset} - ${testName}`);
    if (errorMsg) {
      console.log(`    ${COLORS.red}${errorMsg.replace(/\n/g, '\n    ')}${COLORS.reset}`);
    }
    failures.push({ testName, errorMsg });
  }
}

// ------------------------------------------------------------------
// 1. PHP SYNTAX CHECKING (php -l)
// ------------------------------------------------------------------
function testPhpSyntax() {
  logHeader('1. PHP Syntax & Lint Validation');
  const phpBin = getPhpBinary();
  if (!phpBin) {
    console.log(`  ${COLORS.yellow}⚠ WARNING: PHP binary not found. Skipping PHP linting.${COLORS.reset}`);
    return;
  }

  const phpFiles = findFiles(ROOT_DIR, ['.php']);
  console.log(`  Found ${phpFiles.length} PHP files to lint...\n`);

  for (const file of phpFiles) {
    const relPath = path.relative(ROOT_DIR, file);
    try {
      const output = execSync(`${phpBin} -l "${file}"`, { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] });
      if (output.includes('No syntax errors detected')) {
        recordResult(`PHP Lint: ${relPath}`, true);
      } else {
        recordResult(`PHP Lint: ${relPath}`, false, output.trim());
      }
    } catch (err) {
      recordResult(`PHP Lint: ${relPath}`, false, err.stdout || err.stderr || err.message);
    }
  }
}

// ------------------------------------------------------------------
// 2. JAVASCRIPT SYNTAX & CONSOLE ERROR CHECKING
// ------------------------------------------------------------------
function testJsSyntaxAndConsole() {
  logHeader('2. JavaScript Syntax & Console Error Audit');
  const jsFiles = findFiles(ROOT_DIR, ['.js']);
  console.log(`  Found ${jsFiles.length} JavaScript files to test...\n`);

  for (const file of jsFiles) {
    const relPath = path.relative(ROOT_DIR, file);
    const isVendor = relPath.includes('shared\\libs') || relPath.includes('shared/libs') || relPath.includes('vendor');
    const code = fs.readFileSync(file, 'utf8');

    // Step A: Syntax Parse Test (All JS Files including vendor)
    let syntaxValid = true;
    try {
      new vm.Script(code, { filename: relPath });
      recordResult(`JS Syntax: ${relPath}`, true);
    } catch (err) {
      syntaxValid = false;
      recordResult(`JS Syntax: ${relPath}`, false, `${err.name}: ${err.message}`);
    }

    if (!syntaxValid || isVendor) continue;

    // Step B: Simulated Runtime Console & Execution Audit for App Code
    const consoleErrors = [];

    const mockElement = {
      appendChild: () => {},
      removeChild: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      setAttribute: () => {},
      removeAttribute: () => {},
      classList: { add: () => {}, remove: () => {}, toggle: () => {}, contains: () => false },
      style: {},
      innerHTML: '',
      innerText: '',
      value: '',
      dataset: {}
    };

    const mockDoc = {
      querySelector: () => mockElement,
      querySelectorAll: () => [mockElement],
      getElementById: () => mockElement,
      getElementsByClassName: () => [mockElement],
      createElement: () => mockElement,
      createTextNode: () => mockElement,
      head: mockElement,
      body: mockElement,
      addEventListener: () => {},
      removeEventListener: () => {}
    };

    const sandbox = {
      window: {},
      document: mockDoc,
      console: {
        log: () => {},
        warn: () => {},
        info: () => {},
        error: (...args) => consoleErrors.push(args.join(' '))
      },
      Vue: {
        createApp: () => ({
          use: () => ({ mount: () => ({}) }),
          mount: () => ({}),
          component: () => {},
          directive: () => {}
        }),
        ref: (val) => ({ value: val }),
        reactive: (obj) => obj,
        onMounted: (fn) => { try { fn(); } catch(e){} },
        watch: () => {},
        computed: (fn) => ({ get value() { return fn(); } })
      },
      VueRouter: {
        createRouter: () => ({ beforeEach: () => {} }),
        createWebHashHistory: () => {},
        useRouter: () => ({ push: () => {} })
      },
      DataBus: {
        emit: () => {},
        on: () => {},
        off: () => {}
      },
      fetch: async () => ({ json: async () => ({ success: true, data: [] }) }),
      sessionStorage: {
        getItem: () => null,
        setItem: () => {},
        removeItem: () => {}
      },
      localStorage: {
        getItem: () => null,
        setItem: () => {},
        removeItem: () => {}
      },
      bootstrap: {
        Modal: {
          getInstance: () => ({ hide: () => {}, show: () => {} }),
          getOrCreateInstance: () => ({ hide: () => {}, show: () => {} })
        },
        Toast: {
          getOrCreateInstance: () => ({ show: () => {} })
        }
      },
      setTimeout: (fn) => fn(),
      setInterval: () => {},
      clearTimeout: () => {},
      clearInterval: () => {}
    };

    sandbox.global = sandbox;
    sandbox.self = sandbox;
    sandbox.window = sandbox;

    try {
      const context = vm.createContext(sandbox);
      const script = new vm.Script(code, { filename: relPath });
      script.runInContext(context);

      if (consoleErrors.length > 0) {
        recordResult(`JS Runtime Console Audit: ${relPath}`, false, `Console Errors Logged:\n${consoleErrors.join('\n')}`);
      } else {
        recordResult(`JS Runtime Console Audit: ${relPath}`, true);
      }
    } catch (err) {
      recordResult(`JS Runtime Console Audit: ${relPath}`, false, `Runtime Exception: ${err.stack || err.message}`);
    }
  }
}

// ------------------------------------------------------------------
// 3. HTML ASSET LINK & SCRIPT INTEGRITY
// ------------------------------------------------------------------
function testHtmlAssets() {
  logHeader('3. HTML Asset Link & Script Integrity Audit');
  const htmlFiles = findFiles(ROOT_DIR, ['.html']);
  console.log(`  Found ${htmlFiles.length} HTML files to inspect...\n`);

  for (const file of htmlFiles) {
    const relPath = path.relative(ROOT_DIR, file);
    const content = fs.readFileSync(file, 'utf8');

    const scriptSrcRegex = /<script\s+[^>]*src=["']([^"']+)["']/gi;
    const cssHrefRegex = /<link\s+[^>]*href=["']([^"']+)["']/gi;

    let match;
    const links = [];

    while ((match = scriptSrcRegex.exec(content)) !== null) {
      links.push({ type: 'script', url: match[1] });
    }
    while ((match = cssHrefRegex.exec(content)) !== null) {
      links.push({ type: 'stylesheet', url: match[1] });
    }

    let fileOk = true;
    const missingAssets = [];

    for (const link of links) {
      if (link.url.startsWith('http://') || link.url.startsWith('https://') || link.url.startsWith('//')) {
        continue;
      }
      // Strip URL query parameters (e.g. ?v=2.3)
      const cleanUrl = link.url.split('?')[0].split('#')[0];
      const assetPath = path.join(path.dirname(file), cleanUrl);
      if (!fs.existsSync(assetPath)) {
        fileOk = false;
        missingAssets.push(`Missing local ${link.type}: ${link.url} (resolved to ${path.relative(ROOT_DIR, assetPath)})`);
      }
    }

    if (fileOk) {
      recordResult(`HTML Asset Check: ${relPath}`, true);
    } else {
      recordResult(`HTML Asset Check: ${relPath}`, false, missingAssets.join('\n'));
    }
  }
}

// ------------------------------------------------------------------
// 4. FRONTEND TO BACKEND API ROUTE CONTRACT CHECK
// ------------------------------------------------------------------
function testApiRouteContracts() {
  logHeader('4. API Route & Endpoint Contract Verification');
  const appJsPath = path.join(ROOT_DIR, 'assets', 'js', 'app.js');
  const apiIndexPhpPath = path.join(ROOT_DIR, 'api', 'index.php');

  if (!fs.existsSync(appJsPath) || !fs.existsSync(apiIndexPhpPath)) {
    console.log(`  ${COLORS.yellow}⚠ Skipping API Contract check (app.js or api/index.php missing).${COLORS.reset}`);
    return;
  }

  const appJs = fs.readFileSync(appJsPath, 'utf8');
  const apiPhp = fs.readFileSync(apiIndexPhpPath, 'utf8');

  const apiRouteRegex = /apiFetch\(\s*[`'"]([^`'"&?]+)(?:[?&][^`'"]*)?[`'"]/g;
  let match;
  const queriedRoutes = new Set();

  while ((match = apiRouteRegex.exec(appJs)) !== null) {
    queriedRoutes.add(match[1].trim());
  }

  console.log(`  Extracted ${queriedRoutes.size} API action routes queried by frontend SPA...\n`);

  for (const route of queriedRoutes) {
    const isMatched = apiPhp.includes(`'${route}'`) || apiPhp.includes(`"${route}"`) || apiPhp.includes(`action === '${route}'`);
    if (isMatched) {
      recordResult(`API Route Contract: '${route}'`, true);
    } else {
      recordResult(`API Route Contract: '${route}'`, false, `Route '${route}' called in app.js but missing in api/index.php router!`);
    }
  }
}

// ------------------------------------------------------------------
// MAIN EXECUTION & SUMMARY
// ------------------------------------------------------------------
function main() {
  console.log(`${COLORS.bright}${COLORS.cyan}`);
  console.log(`  ========================================================`);
  console.log(`   🚀 GNCP AUTOMATED SYSTEM TEST & CONSOLE AUDIT RUNNER`);
  console.log(`  ========================================================${COLORS.reset}\n`);

  const startTime = Date.now();

  testPhpSyntax();
  testJsSyntaxAndConsole();
  testHtmlAssets();
  testApiRouteContracts();

  const duration = ((Date.now() - startTime) / 1000).toFixed(2);

  logHeader('SUITE EXECUTION SUMMARY');
  console.log(`  Total Tests Run : ${COLORS.bright}${totalTests}${COLORS.reset}`);
  console.log(`  Passed          : ${COLORS.green}${COLORS.bright}${passedTests}${COLORS.reset}`);
  console.log(`  Failed          : ${failedTests > 0 ? COLORS.red : COLORS.green}${COLORS.bright}${failedTests}${COLORS.reset}`);
  console.log(`  Execution Time  : ${duration} seconds\n`);

  if (failedTests > 0) {
    console.log(`${COLORS.red}${COLORS.bright}  [!] FAILURES DETECTED:${COLORS.reset}`);
    failures.forEach((f, idx) => {
      console.log(`   ${idx + 1}. ${f.testName}`);
      if (f.errorMsg) console.log(`      ${COLORS.gray}${f.errorMsg.replace(/\n/g, '\n      ')}${COLORS.reset}`);
    });
    console.log('\n');
    process.exit(1);
  } else {
    console.log(`${COLORS.green}${COLORS.bright}  🎉 ALL TESTS PASSED SUCCESSFULLY! ZERO CONSOLE OR SYNTAX BUGS FOUND.${COLORS.reset}\n`);
    process.exit(0);
  }
}

main();
