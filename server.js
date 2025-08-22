const express = require('express');
const { createProxyMiddleware } = require('http-proxy-middleware');
const session = require('express-session');
const bodyParser = require('body-parser');
const cookieParser = require('cookie-parser');
const path = require('path');
const puppeteer = require('puppeteer');

// Global shared session storage
let globalEnvatoSession = null;
let globalSessionExpiry = null;

// Auto-login function to establish shared session
async function autoLoginToEnvato() {
  console.log('Establishing shared Envato session...');
  
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  
  try {
    const page = await browser.newPage();
    
    // Set user agent to mimic a real browser
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
    
    // Navigate to Envato Elements sign-in page
    await page.goto('https://elements.envato.com/sign-in', { waitUntil: 'networkidle2', timeout: 30000 });
    
    // Wait for the page to fully load and take a screenshot for debugging
    await page.waitForTimeout(3000);
    
    // Debug: Log the page title and URL
    console.log('Current page:', await page.title(), await page.url());
    
    // Debug: Take a screenshot to see what's on the page
    // await page.screenshot({ path: 'debug-login-page.png', fullPage: true });
    
    // Enhanced selector detection for username/email field
    const usernameSelectors = [
      '#username',
      'input[name="username"]',
      'input[name="email"]',
      'input[type="email"]',
      'input[type="text"]',
      'input[placeholder*="email" i]',
      'input[placeholder*="username" i]',
      'input[placeholder*="login" i]',
      '[data-testid*="email"]',
      '[data-testid*="username"]'
    ];
    
    let usernameField = null;
    for (const selector of usernameSelectors) {
      try {
        console.log('Trying username selector:', selector);
        usernameField = await page.waitForSelector(selector, { timeout: 8000 });
        if (usernameField) {
          console.log('Found username field with selector:', selector);
          break;
        }
      } catch (e) {
        console.log('Selector not found:', selector);
        continue;
      }
    }
    
    if (!usernameField) {
      // Try to find any input field that might be for email/username
      const allInputs = await page.$$('input');
      for (const input of allInputs) {
        const type = await input.evaluate(el => el.type || el.name || el.placeholder || '');
        if (type.toLowerCase().includes('email') || type.toLowerCase().includes('user') || type.toLowerCase().includes('login')) {
          usernameField = input;
          console.log('Found username field by inspection:', type);
          break;
        }
      }
    }
    
    if (!usernameField) {
      throw new Error('Username field not found - page structure may have changed');
    }
    
    await usernameField.click();
    await usernameField.type(process.env.ENVATO_EMAIL || ENVATO_CREDENTIALS.email, { delay: 100 });
    
    // Enhanced selector detection for password field
    const passwordSelectors = [
      '#password',
      'input[name="password"]',
      'input[type="password"]',
      'input[placeholder*="password" i]',
      '[data-testid*="password"]'
    ];
    
    let passwordField = null;
    for (const selector of passwordSelectors) {
      try {
        console.log('Trying password selector:', selector);
        passwordField = await page.waitForSelector(selector, { timeout: 8000 });
        if (passwordField) {
          console.log('Found password field with selector:', selector);
          break;
        }
      } catch (e) {
        console.log('Selector not found:', selector);
        continue;
      }
    }
    
    if (!passwordField) {
      // Try to find any password input
      passwordField = await page.$('input[type="password"]');
      if (!passwordField) {
        throw new Error('Password field not found - page structure may have changed');
      }
    }
    
    await passwordField.click();
    await passwordField.type(process.env.ENVATO_PASSWORD || ENVATO_CREDENTIALS.password, { delay: 100 });
    
    // Enhanced selector detection for submit button
    const submitSelectors = [
      'button[type="submit"]',
      'button[data-testid*="submit"]',
      'button[data-testid*="login"]',
      'button[data-testid*="sign"]',
      'input[type="submit"]',
      'button:has-text("Sign in")',
      'button:has-text("Log in")',
      'button:has-text("Continue")',
      '[aria-label*="sign" i]',
      '[aria-label*="log" i]'
    ];
    
    let submitButton = null;
    for (const selector of submitSelectors) {
      try {
        if (selector.includes(':has-text')) {
          const text = selector.includes('Sign in') ? 'Sign in' : 'Log in';
          const [button] = await page.$x(`//button[contains(translate(., 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', 'abcdefghijklmnopqrstuvwxyz'), '${text.toLowerCase()}')]`);
          if (button) {
            submitButton = button;
            console.log('Found submit button with text:', text);
            break;
          }
        } else {
          submitButton = await page.waitForSelector(selector, { timeout: 8000 });
          if (submitButton) {
            console.log('Found submit button with selector:', selector);
            break;
          }
        }
      } catch (e) {
        continue;
      }
    }
    
    if (!submitButton) {
      // Try to find any button that might be for submission
      const buttons = await page.$$('button');
      for (const button of buttons) {
        const text = await button.evaluate(el => el.textContent || el.value || '');
        if (text.toLowerCase().includes('sign') || text.toLowerCase().includes('log') || text.toLowerCase().includes('continue')) {
          submitButton = button;
          console.log('Found submit button by text:', text);
          break;
        }
      }
    }
    
    if (submitButton) {
      await submitButton.click();
    } else {
      // Try pressing Enter as fallback
      console.log('No submit button found, pressing Enter...');
      await page.keyboard.press('Enter');
    }
    
    // Wait for login to complete
    await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 30000 });
    
    // Wait a bit for session cookies to be set
    await page.waitForTimeout(3000);
    
    // Get all cookies from the browser
    const cookies = await page.cookies();
    
    if (cookies.length === 0) {
      throw new Error('No cookies received after login');
    }
    
    // Store the session globally
    globalEnvatoSession = cookies.map(cookie => `${cookie.name}=${cookie.value}`).join('; ');
    globalSessionExpiry = Date.now() + (4 * 60 * 60 * 1000); // 4 hours expiry
    
    console.log('Shared Envato session established successfully with', cookies.length, 'cookies');
    console.log(`Session expires at: ${new Date(globalSessionExpiry)}`);
    
    return globalEnvatoSession;
    
  } catch (error) {
    console.error('Failed to establish shared Envato session:', error.message);
    return null;
  } finally {
    await browser.close();
  }
}

// Function to check and refresh session if needed
async function refreshSharedSession() {
  if (!globalEnvatoSession || Date.now() > globalSessionExpiry) {
    console.log('Refreshing shared Envato session...');
    await autoLoginToEnvato();
  }
  return globalEnvatoSession;
}app = express();
const PORT = process.env.PORT || 3000;

// Session configuration
app.use(session({
    secret: 'envato-proxy-secret-key-change-this-in-production',
    resave: false,
    saveUninitialized: false,
    cookie: {
        secure: process.env.NODE_ENV === 'production',
        httpOnly: true,
        maxAge: 24 * 60 * 60 * 1000 // 24 hours
    }
}));

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(express.static('public'));

// Custom login credentials (change these for production)
const VALID_CREDENTIALS = {
    username: 'admin',
    password: 'password123'
};

// Envato credentials for auto-login
const ENVATO_CREDENTIALS = {
    email: 'kolikavi09@gmail.com',
    password: 'JEf5w$!-D$nrJGR'
};

// Session management middleware
function requireAuth(req, res, next) {
    if (req.session.authenticated) {
        return next();
    }
    res.redirect('/login');
}

// Login API endpoint
app.post('/api/login', (req, res) => {
    const { username, password } = req.body;
    
    if (username === VALID_CREDENTIALS.username && password === VALID_CREDENTIALS.password) {
        req.session.authenticated = true;
        req.session.username = username;
        res.json({ success: true });
    } else {
        res.status(401).json({ error: 'Invalid credentials' });
    }
});

// Logout endpoint
app.post('/api/logout', (req, res) => {
    req.session.destroy((err) => {
        if (err) {
            res.status(500).json({ error: 'Logout failed' });
        } else {
            res.json({ success: true });
        }
    });
});

// Login page
app.get('/login', (req, res) => {
    if (req.session.authenticated) {
        return res.redirect('/');
    }
    res.sendFile(path.join(__dirname, 'public', 'login.html'));
});

// Proxy configuration for Envato Elements
const proxyOptions = {
    target: 'https://elements.envato.com',
    changeOrigin: true,
    ws: true,
    logLevel: 'debug',
    onProxyReq: (proxyReq, req, res) => {
        // Add headers to mimic a real browser
        proxyReq.setHeader('User-Agent', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36');
        
        // Use shared Envato session for all visitors
        // Set the session cookie synchronously if available
        if (globalEnvatoSession) {
            proxyReq.setHeader('Cookie', globalEnvatoSession);
        }
    },
    onProxyRes: (proxyRes, req, res) => {
        // We don't need to store individual sessions anymore since we're using shared session
        // Just forward the response as-is
        
        // Modify response headers
        proxyRes.headers['x-powered-by'] = 'Envato Proxy';
    },
    onError: (err, req, res) => {
        console.error('Proxy error:', err);
        res.status(500).json({ error: 'Proxy error occurred' });
    }
};

// Create proxy middleware
const proxy = createProxyMiddleware(proxyOptions);

// Apply authentication middleware to all routes except login
app.use('/', requireAuth, proxy);

// Error handling middleware
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).send('Something broke!');
});

// Start server with auto-login on startup
async function startServer() {
  // Establish shared Envato session on startup
  await autoLoginToEnvato();
  
  // Set up periodic session refresh (every 3 hours)
  setInterval(async () => {
    await refreshSharedSession();
  }, 3 * 60 * 60 * 1000);
  
  app.listen(PORT, () => {
    console.log(`Envato Reverse Proxy Server running on port ${PORT}`);
    console.log(`Access the proxy at: http://localhost:${PORT}`);
    console.log(`Login page at: http://localhost:${PORT}/login`);
    console.log('Shared Envato session will be used for all visitors');
  });
}

startServer();

// Handle graceful shutdown
process.on('SIGTERM', () => {
    console.log('SIGTERM received, shutting down gracefully');
    process.exit(0);
});

process.on('SIGINT', () => {
    console.log('SIGINT received, shutting down gracefully');
    process.exit(0);
});